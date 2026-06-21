import React, { useState } from 'react';
import { useDestinationPhoto, getFallbackPhoto } from '../../../utils/destinationPhotos';

const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}
function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

function AccomPhoto({ keyword, destination, style }) {
  const src = useDestinationPhoto('', keyword || destination || '', 'card');
  return <img src={src} alt={keyword} loading="lazy" style={style} onError={e => { e.target.src = getFallbackPhoto('card'); }} />;
}

const TYPE_OPTIONS = [
  { key: 'surprise', label: '✨ Surprise me' },
  { key: 'hotel',    label: '🏨 Hotels' },
  { key: 'airbnb',   label: '🏠 Airbnbs' },
  { key: 'homestay', label: '🤝 Homestays' },
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
    pct: Math.min(Math.round(ratio * 100), 100),
    cheaperMonths: budgetEstimateUSD.cheaperMonths || [],
  };
}

export function AccommodationSection({ destination, insights, budget, currency, days, travelStyle, startDate, endDate, alwaysOpen = false }) {
  const [open, setOpen] = useState(true);
  const [accomType, setAccomType] = useState('surprise');
  const isOpen = alwaysOpen || open;
  const destName = destination?.name || '';

  // Format dates for booking URLs (YYYY-MM-DD)
  const checkinDate = startDate ? new Date(startDate).toISOString().split('T')[0] : '';
  const checkoutDate = endDate ? new Date(endDate).toISOString().split('T')[0] : '';

  const accommodation = insights?.accommodation || [];
  const budgetEstimateUSD = insights?.budgetEstimateUSD || null;

  const filtered = accomType === 'surprise'
    ? accommodation
    : accommodation.filter(a => a.style === accomType);
  const cards = filtered.slice(0, 4);
  const health = getBudgetHealth(budget, currency, days, budgetEstimateUSD, accomType);

  const statusConfig = {
    ok:    { color: '#00d4aa', bg: 'rgba(0,212,170,0.08)', border: 'rgba(0,212,170,0.2)', label: '✅ Comfortable', barColor: '#00d4aa' },
    tight: { color: '#ffd93d', bg: 'rgba(255,217,61,0.06)', border: 'rgba(255,217,61,0.2)', label: '⚠️ Tight',       barColor: '#ffd93d' },
    over:  { color: '#ff6b6b', bg: 'rgba(255,107,107,0.06)', border: 'rgba(255,107,107,0.2)', label: '❌ Over budget', barColor: '#ff6b6b' },
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Section header */}
      {!alwaysOpen && (
        <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>🏡 Where to stay</div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      )}
      {alwaysOpen && (
        <div style={{ fontSize: 12, fontWeight: 800, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          🏡 Where to stay
        </div>
      )}

      {isOpen && (
        <>
          {/* Type selector — pill row */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {TYPE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccomType(key)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: accomType === key ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.05)',
                  boxShadow: accomType === key ? '0 0 0 1.5px rgba(0,212,170,0.4)' : '0 0 0 1px rgba(255,255,255,0.1)',
                  color: accomType === key ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Price breakdown & info */}
          {budgetEstimateUSD && (
            <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Per Night</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>
                    {fmt(toUserCurrency(budgetEstimateUSD.accommodationPerNightLow, currency), currency)} – {fmt(toUserCurrency(budgetEstimateUSD.accommodationPerNightHigh, currency), currency)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>For {days} nights</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>
                    {fmt(toUserCurrency(budgetEstimateUSD.accommodationPerNightLow * days, currency), currency)} – {fmt(toUserCurrency(budgetEstimateUSD.accommodationPerNightHigh * days, currency), currency)}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                📍 {destName} · Typical price range for {days}-day trip
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic', marginBottom: 12, lineHeight: 1.5 }}>
            AI-suggested stay types with typical price estimates · Links open search on Airbnb / Booking.com
          </div>

          {/* Loading */}
          {accommodation.length === 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
              Loading stay suggestions…
            </div>
          )}

          {/* 2-column photo grid */}
          {cards.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {cards.map((a, i) => {
                const low = toUserCurrency(a.priceRangePerNightUSD?.low || 30, currency);
                const high = toUserCurrency(a.priceRangePerNightUSD?.high || 80, currency);
                const airbnbUrl = checkinDate && checkoutDate
                  ? `https://www.airbnb.com/s/${encodeURIComponent(destName)}/homes?query=${encodeURIComponent(a.searchKeyword || destName)}&checkin=${checkinDate}&checkout=${checkoutDate}`
                  : `https://www.airbnb.com/s/${encodeURIComponent(destName)}/homes?query=${encodeURIComponent(a.searchKeyword || destName)}`;
                const bookingUrl = checkinDate && checkoutDate
                  ? `https://www.booking.com/search.html?ss=${encodeURIComponent(destName + ' ' + (a.searchKeyword || ''))}&checkin=${checkinDate}&checkout=${checkoutDate}`
                  : `https://www.booking.com/search.html?ss=${encodeURIComponent(destName + ' ' + (a.searchKeyword || ''))}`;
                return (
                  <div key={i} style={{ borderRadius: 12, overflow: 'hidden', background: '#0f1a2e', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* Photo */}
                    <div style={{ height: 90, position: 'relative', overflow: 'hidden' }}>
                      <AccomPhoto
                        keyword={a.searchKeyword}
                        destination={destName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.9) 0%, rgba(10,15,30,0.2) 60%, transparent 100%)' }} />
                      {/* Price overlay */}
                      <div style={{ position: 'absolute', bottom: 7, left: 9 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                          ~{fmt(low, currency)}<span style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.6)' }}>/night</span>
                        </div>
                      </div>
                    </div>
                    {/* Info */}
                    <div style={{ padding: '8px 9px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2, lineHeight: 1.2 }}>{a.type}</div>
                      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 2, lineHeight: 1.4 }}>{a.whyItFits}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#60a5fa', marginBottom: 6 }}>
                        {fmt(low * days, currency)} total
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <a href={airbnbUrl} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, display: 'block', padding: '5px 4px', background: 'linear-gradient(135deg,rgba(255,90,60,0.85),rgba(255,56,92,0.85))', borderRadius: 6, fontSize: 9, fontWeight: 800, color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
                          Airbnb
                        </a>
                        <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, display: 'block', padding: '5px 4px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', textAlign: 'center' }}>
                          Booking
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Budget health */}
          {health && (() => {
            const cfg = statusConfig[health.status];
            return (
              <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{fmt(health.total, currency)} of {fmt(+budget, currency)}</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${health.pct}%`, height: '100%', background: `linear-gradient(90deg, ${cfg.barColor}, ${cfg.barColor}cc)`, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  <span>✈️ {fmt(health.flights, currency)} · 🏡 {fmt(health.stay, currency)} · 🎯 {fmt(health.activities, currency)}</span>
                  {health.status !== 'ok' && <span style={{ color: cfg.color }}>over by {fmt(health.total - +budget, currency)}</span>}
                </div>
                {health.status !== 'ok' && health.cheaperMonths.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#ffd93d', background: 'rgba(255,217,61,0.05)', borderRadius: 6, padding: '6px 8px', lineHeight: 1.5 }}>
                    💡 Travel in {health.cheaperMonths[0]} for cheaper flights
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
