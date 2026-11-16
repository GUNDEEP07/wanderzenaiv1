'use strict';

/**
 * Free trips show Day 1; the rest unlocks with a paid itinerary (Nov 16 2026).
 *
 * The generator still writes the whole trip, so unlocking is instant. Locking happens where a
 * trip LEAVES the system — GET /itinerary, live progress, the PDF and its email — so the hidden
 * days never reach a browser (no CSS-only blur that "view source" would undo). The trip page
 * draws locked days as blurred placeholders from the teaser fields kept here.
 *
 * A trip is locked when it was made on the free allowance (submissions.plan = 'free') and has
 * not been unlocked (submissions.unlocked_at). Unlocking keeps plan = 'free' so the monthly
 * free allowance still counts it (POST /itinerary/{id}/unlock, form-handler unlock.js).
 * The column creates itself on first use; infra/migrations/010_add_trip_unlock.sql documents it.
 */

const FREE_VISIBLE_DAYS = 1;
const ENSURE_UNLOCK_COLUMN_SQL = 'ALTER TABLE submissions ADD COLUMN IF NOT EXISTS unlocked_at TIMESTAMPTZ';

let ensured = null;
/** Make sure submissions.unlocked_at exists (once per container). */
function ensureUnlockColumn(db) {
  if (!ensured) ensured = db.query(ENSURE_UNLOCK_COLUMN_SQL).catch((err) => { ensured = null; throw err; });
  return ensured;
}

/**
 * @param {{ plan?: string, unlocked_at?: Date|string|null }} row  a submissions row
 * @returns {boolean}
 */
const isLocked = (row) => !!row && row.plan === 'free' && !row.unlocked_at;

const count = (v) => (Array.isArray(v) ? v.length : 0);

/**
 * The trip as a free viewer may see it: everything about Day 1, the route and the headline
 * numbers; later days reduced to a teaser (number, theme, base); stays, tips and traps held
 * back (counted, so the page can say what unlocking adds).
 * @param {object} itinerary  itinerary_data
 * @param {{ visibleDays?: number }} [opts]
 * @returns {object} a new object; the input is not changed
 */
function lockItinerary(itinerary, { visibleDays = FREE_VISIBLE_DAYS } = {}) {
  const src = itinerary && typeof itinerary === 'object' ? itinerary : {};
  const days = Array.isArray(src.days) ? src.days : [];
  const sorted = [...days].sort((a, b) => (a?.dayNumber || 0) - (b?.dayNumber || 0));
  const open = sorted.slice(0, visibleDays);
  const shut = sorted.slice(visibleDays).map((d) => ({
    dayNumber: d?.dayNumber,
    theme: typeof d?.theme === 'string' ? d.theme : null,
    base: typeof d?.base === 'string' ? d.base : null,
    travelDay: !!d?.travelDay,
    locked: true,
  }));
  return {
    title: src.title,
    summary: src.summary,
    totalEstimatedCost: src.totalEstimatedCost,
    ...(src.route ? { route: src.route } : {}),
    ...(src.currency ? { currency: src.currency } : {}),
    days: [...open, ...shut],
    locked: {
      visibleDays: open.length,
      totalDays: sorted.length,
      stays: count(src.stays) || (src.accommodation ? 1 : 0),
      tips: count(src.practicalTips),
      avoid: count(src.avoidList),
    },
  };
}

/**
 * Live-progress days (progress.js shape { day, theme, base, travelDay, stops, eat }) for a
 * locked trip: Day 1 as written, later days as teasers.
 */
function lockProgressDays(days = [], { visibleDays = FREE_VISIBLE_DAYS } = {}) {
  return (Array.isArray(days) ? days : []).map((d) => (Number(d?.day) <= visibleDays
    ? d
    : { day: d?.day, theme: d?.theme || null, base: d?.base || null, travelDay: !!d?.travelDay, locked: true }));
}

module.exports = {
  FREE_VISIBLE_DAYS,
  ENSURE_UNLOCK_COLUMN_SQL,
  ensureUnlockColumn,
  isLocked,
  lockItinerary,
  lockProgressDays,
  _reset: () => { ensured = null; },
};
