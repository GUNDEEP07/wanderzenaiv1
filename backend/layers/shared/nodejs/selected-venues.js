'use strict';

/**
 * Step 3 ("Choose your experiences") picks — validation, day planning and prompt text.
 *
 * Wire format (version 2), produced by frontend VenueSelection:
 *   {
 *     version: 2,
 *     picks: [{ name, address?, lat?, lng?, category?, destination?, source?, day? }],
 *     interests: ["Hiking", "Food", ...]   // generic categories the user ticked
 *   }
 *
 * Older submissions stored { "<dest>/<activity>": ["<venueId>", ...] } — bare IDs with no
 * names. Those carry nothing Claude can use, so they normalise to an empty plan.
 */

const MAX_PICKS = 40;
const MAX_INTERESTS = 20;

const str = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};

const num = (v, min, max) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const dayOf = (v, totalDays) => {
  const n = num(v, 1, totalDays);
  return n !== null && Number.isInteger(n) ? n : null;
};

/**
 * Validate and normalise what the browser sent. Never throws; drops anything malformed.
 * @param {unknown} raw request body `selected_venues`
 * @param {number} totalDays trip length, for range-checking pinned days
 * @returns {{ version: 2, picks: object[], interests: string[] } | object} v2 object, or
 *          the legacy object unchanged (it is harmless and kept for history)
 */
function sanitizeSelectedVenues(raw, totalDays) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  if (raw.version !== 2) return raw;

  const seen = new Set();
  const picks = [];
  for (const p of Array.isArray(raw.picks) ? raw.picks : []) {
    if (picks.length >= MAX_PICKS) break;
    if (!p || typeof p !== 'object') continue;
    const name = str(p.name, 150);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const lat = num(p.lat, -90, 90);
    const lng = num(p.lng, -180, 180);
    picks.push({
      name,
      address: str(p.address, 200),
      lat: lat !== null && lng !== null ? lat : null,
      lng: lat !== null && lng !== null ? lng : null,
      category: str(p.category, 60),
      destination: str(p.destination, 120),
      source: str(p.source, 20),
      day: dayOf(p.day, totalDays),
    });
  }

  const interests = [];
  for (const i of Array.isArray(raw.interests) ? raw.interests : []) {
    if (interests.length >= MAX_INTERESTS) break;
    const s = str(i, 60);
    if (s && !interests.some(x => x.toLowerCase() === s.toLowerCase())) interests.push(s);
  }

  return { version: 2, picks, interests };
}

/**
 * Give every pick a day. User-pinned days are kept; unpinned picks are spread over the
 * least-loaded days (ties → earliest), so each 3-day generation batch knows exactly which
 * places it must include.
 * @returns {{ picks: Array<object & { day: number, pinned: boolean }>, interests: string[] }}
 */
function planPicks(selectedVenues, totalDays) {
  const clean = sanitizeSelectedVenues(selectedVenues, totalDays);
  if (clean.version !== 2 || totalDays < 1) return { picks: [], interests: [] };

  const load = new Array(totalDays + 1).fill(0);
  const planned = [];
  for (const p of clean.picks) {
    if (p.day) { load[p.day]++; planned.push({ ...p, pinned: true }); }
  }
  for (const p of clean.picks) {
    if (p.day) continue;
    let best = 1;
    for (let d = 2; d <= totalDays; d++) if (load[d] < load[best]) best = d;
    load[best]++;
    planned.push({ ...p, day: best, pinned: false });
  }
  planned.sort((a, b) => a.day - b.day);
  return { picks: planned, interests: clean.interests };
}

function describePick(p) {
  const parts = [p.name];
  if (p.category && p.category.toLowerCase() !== 'suggested') parts.push(`(${p.category})`);
  if (p.address) parts.push(`— ${p.address}`);
  if (p.lat !== null && p.lng !== null) parts.push(`[${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}]`);
  return parts.join(' ');
}

/** Prompt block for one batch of days. Empty string when there is nothing to add. */
function formatPicksForDays(plan, dayNumbers) {
  const lines = [];
  for (const d of dayNumbers) {
    for (const p of plan.picks.filter(x => x.day === d)) {
      lines.push(`- Day ${d}: ${describePick(p)}${p.pinned ? ' — the traveller chose this day' : ''}`);
    }
  }
  const interestLine = plan.interests.length
    ? `\nThe traveller also ticked these interests in the planner — reflect them across the days: ${plan.interests.join(', ')}.`
    : '';
  if (!lines.length) return interestLine;
  return `

PLACES THE TRAVELLER PICKED THEMSELVES — REQUIRED:
${lines.join('\n')}
Rules for these places:
- Include every place above on the day shown, as a morning, afternoon or evening activity (or localEats if it is a food spot).
- Set venueName to the place name exactly as written above.
- Plan the rest of that day around it geographically.${interestLine}`;
}

/** Prompt block for the trip overview (title/summary/accommodation). */
function formatPicksOverview(plan) {
  if (!plan.picks.length && !plan.interests.length) return '';
  const lines = plan.picks.map(p => `- Day ${p.day}: ${describePick(p)}`);
  return `
${lines.length ? `\nPlaces the traveller picked (they will appear on these days):\n${lines.join('\n')}` : ''}${plan.interests.length ? `\nInterests they ticked: ${plan.interests.join(', ')}` : ''}
Let the title, summary and accommodation suggestion reflect these choices.`;
}

const normalise = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const dayText = (day) => {
  const parts = [day?.theme, day?.hiddenGem];
  for (const k of ['morningActivity', 'afternoonActivity', 'eveningActivity', 'localEats']) {
    const a = day?.[k];
    if (a) parts.push(a.venueName, a.activity, a.location, a.name, a.dish);
  }
  return normalise(parts.filter(Boolean).join(' '));
};

/**
 * Picks that did not make it into the generated days (anywhere, and on their planned day).
 * Matching is loose (case/accents/punctuation) because Claude may add a suffix like
 * "Fushimi Inari Taisha (伏見稲荷大社)".
 * @returns {{ missing: object[], wrongDay: object[] }}
 */
function findMissingPicks(days, plan) {
  const byDay = new Map((days || []).map(d => [d.dayNumber, dayText(d)]));
  const all = [...byDay.values()].join(' | ');
  const missing = [];
  const wrongDay = [];
  for (const p of plan.picks) {
    const n = normalise(p.name);
    if (!n) continue;
    if (!all.includes(n)) missing.push(p);
    else if (p.pinned && !(byDay.get(p.day) || '').includes(n)) wrongDay.push(p);
  }
  return { missing, wrongDay };
}

module.exports = {
  MAX_PICKS,
  sanitizeSelectedVenues,
  planPicks,
  formatPicksForDays,
  formatPicksOverview,
  findMissingPicks,
};
