import React, { useState } from 'react';

const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}
function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

export function FlightsSection({ destination, origin, travelDate, budgetEstimateUSD, currency, onOriginChange }) {
  const [open, setOpen] = useState(true);
  const [localOrigin, setLocalOrigin] = useState(origin || '');
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

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', cursor: 'pointer',
          background: open ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${open ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: open ? '8px 8px 0 0' : 8,
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
          ✈️ Flights {originCity ? `from ${originCity}` : '— where are you flying from?'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px' }}>

          {!origin && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Flying from</div>
              <input
                value={localOrigin}
                onChange={e => setLocalOrigin(e.target.value)}
                onBlur={e => { if (e.target.value.trim()) onOriginChange?.(e.target.value.trim()); }}
                placeholder="e.g. Sydney, London, Mumbai"
                style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#fff', fontFamily: 'inherit', fontSize: 12, outline: 'none' }}
              />
            </div>
          )}

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            {originCity || '?'} → {destName}
            {travelDate && ` · ${new Date(travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            {flightsLow && flightsHigh && (
              <span style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8, fontWeight: 600 }}>
                · {fmt(flightsLow, currency)}–{fmt(flightsHigh, currency)} return
              </span>
            )}
          </div>

          {budgetEstimateUSD?.flightTip && (
            <div style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 6, padding: '5px 8px', marginBottom: 10, lineHeight: 1.5 }}>
              💡 {budgetEstimateUSD.flightTip}
            </div>
          )}

          {budgetEstimateUSD?.cheaperMonths?.length > 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,217,61,0.85)', background: 'rgba(255,217,61,0.05)', border: '1px solid rgba(255,217,61,0.15)', borderRadius: 6, padding: '5px 8px', marginBottom: 10, lineHeight: 1.5 }}>
              📅 Cheaper to fly in: {budgetEstimateUSD.cheaperMonths.join(', ')}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <a href={googleUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '8px', background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', borderRadius: 7, fontSize: 11, fontWeight: 800, color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
              Google Flights →
            </a>
            <a href={skyscannerUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', textAlign: 'center' }}>
              Skyscanner →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
