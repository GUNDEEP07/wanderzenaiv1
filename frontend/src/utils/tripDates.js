/**
 * Trip length ↔ dates for the planner. Step 1 asks how many days; step 2's end date is
 * filled from that, and changing the end date changes the length (2–30 days).
 * All dates are YYYY-MM-DD on the local calendar (no UTC shift).
 */
import { calculateTripDays } from './validators/dateValidator';

export const MIN_DAYS = 2;
export const MAX_DAYS = 30;

const pad2 = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const valid = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso || '');

export const todayIso = (now = new Date()) => isoOf(now);

export function addDaysIso(iso, n) {
  if (!valid(iso)) return '';
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

/** Last day of a `days`-day trip starting on `start` ('' without a start). */
export const endDateFor = (start, days) => (valid(start) ? addDaysIso(start, days - 1) : '');

/** Trip length for a new end date; keeps `current` when the span is outside 2–30 days. */
export function daysForEnd(start, end, current) {
  const span = calculateTripDays(start, end);
  return span >= MIN_DAYS && span <= MAX_DAYS ? span : current;
}

/** "5 days · Fri 25 Dec – Tue 29 Dec" */
export function tripDatesText(start, end) {
  if (!valid(start) || !valid(end)) return '';
  const n = calculateTripDays(start, end);
  const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return n > 0 ? `${n} day${n > 1 ? 's' : ''} · ${fmt(start)} – ${fmt(end)}` : '';
}
