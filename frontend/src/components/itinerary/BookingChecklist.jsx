// "Book your trip" — design C2 (approved Nov 16 2026): one checklist on the trip page, a row
// per base in route order (nights, the stay type we suggested, partner links) plus flights.
// Ticks are kept in this browser only. Never prices: the booking sites show real ones.
import { useState } from 'react';
import { routeStops } from '../../utils/tripPlan';
import { stayPlan, flightsUrl } from '../plantrip/StepStays';
import { bookingUrl, toursUrl, hasPartnerIds } from '../../utils/partnerLinks';

const s = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18, marginBottom: 16 },
  heading: { margin: '0 0 4px', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00d4aa' },
  sub: { margin: '0 0 12px', fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' },
  check: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, cursor: 'pointer', flex: '1 1 260px', fontSize: 15, color: 'rgba(255,255,255,0.9)' },
  box: { width: 20, height: 20, accentColor: '#00d4aa', flexShrink: 0 },
  meta: { display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.68)' },
  links: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  link: { minHeight: 40, display: 'inline-flex', alignItems: 'center', padding: '0 14px', borderRadius: 10, border: '1px solid rgba(0,212,170,0.35)', color: '#00d4aa', textDecoration: 'none', fontSize: 14, fontWeight: 700 },
  note: { margin: '12px 0 0', fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.6)' },
};

const storeKey = (id) => `wz_booked_${id}`;
function loadTicks(id) {
  try { return new Set(JSON.parse(localStorage.getItem(storeKey(id)) || '[]')); } catch { return new Set(); }
}

/**
 * @param {{ tripId: string, itinerary: object, travelDate?: string|null, adults?: number, from?: string }} props
 */
export default function BookingChecklist({ tripId, itinerary, travelDate = null, adults = 2, from = '' }) {
  const [ticks, setTicks] = useState(() => loadTicks(tripId));
  const route = routeStops(itinerary);
  if (!route.length) return null;
  const totalDays = route[route.length - 1].to;
  const stays = stayPlan(route.map(b => ({ ...b, fromDay: b.from, toDay: b.to })), travelDate || '', totalDays)
    .filter(st => st.nights > 0);
  // The same town visited twice (Hanoi → Sapa → Hanoi) is two separate bookings.
  const rows = stays.map((st, i) => ({ ...st, key: `stay-${i}-${st.name}` }));

  const toggle = (key) => {
    const next = new Set(ticks);
    if (next.has(key)) next.delete(key); else next.add(key);
    setTicks(next);
    try { localStorage.setItem(storeKey(tripId), JSON.stringify([...next])); } catch { /* private mode */ }
  };

  const place = (st) => [st.name, st.country].filter(Boolean).join(', ');
  const flights = flightsUrl({ from, firstStop: route[0], lastStop: route[route.length - 1], startDate: travelDate || '', endDate: '' });

  return (
    <section style={s.card} aria-labelledby="wz-book">
      <h2 id="wz-book" style={s.heading}>Book your trip</h2>
      <p style={s.sub}>{rows.length} {rows.length === 1 ? 'stay' : 'stays'} in route order, then flights. Tick each off as you book.</p>
      {rows.map(st => (
        <div key={st.key} style={s.row}>
          <label style={s.check}>
            <input type="checkbox" style={s.box} checked={ticks.has(st.key)} onChange={() => toggle(st.key)} />
            <span>
              <strong>{st.name}</strong> · {st.nights} {st.nights === 1 ? 'night' : 'nights'}
              <span style={s.meta}>{st.stay?.type ? `Suggested: ${st.stay.type}` : `Days ${st.fromDay}–${st.toDay}`}{st.checkin ? ` · ${st.checkin} → ${st.checkout}` : ''}</span>
            </span>
          </label>
          <div style={s.links}>
            <a style={s.link} href={bookingUrl({ place: place(st), checkin: st.checkin, checkout: st.checkout, adults })} target="_blank" rel="noopener noreferrer sponsored">Stays</a>
            <a style={s.link} href={toursUrl({ place: place(st), date: st.checkin })} target="_blank" rel="noopener noreferrer sponsored">Tours</a>
          </div>
        </div>
      ))}
      <div style={s.row}>
        <label style={s.check}>
          <input type="checkbox" style={s.box} checked={ticks.has('flights')} onChange={() => toggle('flights')} />
          <span>
            <strong>Flights</strong> to {route[0].name}{route[route.length - 1].name !== route[0].name ? `, home from ${route[route.length - 1].name}` : ''}
            {!travelDate && <span style={s.meta}>Add your start date to search with dates.</span>}
          </span>
        </label>
        <div style={s.links}>
          <a style={s.link} href={flights} target="_blank" rel="noopener noreferrer">Flights</a>
        </div>
      </div>
      <p style={s.note}>
        {hasPartnerIds()
          ? 'Some of these are partner links: if you book, we may earn a small commission at no extra cost to you. It never changes what we recommend.'
          : 'These open searches on the booking sites with your towns and dates. We don’t earn anything from them.'}
      </p>
    </section>
  );
}
