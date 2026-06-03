import React, { useState } from 'react';

const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}
function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

export function FlightsSection({ destination, origin, travelDate, budgetEstimateUSD, currency, onOriginChange, alwaysOpen = false }) {
  const [open, setOpen] = useState(true);
  const [localOrigin, setLocalOrigin] = useState(origin || '');
  const isOpen = alwaysOpen || open;

  const destName = destination?.name || '';
  const effectiveOrigin = origin || localOrigin;
  const originCity = (effectiveOrigin || '').split(',')[0].trim();
  const originSlug = originCity.toLowerCase().replace(/\s+/g, '-');

  const flightsLow = budgetEstimateUSD ? toUserCurrency(budgetEstimateUSD.flightsLow, currency) : null;
  const flightsHigh = budgetEstimateUSD ? toUserCurrency(budgetEstimateUSD.flightsHigh, currency) : null;

  const googleUrl = `https://www.google.com/flights?hl=en#flt=${encodeURIComponent(originCity || 'London')}.${encodeURIComponent(destName)}.${travelDate || ''};r:1`;
  const skyscannerUrl = originSlug
    ? `https://www.skyscanner.com/transport/flights-from/${originSlug}/`
    : 'https://www.skyscanner.com/flights';

  const dateLabel = travelDate
    ? new Date(travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Section header — only shows toggle when not alwaysOpen */}
      {!alwaysOpen && (
        <div
          onClick={() => setOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, cursor: 'pointer' }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            ✈️ Your flight
          </div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      )}
      {alwaysOpen && (
        <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          ✈️ Your flight
        </div>
      )}

      {isOpen && (
        <div style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.07), rgba(59,130,246,0.03))', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 16, padding: 18 }}>

          {/* From / To boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>From</div>
              {effectiveOrigin ? (
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{originCity}</div>
                  {effectiveOrigin.includes(',') && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{effectiveOrigin.split(',').slice(1).join(',').trim()}</div>
                  )}
                </div>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: '9px 12px' }}>
                  <input
                    value={localOrigin}
                    onChange={e => setLocalOrigin(e.target.value)}
                    onBlur={e => { if (e.target.value.trim()) onOriginChange?.(e.target.value.trim()); }}
                    placeholder="Your city"
                    style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, width: '100%' }}
                  />
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>e.g. London</div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 20, color: '#60a5fa', textAlign: 'center', paddingTop: 14 }}>✈️</div>

            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>To</div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{destName || '—'}</div>
                {dateLabel && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{dateLabel}</div>}
              </div>
            </div>
          </div>

          {/* Price */}
          {flightsLow && flightsHigh && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 700, color: '#60a5fa', lineHeight: 1 }}>
                  {fmt(flightsLow, currency)}
                </span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>– {fmt(flightsHigh, currency)} return est.</span>
              </div>
            </div>
          )}

          {/* Tips */}
          {budgetEstimateUSD?.flightTip && (
            <div style={{ fontSize: 11, color: '#60a5fa', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 8, padding: '7px 10px', marginBottom: 10, lineHeight: 1.5 }}>
              💡 {budgetEstimateUSD.flightTip}
            </div>
          )}
          {budgetEstimateUSD?.cheaperMonths?.length > 0 && (
            <div style={{ fontSize: 11, color: '#ffd93d', background: 'rgba(255,217,61,0.05)', border: '1px solid rgba(255,217,61,0.15)', borderRadius: 8, padding: '7px 10px', marginBottom: 12, lineHeight: 1.5 }}>
              📅 Typically cheaper in: {budgetEstimateUSD.cheaperMonths.join(', ')}
            </div>
          )}

          {/* CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <a href={googleUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', borderRadius: 10, fontSize: 13, fontWeight: 800, color: '#fff', textDecoration: 'none' }}>
              <span>Search on Google Flights</span>
              <span>→</span>
            </a>
            <a href={skyscannerUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>
              <span>Search on Skyscanner</span>
              <span>→</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
