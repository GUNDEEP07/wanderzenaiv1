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

// ─── Proposing a route (POST /route-plan) ────────────────────────────────────

const ROUTE_SCHEMA = `{
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
}`;

/**
 * @param {object} input validated request: { destination, days, travelStyle[], travelPace,
 *   interests, travelDate, userLocation }
 */
function buildRoutePrompt(input) {
  const styles = input.travelStyle?.length ? input.travelStyle.join(', ') : 'balanced';
  return `Plan the ROUTE (not the daily activities) for a ${input.days}-day slow-travel trip to ${input.destination}.

Traveller: style ${styles}; pace ${input.travelPace || 'balanced'}${input.interests ? `; interests: ${input.interests}` : ''}${input.travelDate ? `; starting ${input.travelDate}` : ''}${input.userLocation ? `; travelling from ${input.userLocation}` : ''}.

Rules:
- Choose 1 base if the destination is a single town or the trip is 4 days or less; otherwise 2–4 bases (never more than one new base per 3 days). Fewer moves is better — this is slow travel.
- Prefer small towns, villages and nature over big cities; a big city only as an arrival/departure base or if the traveller's interests need it.
- Order the bases so travel between them is short and logical (no back-tracking). Put the arrival city first if the trip needs one.
- "days" across all bases must add up to exactly ${input.days}. The first day at each later base is the travel day.
- transferIn is how to get to this base from the previous one (null for the first base). Realistic hours.
- 2–3 dayTrips per base, each under ~1.5 h away. Real places only.
- lat/lng: the base town's coordinates.

Return ONLY this JSON (no other text):
${ROUTE_SCHEMA}`;
}

/** Parse Claude's answer into a sanitised route. Throws when nothing usable came back. */
function parseRouteResponse(text, totalDays) {
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in route response');
  const parsed = JSON.parse(match[0]);
  const route = sanitizeRoute(parsed, totalDays);
  if (!route) throw new Error('Route response had no usable bases');
  return { ...route, summary: str(parsed.summary, 240) };
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
  buildRoutePrompt,
  parseRouteResponse,
};
