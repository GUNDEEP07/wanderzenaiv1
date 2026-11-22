import { fetchDestinationInsights } from './destinationInsights';
import { addDaysIso, todayIso } from '../utils/tripDates';

/**
 * One destination-insights request per route stop, shared by the planner's Must-sees step (ideas)
 * and Stays & flights (cost estimates), so both steps reuse the same answer. The home city goes
 * with the FIRST stop only (that's where the flights land), so later stops share one cache entry.
 */
const cache = new Map();
export function _clearStopInsights() { cache.clear(); }

export const stopLabel = (stop) => [stop?.name, stop?.country].filter(Boolean).join(', ');

/** Travel dates for a stop; undated trips plan for a month from now. */
export function stopDates(stop, startDate) {
  const start = startDate ? addDaysIso(startDate, stop.fromDay - 1) : addDaysIso(todayIso(), 30);
  return { start, end: addDaysIso(start, Math.max(0, stop.toDay - stop.fromDay)) };
}

export function stopInsights(stop, { index = 0, startDate = '', travelStyles = [], currency = '', from = '' } = {}) {
  const label = stopLabel(stop);
  const { start, end } = stopDates(stop, startDate);
  const home = index === 0 ? String(from || '').trim() : '';
  const key = [label, String(start).slice(0, 7), (travelStyles || []).join(','), currency, home.toLowerCase()].join('|');
  if (!cache.has(key)) {
    const p = fetchDestinationInsights(label, travelStyles, start, end, { currency, from: home })
      .catch((e) => { cache.delete(key); throw e; });
    cache.set(key, p);
  }
  return cache.get(key);
}
