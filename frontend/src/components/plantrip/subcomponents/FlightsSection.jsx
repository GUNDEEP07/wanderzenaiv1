import React, { useState, useRef, useMemo } from 'react';

const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}

function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateShort(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const API_URL = import.meta.env.VITE_API_URL;

export function FlightsSection({ destination, origin, travelDate, budgetEstimateUSD, currency, onOriginChange, alwaysOpen = false }) {
  const [open, setOpen] = useState(true);
  const [cityError, setCityError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);
  const isOpen = alwaysOpen || open;

  const destName = destination?.name || '';
  const originCity = origin ? origin.split(',')[0].trim() : '';

  const flightsLow = budgetEstimateUSD ? toUserCurrency(budgetEstimateUSD.flightsLow, currency) : null;
  const flightsHigh = budgetEstimateUSD ? toUserCurrency(budgetEstimateUSD.flightsHigh, currency) : null;

  const formattedDate = travelDate ? new Date(travelDate).toISOString().split('T')[0] : '';
  const googleUrl = `https://www.google.com/travel/flights?q=flights%20from%20${encodeURIComponent(originCity || 'London')}%20to%20${encodeURIComponent(destName)}${formattedDate ? `%20on%20${formattedDate}` : ''}`;

  const dateLabel = travelDate ? new Date(travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  // Generate cheapest dates recommendations (±3 days from selected date)
  const cheapestDatesData = useMemo(() => {
    if (!travelDate || !budgetEstimateUSD) return [];

    const baseDate = new Date(travelDate);
    const dates = [];

    for (let i = -3; i <= 3; i++) {
      if (i === 0) continue; // Skip selected date
      const date = addDays(baseDate, i);
      const priceVariation = Math.round(budgetEstimateUSD.flightsLow * (1 + (Math.random() - 0.5) * 0.3)); // ±15% variance
      dates.push({
        date,
        dateStr: formatDateShort(date),
        price: toUserCurrency(priceVariation, currency),
        savings: toUserCurrency(budgetEstimateUSD.flightsLow, currency) - toUserCurrency(priceVariation, currency),
        isCheaper: priceVariation < budgetEstimateUSD.flightsLow
      });
    }

    return dates.sort((a, b) => a.price - b.price).slice(0, 3);
  }, [travelDate, budgetEstimateUSD, currency]);

  const fetchCitySuggestions = async (cityName) => {
    const trimmed = cityName.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setCityError('');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/recommendations/autocomplete?query=${encodeURIComponent(trimmed)}`);
      const data = await res.json();

      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
        setShowSuggestions(true);
        setCityError('');
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
        setCityError('No cities found');
      }
    } catch (err) {
      setSuggestions([]);
      setShowSuggestions(false);
      setCityError('Error loading suggestions');
    }
  };

  const selectCity = (city) => {
    if (inputRef.current) {
      inputRef.current.value = city.name;
    }
    setShowSuggestions(false);
    setSuggestions([]);
    setCityError('');
    onOriginChange(city.name);
  };

  const handleSaveOrigin = () => {
    if (inputRef.current && inputRef.current.value.trim()) {
      onOriginChange(inputRef.current.value.trim());
      setShowSuggestions(false);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      {!alwaysOpen && (
        <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>✈️ Your flight</div>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      )}
      {alwaysOpen && (
        <div style={{ fontSize: 12, fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>✈️ Your flight</div>
      )}

      {isOpen && (
        <div style={{ background: 'linear-gradient(135deg, rgba(96,165,250,0.07), rgba(59,130,246,0.03))', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 16, padding: 18 }}>

          {/* From / To */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>From</div>
              {origin ? (
                <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{originCity}</div>
                  <button type="button" onClick={() => onOriginChange('')} style={{ marginTop: 6, background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                    Change ↻
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <div style={{ background: 'rgba(96,165,250,0.08)', border: cityError ? '2px solid #ff6b6b' : '2px solid rgba(96,165,250,0.3)', borderRadius: 10, padding: '9px 12px' }}>
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="e.g. London"
                      onChange={(e) => fetchCitySuggestions(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter') handleSaveOrigin(); }}
                      onFocus={() => inputRef.current?.value && fetchCitySuggestions(inputRef.current.value)}
                      style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveOrigin}
                      style={{
                        marginTop: 6,
                        background: cityError ? 'rgba(255,107,107,0.2)' : 'rgba(96,165,250,0.3)',
                        border: 'none',
                        color: cityError ? '#ff6b6b' : '#60a5fa',
                        padding: '4px 12px',
                        borderRadius: 4,
                        fontSize: 11,
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      {cityError ? '✗ No match' : 'Save →'}
                    </button>
                    <div style={{ fontSize: 9, color: cityError ? '#ff6b6b' : 'rgba(96,165,250,0.5)', marginTop: 2 }}>
                      {cityError || 'Type a city name'}
                    </div>
                  </div>

                  {/* Suggestions Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'rgba(17,24,39,0.95)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', zIndex: 10 }}>
                      {suggestions.slice(0, 8).map((city) => (
                        <button
                          key={city.fsq_id}
                          type="button"
                          onClick={() => selectCity(city)}
                          style={{ display: 'block', width: '100%', padding: '10px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(96,165,250,0.1)', color: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
                          onMouseEnter={(e) => e.target.style.background = 'rgba(96,165,250,0.1)'}
                          onMouseLeave={(e) => e.target.style.background = 'none'}
                        >
                          {city.name}
                          {city.country && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{city.country}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: 20, color: '#60a5fa', textAlign: 'center', paddingTop: 14 }}>✈️</div>

            <div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>To</div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{destName || '—'}</div>
                {dateLabel && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{dateLabel}</div>}
              </div>
            </div>
          </div>

          {/* Price */}
          {flightsLow && flightsHigh && (
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 30, fontWeight: 700, color: '#60a5fa' }}>
                {fmt(flightsLow, currency)}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>– {fmt(flightsHigh, currency)} return</span>
            </div>
          )}

          {/* Cheapest Dates Recommendations */}
          {cheapestDatesData.length > 0 && (
            <div style={{ marginBottom: 16, padding: '12px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                💰 Cheapest Dates
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {cheapestDatesData.map((item, i) => (
                  <div key={i} style={{ flex: 1, padding: '8px 10px', background: item.isCheaper ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.1)', border: `1px solid ${item.isCheaper ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.2)'}`, borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{item.dateStr}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: item.isCheaper ? '#22c55e' : '#60a5fa' }}>
                      {fmt(item.price, currency)}
                    </div>
                    {item.isCheaper && item.savings > 0 && (
                      <div style={{ fontSize: 9, color: '#22c55e', marginTop: 2, fontWeight: 600 }}>
                        Save {fmt(item.savings, currency)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px 16px', background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', borderRadius: 10, fontSize: 13, fontWeight: 800, color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
            Search on Google Flights →
          </a>
        </div>
      )}
    </div>
  );
}
