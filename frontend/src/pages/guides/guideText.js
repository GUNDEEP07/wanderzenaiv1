/** Small text helpers for the country guides (pure; unit-tested). */

/** 0.75 → "45 min", 2 → "2 h", 2.5 → "2 h 30 min". */
export function formatHours(h) {
  const mins = Math.round((Number(h) || 0) * 60);
  if (mins <= 0) return '';
  const hh = Math.floor(mins / 60), mm = mins % 60;
  if (!hh) return `${mm} min`;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

const MODES = { bus: 'Bus', train: 'Train', flight: 'Flight', car: 'Car', ferry: 'Ferry', boat: 'Boat' };
export const modeLabel = (m) => MODES[m] || (m ? m[0].toUpperCase() + m.slice(1) : 'Transfer');

/** Day ranges per stop: [{from:1,to:2},{from:3,to:5}…] */
export function dayRanges(stops = []) {
  let d = 1;
  return stops.map((s) => {
    const r = { from: d, to: d + Math.max(1, s.days) - 1 };
    d = r.to + 1;
    return r;
  });
}

export const dayLabel = ({ from, to }) => (from === to ? `Day ${from}` : `Days ${from}–${to}`);

/** "8–10 days" (or "9 days") across a country's routes. */
export function daysSpan(routes = []) {
  const ds = routes.map((r) => r.days);
  if (!ds.length) return '';
  const lo = Math.min(...ds), hi = Math.max(...ds);
  return lo === hi ? `${lo} days` : `${lo}–${hi} days`;
}

/** Distinct place names along a route, in order ("Hanoi → Sapa → Hoi An"). */
export const routeLine = (stops = []) => stops.map((s) => s.name).filter((n, i, a) => a[i - 1] !== n).join(' → ');

const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
export const countWord = (n) => NUM[n] || String(n);
