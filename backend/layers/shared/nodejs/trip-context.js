'use strict';

/**
 * Trip companion (Nov 22 2026, option "Trip companion"): the dashboard chat answers questions
 * about the user's upcoming trip. This module picks that trip and turns it into a compact brief
 * for the system prompt.
 *
 * Locked free trips are passed through lockItinerary() first, so days the user hasn't unlocked
 * never reach the model (and so can never be quoted back in a chat reply).
 */

const { lockItinerary } = require('./trip-access');

const DAY_MS = 24 * 60 * 60 * 1000;
const UNDATED_WINDOW_DAYS = 120; // an undated trip counts as "upcoming" for this long after it was made
const MAX_BRIEF_CHARS = 9000;

const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dayStart = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/**
 * The trip the companion talks about, from the user's own submissions (newest first is fine):
 * a delivered trip that is happening now or still ahead, soonest first; otherwise the newest
 * delivered trip without dates made in the last 120 days. Null when there is none.
 * Row fields: id, status, travel_date (or travelDate), days, created_at (or createdAt).
 */
function pickCompanionTrip(rows, now = new Date()) {
  const today = dayStart(now);
  const delivered = (Array.isArray(rows) ? rows : []).filter((r) => r && r.status === 'email_sent');
  const dated = delivered
    .map((r) => ({ r, start: toDate(r.travel_date ?? r.travelDate) }))
    .filter((x) => x.start)
    .filter((x) => dayStart(x.start) + (Math.max(1, Number(x.r.days) || 1) - 1) * DAY_MS >= today)
    .sort((a, b) => a.start - b.start);
  if (dated.length) return dated[0].r;
  const undated = delivered
    .filter((r) => !toDate(r.travel_date ?? r.travelDate))
    .map((r) => ({ r, made: toDate(r.created_at ?? r.createdAt) }))
    .filter((x) => x.made && today - dayStart(x.made) <= UNDATED_WINDOW_DAYS * DAY_MS)
    .sort((a, b) => b.made - a.made);
  return undated.length ? undated[0].r : null;
}

const clip = (s, n) => {
  const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '';
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function activityLine(label, a) {
  if (!a || typeof a !== 'object') return null;
  const what = clip(a.activity, 220);
  if (!what) return null;
  const where = clip(a.venueName || a.location, 80);
  const tip = clip(a.insiderTip, 140);
  return `  ${label}${a.time ? ` ${clip(a.time, 20)}` : ''}: ${what}${where ? ` (${where})` : ''}${tip ? ` Tip: ${tip}` : ''}`;
}

function dateOfDay(start, n) {
  if (!start) return null;
  const d = new Date(dayStart(start) + (n - 1) * DAY_MS);
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Plain-text brief of one trip for the system prompt. `submission`: destination, days,
 * travel_date, traveler_type, currency, plan, unlocked_at. `itinerary`: itineraries.itinerary_data.
 * `locked`: whether the free-trip lock applies (trip-access isLocked).
 */
function tripBrief(submission, itinerary, { locked = false } = {}) {
  const sub = submission || {};
  const it = locked ? lockItinerary(itinerary) : (itinerary && typeof itinerary === 'object' ? itinerary : {});
  const start = toDate(sub.travel_date ?? sub.travelDate);
  const lines = [];
  lines.push(`Trip: ${clip(it.title, 120) || `${sub.destination} trip`}`);
  lines.push(`Destination: ${clip(sub.destination, 120)} · ${sub.days} days · ${start ? `starts ${dateOfDay(start, 1)} ${start.getUTCFullYear()}` : 'dates not fixed yet'}${sub.traveler_type ? ` · ${clip(sub.traveler_type, 60)}` : ''}${sub.currency ? ` · budget currency ${clip(sub.currency, 5)}` : ''}`);
  if (it.summary) lines.push(`Summary: ${clip(it.summary, 400)}`);
  const bases = Array.isArray(it.route?.bases) ? it.route.bases : [];
  if (bases.length) {
    lines.push(`Route: ${bases.map((b) => `${clip(b.name, 60)}${b.nights || b.days ? ` (${b.nights ? `${b.nights} nights` : `${b.days} days`})` : ''}`).join(' → ')}`);
  }
  const days = (Array.isArray(it.days) ? [...it.days] : []).sort((a, b) => (a?.dayNumber || 0) - (b?.dayNumber || 0));
  for (const d of days) {
    if (!d) continue;
    const when = dateOfDay(start, d.dayNumber);
    const head = `Day ${d.dayNumber}${when ? ` (${when})` : ''}${d.base ? ` · ${clip(d.base, 60)}` : ''}${d.travelDay ? ' · travel day' : ''}: ${clip(d.theme, 120)}`;
    if (d.locked) { lines.push(`${head} [LOCKED — details not unlocked]`); continue; }
    lines.push(head);
    for (const [label, key] of [['Morning', 'morningActivity'], ['Afternoon', 'afternoonActivity'], ['Evening', 'eveningActivity']]) {
      const l = activityLine(label, d[key]);
      if (l) lines.push(l);
    }
    if (d.localEats?.name) lines.push(`  Eat: ${clip(d.localEats.name, 80)}${d.localEats.dish ? ` — ${clip(d.localEats.dish, 80)}` : ''}`);
    if (d.hiddenGem) lines.push(`  Hidden gem: ${clip(d.hiddenGem, 160)}`);
  }
  if (Array.isArray(it.stays) && it.stays.length) {
    lines.push('Stays:');
    for (const s of it.stays) lines.push(`  ${clip(s.base, 60)}: ${clip(s.type, 60)}${s.priceTier ? ` (${clip(s.priceTier, 10)})` : ''}${s.why ? ` — ${clip(s.why, 140)}` : ''}`);
  } else if (it.accommodation?.recommendation) {
    lines.push(`Stay: ${clip(it.accommodation.recommendation, 160)}`);
  }
  if (Array.isArray(it.practicalTips) && it.practicalTips.length) lines.push(`Practical tips: ${it.practicalTips.slice(0, 8).map((t) => clip(t, 160)).join(' | ')}`);
  if (Array.isArray(it.avoidList) && it.avoidList.length) lines.push(`Skip: ${it.avoidList.slice(0, 6).map((t) => clip(t, 120)).join(' | ')}`);
  if (locked) lines.push('Note: this is a free trip. Only Day 1 is unlocked; later days show just their theme. The user can unlock every day from the trip page.');
  const text = lines.join('\n');
  return text.length > MAX_BRIEF_CHARS ? `${text.slice(0, MAX_BRIEF_CHARS - 1)}…` : text;
}

module.exports = { pickCompanionTrip, tripBrief, UNDATED_WINDOW_DAYS };
