import { plainText } from '../../utils/plainText';
import { budgetRows, formatMoney, routeStops, toAmount } from '../../utils/tripPlan';

const s = {
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '18px 18px', marginBottom: 16 },
  heading: { margin: '0 0 12px', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#00d4aa' },
  base: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.06)' },
  baseDays: { width: 72, flexShrink: 0, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)' },
  baseName: { fontSize: 15, fontWeight: 700 },
  baseSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 },
  barRow: { display: 'grid', gridTemplateColumns: '56px 1fr 72px', gap: 10, alignItems: 'center', fontSize: 14, minHeight: 28 },
  barTrack: { height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)' },
  note: { margin: '12px 0 0', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' },
  list: { margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.82)' },
};

const TIER = { budget: 'budget', mid: 'mid-range', upscale: 'upscale' };

/** Route (with where to stay), budget by day, tips and traps — the "whole trip" view. */
export default function TripOverview({ itinerary, currency, onPickDay }) {
  const route = routeStops(itinerary);
  const rows = budgetRows(itinerary);
  const max = Math.max(1, ...rows.map(r => r.total));
  const daysTotal = rows.reduce((a, r) => a + r.total, 0);
  const tripEstimate = toAmount(itinerary?.totalEstimatedCost);
  const gap = tripEstimate - daysTotal;

  return (
    <>
      {route.length > 0 && (
        <section style={s.card} aria-labelledby="wz-route">
          <h2 id="wz-route" style={s.heading}>Your route &amp; where to stay</h2>
          {route.map(b => (
            <div key={`${b.name}-${b.from}`} style={s.base}>
              <span style={s.baseDays}>{b.from === b.to ? `Day ${b.from}` : `Days ${b.from}–${b.to}`}</span>
              <div style={{ minWidth: 0 }}>
                <div style={s.baseName}>{b.name}</div>
                {b.transferIn && <div style={s.baseSub}>Arrive by {b.transferIn.mode}{b.transferIn.hours ? ` (~${b.transferIn.hours} h)` : ''}</div>}
                {b.stay && (
                  <div style={s.baseSub}>
                    Stay: {b.stay.type}{b.stay.priceTier ? ` · ${TIER[b.stay.priceTier] || b.stay.priceTier}` : ''}
                    {b.stay.why ? ` — ${plainText(b.stay.why)}` : ''}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {daysTotal > 0 && (
        <section style={s.card} aria-labelledby="wz-budget">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h2 id="wz-budget" style={s.heading}>Budget by day</h2>
            {tripEstimate > 0 && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 12 }}>Trip estimate {formatMoney(tripEstimate, currency)}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map(r => (
              <button key={r.dayNumber} type="button" onClick={() => onPickDay?.(r.dayNumber)}
                aria-label={`Day ${r.dayNumber}: ${formatMoney(r.total, currency) || 'no cost listed'}. Activities ${formatMoney(r.acts, currency) || 'free'}, food ${formatMoney(r.food, currency) || 'none listed'}. Open this day.`}
                style={{ ...s.barRow, background: 'none', border: 'none', color: '#fff', padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ color: 'rgba(255,255,255,0.75)' }}>Day {r.dayNumber}</span>
                <span style={s.barTrack}><span style={{ display: 'block', height: 8, borderRadius: 4, background: '#00d4aa', width: `${Math.round((r.total / max) * 100)}%` }} /></span>
                <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatMoney(r.total, currency) || '—'}</span>
              </button>
            ))}
          </div>
          <p style={s.note}>
            {gap > 0.5
              ? `The trip estimate also covers about ${formatMoney(gap, currency)} not in the daily bars — mostly stays and transfers between towns.`
              : 'Daily totals include activities, food and getting around.'} Prices are estimates; check before you book.
          </p>
        </section>
      )}

      {itinerary?.practicalTips?.length > 0 && (
        <section style={s.card} aria-labelledby="wz-tips">
          <h2 id="wz-tips" style={s.heading}>Slow travel tips</h2>
          <ul style={s.list}>{itinerary.practicalTips.map((t, i) => <li key={i}>{plainText(t)}</li>)}</ul>
        </section>
      )}
      {itinerary?.avoidList?.length > 0 && (
        <section style={s.card} aria-labelledby="wz-avoid">
          <h2 id="wz-avoid" style={{ ...s.heading, color: '#ff9b9b' }}>Skip these tourist traps</h2>
          <ul style={s.list}>{itinerary.avoidList.map((t, i) => <li key={i}>{plainText(t)}</li>)}</ul>
        </section>
      )}
    </>
  );
}
