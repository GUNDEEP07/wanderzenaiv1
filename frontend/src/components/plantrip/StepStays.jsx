import { addDaysIso } from '../../utils/tripDates';
import { formatRange } from '../../utils/dateRange';

/**
 * Step 4 — Stays & flights (optional; Nov 2026 redesign). Follows the route: one stay per
 * stop with its own nights, and search links opened with that town, those dates and the
 * group size. Flights go from home into the first stop and back from the last.
 * Nothing here is invented: no prices — the booking sites show real ones.
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
};

export default function StepStays({ stops, startDate, endDate, days, adults = 2, origin = '', onOrigin, alreadyBooked, onAlreadyBooked }) {
  const plan = stayPlan(stops, startDate, days);
  const first = stops[0];
  const last = stops[stops.length - 1];

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
          {plan.filter(st => st.nights > 0).map(st => {
            const links = stayLinks(st, adults);
            return (
              <section key={`${st.name}-${st.fromDay}`} style={s.card} aria-label={`Stay in ${st.name}`}>
                <div style={s.head}>
                  <h2 style={s.h2}>{st.name}</h2>
                  <span style={s.meta}>{st.nights} night{st.nights > 1 ? 's' : ''}{st.checkin ? ` · ${formatRange(st.checkin, st.checkout)}` : ''}</span>
                </div>
                {st.stayType && <div style={s.type}>{st.stayType.charAt(0).toUpperCase() + st.stayType.slice(1)}</div>}
                {st.why && <p style={s.why}>{st.why}</p>}
                <div style={s.links}>
                  <a href={links.airbnb} target="_blank" rel="noopener noreferrer" style={s.link} aria-label={`Search Airbnb in ${st.name}${st.checkin ? ` for ${formatRange(st.checkin, st.checkout)}` : ''}`}>Airbnb</a>
                  <a href={links.booking} target="_blank" rel="noopener noreferrer" style={s.link} aria-label={`Search Booking.com in ${st.name}${st.checkin ? ` for ${formatRange(st.checkin, st.checkout)}` : ''}`}>Booking.com</a>
                </div>
              </section>
            );
          })}

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
            <a href={flightsUrl({ from: origin.trim(), firstStop: first, lastStop: last, startDate, endDate })} target="_blank" rel="noopener noreferrer" style={s.primary}>Search Google Flights</a>
          </section>
          <p style={s.note}>Links open the booking sites with your town, dates and group filled in; prices are theirs, live.</p>
        </>
      )}
    </div>
  );
}
