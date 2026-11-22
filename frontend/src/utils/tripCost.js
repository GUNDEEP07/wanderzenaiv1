import { formatPrice } from '../api/pricing';

/**
 * Trip cost ESTIMATE for the planner's Stays & flights step (Nov 22 2026, design "Estimated cost").
 * Inputs are typical prices from destination insights (never live quotes); the UI says so.
 *
 * plan:        stayPlan() rows ({ name, country, nights }) in route order
 * estimates:   label → { currency, stays: [{ style, label, low, high }], flights: { cheapest, direct, note } | null }
 * stayChoices: label → chosen style (default: the first option)
 * flightChoice: 'cheapest' | 'direct'
 * Rooms: one per two adults (children share). Flights: per seat, adults + children.
 */
export function tripCost({ plan = [], estimates = {}, stayChoices = {}, flightChoice = 'cheapest', adults = 2, kids = 0, firstLabel = '' }) {
  const rooms = Math.max(1, Math.ceil((Number(adults) || 1) / 2));
  const seats = Math.max(1, (Number(adults) || 1) + (Number(kids) || 0));
  const stays = [];
  let missing = 0;
  for (const st of plan) {
    if (!st.nights) continue;
    const label = [st.name, st.country].filter(Boolean).join(', ');
    const opts = estimates[label]?.stays || [];
    const opt = opts.find((o) => o.style === stayChoices[label]) || opts[0];
    if (!opt) { missing += 1; continue; }
    stays.push({ label, name: st.name, nights: st.nights, option: opt, low: opt.low * st.nights * rooms, high: opt.high * st.nights * rooms });
  }
  const f = estimates[firstLabel]?.flights || null;
  const fare = f ? ((flightChoice === 'direct' && f.direct) || f.cheapest) : null;
  const flights = fare ? { kind: flightChoice === 'direct' && f.direct ? 'direct' : 'cheapest', perPerson: fare, seats, low: fare.low * seats, high: fare.high * seats } : null;
  const low = stays.reduce((a, x) => a + x.low, 0) + (flights?.low || 0);
  const high = stays.reduce((a, x) => a + x.high, 0) + (flights?.high || 0);
  return { rooms, seats, stays, flights, missingStays: missing, low, high, mid: Math.round((low + high) / 2 / 10) * 10 };
}

/** Against a whole-trip budget: what's left for food and activities, or how far over. */
export function budgetCheck(cost, budget, budgetScope, days) {
  const b = Number(budget);
  if (!b || budgetScope !== 'full-trip' || !cost?.mid) return null;
  const left = b - cost.mid;
  return { budget: b, left, perDay: days ? Math.round(left / days) : null, over: left < 0 };
}

/** "A$180" (symbol only) and "A$180 AUD" (with the code). */
export const money = (n, cur) => formatPrice(Math.round(n), cur).replace(/\s[A-Z]{3}$/, '');
export const moneyCode = (n, cur) => formatPrice(Math.round(n), cur);
