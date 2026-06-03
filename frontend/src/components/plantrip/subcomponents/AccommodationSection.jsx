import React, { useState } from 'react';

const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}
function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

const TYPE_OPTIONS = [
  { key: 'hotel',    label: '🏨 Hotels' },
  { key: 'airbnb',   label: '🏠 Airbnbs' },
  { key: 'homestay', label: '🤝 Homestays' },
  { key: 'surprise', label: '✨ Surprise me' },
];

function getBudgetHealth(budget, currency, days, budgetEstimateUSD, accomType) {
  if (!budgetEstimateUSD || !budget || +budget <= 0) return null;
  const budgetUSD = +budget * (USD_RATES[currency] || 1);
  const multipliers = { hotel: 1.4, airbnb: 1.0, homestay: 0.6, surprise: 0.8 };
  const m = multipliers[accomType] || 1.0;
  const stayMidUSD = ((budgetEstimateUSD.accommodationPerNightLow + budgetEstimateUSD.accommodationPerNightHigh) / 2) * m * days;
  const flightsMidUSD = (budgetEstimateUSD.flightsLow + budgetEstimateUSD.flightsHigh) / 2;
  const activitiesMidUSD = ((budgetEstimateUSD.activitiesPerDayLow + budgetEstimateUSD.activitiesPerDayHigh) / 2) * days;
  const totalUSD = flightsMidUSD + stayMidUSD + activitiesMidUSD;
  const ratio = totalUSD / budgetUSD;
  return {
    status: ratio < 0.85 ? 'ok' : ratio < 1.05 ? 'tight' : 'over',
    flights: toUserCurrency(flightsMidUSD, currency),
    stay: toUserCurrency(stayMidUSD, currency),
    activities: toUserCurrency(activitiesMidUSD, currency),
    total: toUserCurrency(totalUSD, currency),
    cheaperMonths: budgetEstimateUSD.cheaperMonths || [],
    stayPerNightMid: toUserCurrency(((budgetEstimateUSD.accommodationPerNightLow + budgetEstimateUSD.accommodationPerNightHigh) / 2) * 0.4, currency),
  };
}

export function AccommodationSection({ destination, insights, budget, currency, days, travelStyle, alwaysOpen = false }) {
  const [open, setOpen] = useState(true);
  const isOpen = alwaysOpen || open;
  const [accomType, setAccomType] = useState('surprise');
  const destName = destination?.name || '';

  const accommodation = insights?.accommodation || [];
  const budgetEstimateUSD = insights?.budgetEstimateUSD || null;

  const filtered = accomType === 'surprise'
    ? accommodation
    : accommodation.filter(a => a.style === accomType);
  const cards = filtered.slice(0, 3);

  const health = getBudgetHealth(budget, currency, days, budgetEstimateUSD, accomType);

  const statusStyle = {
    ok:    { bg: 'rgba(0,212,170,0.08)', border: 'rgba(0,212,170,0.25)', label: '✅ Budget looks comfortable', color: '#00d4aa' },
    tight: { bg: 'rgba(255,217,61,0.08)', border: 'rgba(255,217,61,0.3)', label: '⚠️ Budget is tight', color: '#ffd93d' },
    over:  { bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.3)', label: '❌ Likely over budget', color: '#ff6b6b' },
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={alwaysOpen ? undefined : () => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', cursor: alwaysOpen ? 'default' : 'pointer',
          background: isOpen ? 'rgba(0,212,170,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isOpen ? 'rgba(0,212,170,0.25)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: isOpen ? '8px 8px 0 0' : 8,
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
          🏡 Where to stay
        </span>
        {!alwaysOpen && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{isOpen ? '▲' : '▼'}</span>}
      </div>

      {isOpen && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px' }}>

          {/* Type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 12 }}>
            {TYPE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccomType(key)}
                style={{
                  padding: '6px 8px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'center',
                  border: `1px solid ${accomType === key ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`,
                  background: accomType === key ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                  color: accomType === key ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Loading state */}
          {accommodation.length === 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: 10 }}>
              Loading accommodation suggestions…
            </div>
          )}

          {/* Cards */}
          {cards.map((a, i) => {
            const low = toUserCurrency(a.priceRangePerNightUSD?.low || 30, currency);
            const high = toUserCurrency(a.priceRangePerNightUSD?.high || 80, currency);
            const airbnbUrl = `https://www.airbnb.com/s/${encodeURIComponent(destName)}/homes?query=${encodeURIComponent(a.searchKeyword || destName)}`;
            const bookingUrl = `https://www.booking.com/search.html?ss=${encodeURIComponent(destName + ' ' + (a.searchKeyword || ''))}`;
            return (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '9px 11px', marginBottom: 7 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{a.type}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4, lineHeight: 1.5 }}>{a.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#00d4aa' }}>
                    {fmt(low, currency)}–{fmt(high, currency)}/night
                  </span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', maxWidth: 120, textAlign: 'right' }}>{a.whyItFits}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  <a href={airbnbUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '5px', background: 'linear-gradient(135deg,rgba(255,90,60,0.85),rgba(255,56,92,0.85))', borderRadius: 6, fontSize: 10, fontWeight: 800, color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
                    Airbnb →
                  </a>
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', textAlign: 'center' }}>
                    Booking →
                  </a>
                </div>
              </div>
            );
          })}

          {/* Budget health */}
          {health && (
            <div style={{ background: statusStyle[health.status].bg, border: `1px solid ${statusStyle[health.status].border}`, borderRadius: 8, padding: '9px 11px', marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: statusStyle[health.status].color, marginBottom: 6 }}>
                {statusStyle[health.status].label}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>✈️ Flights (est.)</span><span style={{ color: 'rgba(255,255,255,0.75)' }}>{fmt(health.flights, currency)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🏡 Stays ({days} nights)</span><span style={{ color: 'rgba(255,255,255,0.75)' }}>{fmt(health.stay, currency)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🎯 Activities + food</span><span style={{ color: 'rgba(255,255,255,0.75)' }}>{fmt(health.activities, currency)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 2 }}>
                  <span style={{ color: '#fff' }}>Estimated total</span>
                  <span style={{ color: statusStyle[health.status].color }}>{fmt(health.total, currency)}</span>
                </div>
              </div>
              {health.status !== 'ok' && health.cheaperMonths.length > 0 && (
                <div style={{ fontSize: 10, color: '#ffd93d', marginTop: 6, background: 'rgba(255,217,61,0.06)', borderRadius: 5, padding: '4px 7px', lineHeight: 1.5 }}>
                  💡 Try travelling in {health.cheaperMonths[0]} — typically 20–35% cheaper flights
                </div>
              )}
              {health.status === 'over' && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.5 }}>
                  Tip: Switching to homestay saves ~{fmt(health.stayPerNightMid * days, currency)} on accommodation
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
