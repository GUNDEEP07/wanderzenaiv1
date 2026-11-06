'use strict';

/**
 * Route first (Q2, approach 1 — confirmed by Gundeep, Nov 6 2026).
 *
 * Before Step 3 the traveller gets a proposed route for the trip: 1–6 bases (towns to
 * stay in), how many days in each, how to get from one to the next, and day-trip ideas
 * from each base. They can edit it. Step 3 suggestions then load per base, and the
 * generator ties every day to a base.
 *
 * Wire format (inside selected_venues v2 as `route`, so no schema change):
 *   { bases: [{ name, region?, country?, lat?, lng?, days, why?, stayType?,
 *               transferIn?: { mode, hours?, note? }, dayTrips?: [{ name, why? }] }] }
 *
 * Everything here is pure: the /route-plan endpoint, the frontend payload and the
 * generator all pass through sanitizeRoute.
 */

const MAX_BASES = 6;
const MAX_DAY_TRIPS = 4;
const TRANSFER_MODES = new Set(['train', 'bus', 'car', 'ferry', 'flight', 'walk', 'other']);

const str = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : null;
};
const num = (v, min, max) => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * Make the days add up to the trip length: trim the longest stays first when there are
 * too many, extend the longest when there are too few. Every base keeps at least 1 day;
 * bases beyond the trip length are dropped from the end.
 */
function balanceDays(bases, totalDays) {
  const out = bases.slice(0, Math.max(1, totalDays)).map(b => ({ ...b, days: Math.max(1, Math.round(b.days || 1)) }));
  let sum = out.reduce((a, b) => a + b.days, 0);
  while (sum > totalDays) {
    const i = out.reduce((best, b, idx) => (b.days > out[best].days ? idx : best), 0);
    if (out[i].days <= 1) break;
    out[i].days--; sum--;
  }
  while (sum < totalDays) {
    const i = out.reduce((best, b, idx) => (b.days > out[best].days ? idx : best), 0);
    out[i].days++; sum++;
  }
  return out;
}

/**
 * Validate and normalise a route. Never throws.
 * @param {unknown} raw
 * @param {number} totalDays
 * @returns {{ bases: object[] } | null} null when there is no usable base
 */
function sanitizeRoute(raw, totalDays) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.bases) || !(totalDays >= 1)) return null;
  const bases = [];
  for (const b of raw.bases) {
    if (bases.length >= MAX_BASES) break;
    if (!b || typeof b !== 'object') continue;
    const name = str(b.name, 80);
    if (!name) continue;
    const lat = num(b.lat, -90, 90);
    const lng = num(b.lng, -180, 180);
    const t = b.transferIn && typeof b.transferIn === 'object' ? b.transferIn : null;
    const mode = t && typeof t.mode === 'string' ? t.mode.toLowerCase().trim() : null;
    bases.push({
      name,
      region: str(b.region, 80),
      country: str(b.country, 60),
      lat: lat !== null && lng !== null ? lat : null,
      lng: lat !== null && lng !== null ? lng : null,
      days: num(b.days, 1, 30) || 1,
      why: str(b.why, 240),
      stayType: str(b.stayType, 80),
      transferIn: bases.length && t ? {
        mode: TRANSFER_MODES.has(mode) ? mode : 'other',
        hours: num(t.hours, 0, 48),
        note: str(t.note, 160),
      } : null,
      dayTrips: (Array.isArray(b.dayTrips) ? b.dayTrips : [])
        .map(d => ({ name: str(d?.name, 80), why: str(d?.why, 160) }))
        .filter(d => d.name)
        .slice(0, MAX_DAY_TRIPS),
    });
  }
  if (!bases.length) return null;
  return { bases: balanceDays(bases, totalDays) };
}

/**
 * Which base each day belongs to. Day 1 is the first base; the first day at every later
 * base is its travel day.
 * @returns {Array<{ day: number, base: object, baseIndex: number, travelDay: boolean }>}
 */
function dayPlan(route) {
  const out = [];
  let day = 1;
  (route?.bases || []).forEach((base, baseIndex) => {
    for (let i = 0; i < base.days; i++) {
      out.push({ day, base, baseIndex, travelDay: i === 0 && baseIndex > 0 });
      day++;
    }
  });
  return out;
}

/** Days (1-based) spent at the base with this name (case-insensitive), or []. */
function daysForBase(route, name) {
  const key = String(name || '').split(',')[0].trim().toLowerCase();
  if (!key) return [];
  return dayPlan(route).filter(d => d.base.name.toLowerCase() === key).map(d => d.day);
}

const placeName = (b) => [b.name, b.region, b.country].filter(Boolean).join(', ');
const transferText = (t) => t
  ? `${t.mode}${t.hours ? ` (~${t.hours} h)` : ''}${t.note ? ` — ${t.note}` : ''}`
  : '';

/** Prompt block for the overview call. */
function formatRouteOverview(route) {
  if (!route?.bases?.length) return '';
  const plan = dayPlan(route);
  const lines = route.bases.map((b, i) => {
    const days = plan.filter(d => d.baseIndex === i).map(d => d.day);
    const range = days.length > 1 ? `Days ${days[0]}–${days[days.length - 1]}` : `Day ${days[0]}`;
    return `- ${range}: ${placeName(b)}${b.stayType ? ` (stay: ${b.stayType})` : ''}${b.transferIn ? ` — arrive by ${transferText(b.transferIn)}` : ''}`;
  });
  return `

ROUTE THE TRAVELLER CONFIRMED (bases in order):
${lines.join('\n')}
The accommodation recommendation should cover each base (one stay per base), and the title and summary should reflect the whole route.`;
}

/** Prompt block for a batch of days. */
function formatRouteForDays(route, dayNumbers) {
  if (!route?.bases?.length) return '';
  const plan = dayPlan(route);
  const lines = [];
  for (const n of dayNumbers) {
    const d = plan.find(x => x.day === n);
    if (!d) continue;
    const prev = route.bases[d.baseIndex - 1];
    if (d.travelDay) {
      lines.push(`- Day ${n}: TRAVEL DAY ${prev ? prev.name : ''} → ${d.base.name} by ${transferText(d.base.transferIn) || 'local transport'}. Keep it light: the journey, check in, then one easy walk, café or meal near the new base.`);
    } else {
      const trips = d.base.dayTrips?.length ? ` Day-trip options from here: ${d.base.dayTrips.map(t => t.name).join(', ')}.` : '';
      lines.push(`- Day ${n}: based in ${placeName(d.base)}. Everything that day is within easy reach of ${d.base.name} (or one day trip from it).${trips}`);
    }
  }
  if (!lines.length) return '';
  return `

WHERE THE TRAVELLER IS EACH DAY — REQUIRED:
${lines.join('\n')}
Do not schedule anything that needs more than ~1.5 h each way from that day's base, except a planned day trip.`;
}

/** Bases (unique, in order) covering these days. */
function basesForDays(route, dayNumbers) {
  const plan = dayPlan(route);
  const seen = new Map();
  for (const n of dayNumbers) {
    const d = plan.find(x => x.day === n);
    if (d && !seen.has(d.baseIndex)) seen.set(d.baseIndex, d.base);
  }
  return [...seen.values()];
}

// ─── Who's travelling (asked before any route is suggested) ─────────────────

const COMFORT = new Set(['short', 'medium', 'long']);
const COMFORT_TEXT = {
  short: 'no more than ~2.5 hours between stops',
  medium: 'up to ~4.5 hours between stops',
  long: 'long journeys are fine',
};

/**
 * Validate the "who's travelling" answers. Never throws.
 * @returns {{ adults: number, kids: number[], transferComfort: 'short'|'medium'|'long',
 *             overnightOk: boolean, notes: string|null }}
 */
function sanitizePrefs(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const kids = (Array.isArray(p.kids) ? p.kids : [])
    .map(a => num(a, 0, 17))
    .filter(a => a !== null)
    .map(a => Math.floor(a))
    .slice(0, 8);
  const comfort = typeof p.transferComfort === 'string' && COMFORT.has(p.transferComfort) ? p.transferComfort : 'medium';
  return {
    adults: Math.floor(num(p.adults, 1, 12) || 2),
    kids,
    transferComfort: comfort,
    overnightOk: p.overnightOk === true && !kids.some(a => a < 6),
    notes: str(p.notes, 300),
  };
}

/** One line for prompts, e.g. "2 adults and children aged 5, 8; up to ~4.5 hours between stops". */
function describePrefs(prefs) {
  if (!prefs) return '';
  const who = `${prefs.adults} adult${prefs.adults === 1 ? '' : 's'}${prefs.kids.length ? ` and ${prefs.kids.length === 1 ? 'a child' : 'children'} aged ${prefs.kids.join(', ')}` : ''}`;
  return `${who}; ${COMFORT_TEXT[prefs.transferComfort]}${prefs.overnightOk ? '; overnight trains/buses are OK' : '; no overnight journeys'}${prefs.notes ? `; the traveller says: "${prefs.notes}"` : ''}`;
}

/** Rules for the itinerary itself (kids, travel tolerance, notes). '' when nothing to add. */
function formatPrefsForItinerary(prefs) {
  if (!prefs) return '';
  const lines = [`- Travelling: ${describePrefs(prefs)}.`];
  if (prefs.kids.length) {
    const youngest = Math.min(...prefs.kids);
    lines.push(`- Children (youngest ${youngest}): kid-friendly activities, no early starts${youngest < 6 ? ', a rest/nap window after lunch' : ''}, short walks, easy food options, nothing unsafe for their age.`);
  }
  return `

WHO IS TRAVELLING — plan around this:
${lines.join('\n')}`;
}

// ─── Proposing routes (POST /route-plan) ────────────────────────────────────

const OPTIONS_SCHEMA = `{
  "options": [
    {
      "name": "short name for this route, 2–5 words",
      "summary": "one sentence on the shape of the trip",
      "bases": [
        {
          "name": "Town or village to stay in",
          "region": "province/state",
          "country": "country",
          "lat": 0.0,
          "lng": 0.0,
          "days": 3,
          "why": "one sentence: why stay here",
          "stayType": "e.g. family-run guesthouse, farm stay, boutique homestay",
          "transferIn": { "mode": "train|bus|car|ferry|flight|walk|other", "hours": 2.5, "note": "short practical tip" },
          "dayTrips": [{ "name": "Nearby place", "why": "one short line" }]
        }
      ]
    }
  ]
}`;

/**
 * @param {object} input validated request: { destination, days, travelStyle[], travelPace,
 *   interests, travelDate, userLocation, prefs, count, avoid[] }
 */
function buildRouteOptionsPrompt(input) {
  const styles = input.travelStyle?.length ? input.travelStyle.join(', ') : 'balanced';
  const count = input.count || 3;
  return `Suggest ${count} different ROUTES (not daily activities) for a ${input.days}-day slow-travel trip to ${input.destination}, so the traveller can pick one without doing research.

Traveller: ${describePrefs(input.prefs)}. Style ${styles}; pace ${input.travelPace || 'balanced'}${input.interests ? `; interests: ${input.interests}` : ''}${input.travelDate ? `; starting ${input.travelDate}` : ''}${input.userLocation ? `; travelling from ${input.userLocation}` : ''}.
${input.avoid?.length ? `Do not repeat these routes they already saw: ${input.avoid.join('; ')}.\n` : ''}
Rules for every route:
- ${input.days <= 4 ? 'Trips of 4 days or less: 1 base.' : `At most ${Math.ceil(input.days / 2.5)} stops; fewer moves is better — this is slow travel.`} A stop may be visited twice (e.g. back to the arrival city before flying out).
- Respect the traveller's travel-time limit for every transfer${input.prefs?.kids?.length ? ' and keep it easy for the children' : ''}.
- Prefer small towns, villages and nature over big cities; big cities only to arrive/leave or if their interests need it.
- Order stops so travel is short and logical. "days" in each route must add up to exactly ${input.days}; the first day at each later stop is its travel day.
- transferIn: how to get there from the previous stop (null for the first), realistic door-to-door hours.
- 2–3 dayTrips per stop, each under ~1.5 h away. Real places only. lat/lng of the stop town.
- Make the ${count} routes genuinely different (regions, pace, or style), each one that fits the traveller.

Return ONLY this JSON (no other text):
${OPTIONS_SCHEMA}`;
}

/** Longest transfer of a route, in hours (0 for a single stop). */
const longestTransfer = (bases) => Math.max(0, ...(bases || []).map(b => b.transferIn?.hours || 0));

/**
 * Parse Claude's answer into sanitised route options. Throws when nothing usable came back.
 * @returns {object[]} [{ id, name, summary, source: 'ai', longestTransferHours, bases }]
 */
function parseRouteOptions(text, totalDays) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in route response');
  const parsed = JSON.parse(match[0]);
  const list = Array.isArray(parsed.options) ? parsed.options : (Array.isArray(parsed.bases) ? [parsed] : []);
  const options = [];
  for (const [i, o] of list.entries()) {
    const route = sanitizeRoute(o, totalDays);
    if (!route) continue;
    options.push({
      id: `ai-${i + 1}`,
      name: str(o.name, 60) || `Route ${i + 1}`,
      summary: str(o.summary, 240),
      source: 'ai',
      longestTransferHours: longestTransfer(route.bases),
      bases: route.bases,
    });
  }
  if (!options.length) throw new Error('Route response had no usable options');
  return options.slice(0, 3);
}

module.exports = {
  MAX_BASES,
  sanitizeRoute,
  balanceDays,
  dayPlan,
  daysForBase,
  basesForDays,
  formatRouteOverview,
  formatRouteForDays,
  sanitizePrefs,
  describePrefs,
  formatPrefsForItinerary,
  buildRouteOptionsPrompt,
  parseRouteOptions,
  longestTransfer,
};
