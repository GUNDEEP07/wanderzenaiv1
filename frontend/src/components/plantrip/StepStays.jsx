import { useEffect, useState } from 'react';
import { addDaysIso } from '../../utils/tripDates';
import { formatRange } from '../../utils/dateRange';
import { stopInsights, stopLabel, stopDates } from '../../api/stopInsights';
import { tripCost, budgetCheck, money, moneyCode } from '../../utils/tripCost';

/**
 * Step 4 — Stays & flights (optional; Nov 2026 redesign). Follows the route: one stay per
 * stop with its own nights, and search links opened with that town, those dates and the
 * group size. Flights go from home into the first stop and back from the last.
 *
 * Estimated cost (Nov 22 2026, chosen by Gundeep): each stop offers three stay styles with
 * typical prices per night, flights offer "cheapest seen" / "direct", and the step adds them up
 * against the budget. These are ESTIMATES from destination insights (typical prices for the travel
 * month, in the trip's currency), labelled as such everywhere; live prices stay on the booking
 * sites. The chosen style becomes that stop's stayType, which the generator follows.
 */

/** Nights at each stop: you sleep at a stop every day you're there, except the last day of the trip. */
export function stayPlan(stops, startDate, totalDays) {
  return stops.map((st, i) => {
    const lastStop = i === stops.length - 1;
    const lastNightDay = lastStop ? Math.min(st.toDay, totalDays - 1) : st.toDay;
    const nights = Math.max(0, lastNightDay - st.fromDay + 1);
    const checkin = startDate ? addDaysIso(startDate, st.fromDay - 1) : '';
    const checkout = startDate && nights ? addDaysIso(startDate, st.fromDay - 1 + nights) : '';
    return { ...st, nights, checkin, checkout };
  });
}

export function stayLinks(stay, adults = 2) {
  const place = [stay.name, stay.country].filter(Boolean).join(', ');
  const air = new URL(`https://www.airbnb.com/s/${encodeURIComponent(place)}/homes`);
  const booking = new URL('https://www.booking.com/searchresults.html');
  booking.searchParams.set('ss', place);
  if (stay.checkin && stay.checkout) {
    air.searchParams.set('checkin', stay.checkin);
    air.searchParams.set('checkout', stay.checkout);
    booking.searchParams.set('checkin', stay.checkin);
    booking.searchParams.set('checkout', stay.checkout);
  }
  air.searchParams.set('adults', String(adults));
  booking.searchParams.set('group_adults', String(adults));
  return { airbnb: air.toString(), booking: booking.toString() };
}

export function flightsUrl({ from, firstStop, lastStop, startDate, endDate }) {
  const to = [firstStop?.name, firstStop?.country].filter(Boolean).join(', ');
  const back = lastStop && lastStop.name !== firstStop?.name ? ` returning from ${[lastStop.name, lastStop.country].filter(Boolean).join(', ')}` : ' return';
  const text = `flights ${from ? `from ${from} ` : ''}to ${to}${startDate ? ` on ${startDate}` : ''}${back}${endDate ? ` on ${endDate}` : ''}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(text)}`;
}

const s = {
  card: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  h2: { margin: 0, fontSize: 17, fontWeight: 800 },
  meta: { fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  type: { fontSize: 15, fontWeight: 700, color: '#00d4aa' },
  why: { margin: 0, fontSize: 14, lineHeight: 1.5, color: 'rgba(255,255,255,0.8)' },
  links: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 },
  link: { minHeight: 44, borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 48, borderRadius: 12, background: '#00d4aa', color: '#06090f', textDecoration: 'none', fontWeight: 800, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.78)' },
  input: { minHeight: 46, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: '#0a0f1e', color: '#fff', padding: '0 12px', fontFamily: 'inherit', fontSize: 15, width: '100%', boxSizing: 'border-box' },
  check: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 15, color: 'rgba(255,255,255,0.88)', cursor: 'pointer', marginBottom: 8 },
  note: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 },
  opts: { border: 'none', margin: '4px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  legend: { fontSize: 13, color: 'rgba(255,255,255,0.72)', marginBottom: 4, padding: 0 },
  opt: (on) => ({ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 12px', borderRadius: 12, border: `1px solid ${on ? '#00d4aa' : 'rgba(255,255,255,0.14)'}`, background: on ? 'rgba(0,212,170,0.08)' : 'transparent', cursor: 'pointer', fontSize: 14 }),
  optPrice: { marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', fontSize: 13 },
  total: { background: 'linear-gradient(135deg, rgba(0,212,170,0.14), rgba(0,212,170,0.04))', border: '1px solid rgba(0,212,170,0.4)', borderRadius: 16, padding: 16, marginBottom: 12 },
  totalRow: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 14, color: 'rgba(255,255,255,0.85)', padding: '3px 0' },
  big: { fontSize: 24, fontWeight: 800, margin: '6px 0 2px' },
  ok: { color: '#7ff0d6', fontWeight: 700, fontSize: 14 },
  over: { color: '#fca5a5', fontWeight: 700, fontSize: 14 },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (iso) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '');

/** Debounce typing in the From box so each keystroke doesn't fetch a new fare estimate. */
function useSettled(value, ms = 700) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function StepStays({
  stops, startDate, endDate, days, adults = 2, kids = 0, origin = '', onOrigin, alreadyBooked, onAlreadyBooked,
  travelStyles = [], currency = '', budget = '', budgetScope = 'full-trip',
  stayChoices = {}, onStayChoice, flightChoice = 'cheapest', onFlightChoice,
}) {
  const plan = stayPlan(stops, startDate, days);
  const first = stops[0];
  const last = stops[stops.length - 1];
  const from = useSettled(origin.trim());
  const [estimates, setEstimates] = useState({}); // stop label → estimates | { loading } | { error }

  useEffect(() => {
    if (!currency) return undefined;
    let live = true;
    stops.forEach((stop, index) => {
      const label = stopLabel(stop);
      setEstimates((m) => ({ ...m, [label]: m[label]?.stays ? m[label] : { loading: true } }));
      stopInsights(stop, { index, startDate, travelStyles, currency, from })
        .then((ins) => { if (live) setEstimates((m) => ({ ...m, [label]: ins?.estimates || { error: true } })); })
        .catch(() => { if (live) setEstimates((m) => ({ ...m, [label]: { error: true } })); });
    });
    return () => { live = false; };
  }, [stops.map(stopLabel).join('|'), startDate, currency, from, (travelStyles || []).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const firstLabel = stopLabel(first);
  const cost = tripCost({ plan, estimates, stayChoices, flightChoice, adults, kids, firstLabel });
  const check = budgetCheck(cost, budget, budgetScope, days);
  const month = monthName(stopDates(first || { fromDay: 1, toDay: 1 }, startDate).start);
  const fl = estimates[firstLabel]?.flights;
  const loading = Object.values(estimates).some((e) => e?.loading);

  return (
    <div>
      <label style={s.check}>
        <input type="checkbox" style={{ width: 20, height: 20 }} checked={!!alreadyBooked} onChange={e => onAlreadyBooked(e.target.checked)} />
        I've already booked flights and stays
      </label>

      {alreadyBooked ? (
        <p style={s.note}>Great — we'll plan the days around your bookings. You can mention where you're staying in the last step.</p>
      ) : (
        <>
          <section style={s.card} aria-label="Flights">
            <h2 style={s.h2}>Flights</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 8 }}>
              <label style={s.label}>From
                <input type="text" style={s.input} value={origin} onChange={e => onOrigin(e.target.value)} placeholder="Your city" maxLength={80} />
              </label>
              <div style={s.label}>Fly into
                <div style={{ ...s.input, display: 'flex', alignItems: 'center' }}>{first?.name}</div>
              </div>
            </div>
            <div style={s.note}>
              {startDate ? `Out ${formatRange(startDate)}` : 'Dates not set'}
              {last && last.name !== first?.name ? ` · home from ${last.name}` : ''}{endDate ? ` ${formatRange(endDate)}` : ''}
            </div>
            {currency && from && (
              fl ? (
                <fieldset style={s.opts}>
                  <legend style={s.legend}>Return, per person (estimate){fl.note ? ` · ${fl.note}` : ''}</legend>
                  {[['cheapest', 'Cheapest usually seen', fl.cheapest], ['direct', 'Direct only', fl.direct]].filter(([, , r]) => r).map(([k, label, r]) => (
                    <label key={k} style={s.opt((cost.flights?.kind || 'cheapest') === k)}>
                      <input type="radio" name="wz-flight" checked={(cost.flights?.kind || 'cheapest') === k} onChange={() => onFlightChoice?.(k)} />
                      {label}
                      <span style={s.optPrice}>~{money(r.low, currency)}–{money(r.high, currency).replace(/^[^0-9]*/, '')}</span>
                    </label>
                  ))}
                </fieldset>
              ) : estimates[firstLabel]?.loading ? <div style={s.note} role="status">Estimating fares…</div> : null
            )}
            <a href={flightsUrl({ from: origin.trim(), firstStop: first, lastStop: last, startDate, endDate })} target="_blank" rel="noopener noreferrer" style={s.primary}>Search Google Flights</a>
          </section>

          {plan.filter(st => st.nights > 0).map(st => {
            const links = stayLinks(st, adults);
            const label = stopLabel(st);
            const est = estimates[label];
            const chosen = cost.stays.find((x) => x.label === label)?.option?.style;
            return (
              <section key={`${st.name}-${st.fromDay}`} style={s.card} aria-label={`Stay in ${st.name}`}>
                <div style={s.head}>
                  <h2 style={s.h2}>{st.name}</h2>
                  <span style={s.meta}>{st.nights} night{st.nights > 1 ? 's' : ''}{st.checkin ? ` · ${formatRange(st.checkin, st.checkout)}` : ''}</span>
                </div>
                {st.why && <p style={s.why}>{st.why}</p>}
                {est?.stays?.length > 0 ? (
                  <fieldset style={s.opts}>
                    <legend style={s.legend}>Stay style · per night, typical</legend>
                    {est.stays.map((o) => (
                      <label key={o.style} style={s.opt(chosen === o.style)}>
                        <input type="radio" name={`wz-stay-${label}`} checked={chosen === o.style} onChange={() => onStayChoice?.(label, o)} />
                        {o.label}
                        <span style={s.optPrice}>~{money(o.low, currency)}–{money(o.high, currency).replace(/^[^0-9]*/, '')}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : est?.loading ? <div style={s.note} role="status">Estimating stay prices…</div>
                  : st.stayType ? <div style={s.type}>{st.stayType.charAt(0).toUpperCase() + st.stayType.slice(1)}</div> : null}
                <div style={s.links}>
                  <a href={links.airbnb} target="_blank" rel="noopener noreferrer" style={s.link} aria-label={`Search Airbnb in ${st.name}${st.checkin ? ` for ${formatRange(st.checkin, st.checkout)}` : ''}`}>Airbnb</a>
                  <a href={links.booking} target="_blank" rel="noopener noreferrer" style={s.link} aria-label={`Search Booking.com in ${st.name}${st.checkin ? ` for ${formatRange(st.checkin, st.checkout)}` : ''}`}>Booking.com</a>
                </div>
              </section>
            );
          })}

          {currency && (cost.stays.length > 0 || cost.flights) && (
            <section style={s.total} aria-label="Estimated trip cost" aria-busy={loading}>
              <div style={s.legend}>Estimated {cost.flights ? 'flights + stays' : 'stays'}{month ? ` · typical ${month} prices` : ''}</div>
              <div style={s.big}>~{moneyCode(cost.mid, currency)}</div>
              <div style={s.note}>Range {money(cost.low, currency)}–{money(cost.high, currency).replace(/^[^0-9]*/, '')}</div>
              <div style={{ marginTop: 10 }}>
                {cost.flights && (
                  <div style={s.totalRow}><span>Flights · {cost.flights.seats} × ~{money((cost.flights.perPerson.low + cost.flights.perPerson.high) / 2, currency)}</span><span>~{money((cost.flights.low + cost.flights.high) / 2, currency)}</span></div>
                )}
                {cost.stays.map((x) => (
                  <div key={x.label} style={s.totalRow}><span>{x.name} · {x.nights} night{x.nights > 1 ? 's' : ''}{cost.rooms > 1 ? ` × ${cost.rooms} rooms` : ''}</span><span>~{money((x.low + x.high) / 2, currency)}</span></div>
                ))}
              </div>
              {check && (
                <div style={{ marginTop: 10, ...(check.over ? s.over : s.ok) }}>
                  {check.over
                    ? `About ${money(-check.left, currency)} over your ${money(check.budget, currency)} budget — try a cheaper stay style or fewer nights.`
                    : `Leaves ~${money(check.left, currency)} of your ${money(check.budget, currency)} budget for food and activities${check.perDay ? ` (~${money(check.perDay, currency)} a day)` : ''}.`}
                </div>
              )}
              {!from && <div style={{ ...s.note, marginTop: 8 }}>Add your city under Flights to include fares.</div>}
              {cost.missingStays > 0 && !loading && <div style={{ ...s.note, marginTop: 8 }}>Some stops have no estimate yet; the total leaves them out.</div>}
              <div style={{ ...s.note, marginTop: 8 }}>Estimates from typical fares and room rates, not live prices. The booking links show real ones.</div>
            </section>
          )}
          <p style={s.note}>Links open the booking sites with your town, dates and group filled in; prices are theirs, live.</p>
        </>
      )}
    </div>
  );
}
