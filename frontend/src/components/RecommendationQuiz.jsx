import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

const navy  = '#0a0f1e';
const navy2 = '#111827';
const navy3 = '#141d33';
const teal  = '#00d4aa';
const tealGlow   = 'rgba(0,212,170,0.12)';
const tealBorder = 'rgba(0,212,170,0.25)';
const border = 'rgba(255,255,255,0.08)';
const w40   = 'rgba(255,255,255,0.4)';
const w60   = 'rgba(255,255,255,0.6)';

const STYLES = [
  { id: 'nature',      label: '🌿 Nature',      desc: 'Trails, forests, national parks' },
  { id: 'cultural',    label: '🏛️ Cultural',    desc: 'Temples, history, local life' },
  { id: 'foodie',      label: '🍜 Foodie',       desc: 'Markets, local cuisines, hidden cafes' },
  { id: 'adventure',   label: '🧗 Adventure',    desc: 'Hiking, diving, wild experiences' },
  { id: 'relaxation',  label: '🧘 Relaxation',   desc: 'Slow pace, wellness, quiet stays' },
  { id: 'wellness',    label: '💆 Wellness',     desc: 'Spas, retreats, mindful travel' },
];

const BUDGETS = [
  { id: 'budget', label: '💚 Budget',    desc: 'Under $50/night' },
  { id: 'mid',    label: '💛 Mid-range', desc: '$50–150/night' },
  { id: 'luxury', label: '💜 Luxury',    desc: '$150+/night' },
];

export default function RecommendationQuiz({ onSelect }) {
  const navigate = useNavigate();
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [selectedBudget, setBudget]         = useState(null);
  const [results, setResults]               = useState([]);
  const [loading, setLoading]               = useState(false);
  const [shown, setShown]                   = useState(false);

  const toggleStyle = (id) => {
    setSelectedStyles(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
    setShown(false);
  };

  const fetchRecs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '3' });
      if (selectedStyles.length) params.set('style', selectedStyles.join(','));
      if (selectedBudget) params.set('budget', selectedBudget);
      const res  = await fetch(`${API_URL}/recommendations?${params}`);
      const data = await res.json();
      setResults(data.data?.destinations || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setShown(true);
    }
  };

  const handleSelect = (dest) => {
    onSelect(dest.destination + (dest.country ? `, ${dest.country}` : ''));
  };

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: navy3, borderRadius: 16, border: `1px solid ${border}` }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: teal, marginBottom: 8 }}>
        ✦ Not sure where to go?
      </div>
      <p style={{ fontSize: '0.9rem', color: w60, marginBottom: '1.25rem', lineHeight: 1.6 }}>
        Tell us your vibe and we'll suggest the perfect slow-travel destination.
      </p>

      {/* Style selection */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: w40, marginBottom: 8 }}>Travel style (pick any)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => toggleStyle(s.id)}
              style={{
                padding: '6px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 600,
                border: `1px solid ${selectedStyles.includes(s.id) ? teal : border}`,
                background: selectedStyles.includes(s.id) ? tealGlow : 'transparent',
                color: selectedStyles.includes(s.id) ? teal : w60,
                cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Budget selection */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: w40, marginBottom: 8 }}>Budget range</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BUDGETS.map(b => (
            <button
              key={b.id}
              onClick={() => { setBudget(b.id); setShown(false); }}
              style={{
                padding: '6px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 600,
                border: `1px solid ${selectedBudget === b.id ? teal : border}`,
                background: selectedBudget === b.id ? tealGlow : 'transparent',
                color: selectedBudget === b.id ? teal : w60,
                cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", transition: 'all 0.15s',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Find button */}
      <button
        onClick={fetchRecs}
        disabled={loading}
        style={{
          background: teal, color: navy, border: 'none', padding: '10px 24px',
          borderRadius: 10, fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
          fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: loading ? 0.7 : 1,
          marginBottom: shown && results.length ? '1.5rem' : 0,
        }}
      >
        {loading ? 'Finding destinations...' : 'Find my destination →'}
      </button>

      {/* Results */}
      {shown && results.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: w40, marginBottom: 10 }}>
            Top picks for you — click to plan
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {results.map(dest => (
              <div
                key={dest.id}
                onClick={() => handleSelect(dest)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                  borderRadius: 12, border: `1px solid ${border}`, background: navy2,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = tealBorder; e.currentTarget.style.background = tealGlow; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.background = navy2; }}
              >
                <img
                  src={dest.image_url}
                  alt={dest.destination}
                  style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: 2 }}>
                    {dest.destination}, {dest.country}
                  </div>
                  {dest.foursquare_tip && (
                    <div style={{ fontSize: '0.75rem', color: w40, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{dest.foursquare_tip}"
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {dest.avg_nightly_rate && (
                      <span style={{ fontSize: '0.7rem', color: teal, fontWeight: 600 }}>{dest.avg_nightly_rate}/night</span>
                    )}
                    {dest.styles?.slice(0, 2).map(s => (
                      <span key={s} style={{ fontSize: '0.65rem', padding: '1px 8px', borderRadius: 20, background: tealGlow, color: teal, border: `1px solid ${tealBorder}` }}>{s}</span>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', color: teal, fontWeight: 700, flexShrink: 0 }}>Plan →</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {shown && results.length === 0 && (
        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: w40, fontStyle: 'italic' }}>
          No matches found — try different filters or{' '}
          <a href="/explore" style={{ color: teal, textDecoration: 'none' }}>browse all destinations</a>.
        </div>
      )}
    </div>
  );
}
