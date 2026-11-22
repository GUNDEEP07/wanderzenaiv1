// Trip companion (Nov 22 2026): which of the user's trips the dashboard chat talks about.
// Same rule as the backend's pickCompanionTrip (layers/shared/nodejs/trip-context.js) — keep
// them in step: a delivered trip happening now or still ahead (soonest first), else the newest
// delivered trip without dates from the last 120 days.

const DAY_MS = 24 * 60 * 60 * 1000;
const UNDATED_WINDOW_DAYS = 120;

const parse = (v) => {
  if (!v) return null;
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00Z` : v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dayStart = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Trips from GET /profile (pastTrips: id, destination, days, status, travelDate, createdAt). */
export function companionTrip(trips, now = new Date()) {
  const today = dayStart(now);
  const delivered = (Array.isArray(trips) ? trips : []).filter((t) => t && t.status === 'email_sent');
  const dated = delivered
    .map((t) => ({ t, start: parse(t.travelDate) }))
    .filter((x) => x.start && dayStart(x.start) + (Math.max(1, Number(x.t.days) || 1) - 1) * DAY_MS >= today)
    .sort((a, b) => a.start - b.start);
  if (dated.length) return dated[0].t;
  const undated = delivered
    .filter((t) => !parse(t.travelDate))
    .map((t) => ({ t, made: parse(t.createdAt) }))
    .filter((x) => x.made && today - dayStart(x.made) <= UNDATED_WINDOW_DAYS * DAY_MS)
    .sort((a, b) => b.made - a.made);
  return undated.length ? undated[0].t : null;
}

/** "Queenstown" from "Queenstown, New Zealand". */
export function tripPlace(trip) {
  return String(trip?.destination || '').split(',')[0].trim() || 'your';
}

/** Starter questions for a trip. */
export function tripSuggestions(trip) {
  return [
    'What should I pack for this trip?',
    'What should I book before I go?',
    'Rainy-day plan for Day 2?',
    'How do I get between my stops?',
    'Where can I eat near my stay?',
  ].concat(trip?.locked ? ['What do I get if I unlock every day?'] : []);
}
