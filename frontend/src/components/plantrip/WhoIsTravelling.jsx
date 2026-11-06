import React from 'react';

/**
 * Step 1 additions for route first (option B, Nov 6 2026):
 *  - CountryChips: the curated launch countries, one tap to choose a whole country
 *    (we then suggest the route — no research needed).
 *  - WhoIsTravelling: adults, kids' ages, travel-time comfort, overnight journeys and a
 *    free-text note. Asked BEFORE any route is suggested, and sent with the trip
 *    (selected_venues.tripPrefs) so the itinerary plans around kids too.
 */

// Same list as backend curated-routes.js (CURATED_COUNTRIES); coordinates are only a
// centre point for maps/search until the route's stops are chosen.
export const CURATED_COUNTRIES = [
  { name: 'Vietnam', lat: 16.05, lng: 108.2 },
  { name: 'Japan', lat: 36.2, lng: 138.25 },
  { name: 'India', lat: 22.0, lng: 78.0 },
  { name: 'Thailand', lat: 15.87, lng: 100.99 },
  { name: 'Sri Lanka', lat: 7.87, lng: 80.77 },
  { name: 'Indonesia', lat: -2.5, lng: 118.0 },
  { name: 'Nepal', lat: 28.39, lng: 84.12 },
  { name: 'Italy', lat: 41.87, lng: 12.57 },
  { name: 'Portugal', lat: 39.4, lng: -8.22 },
  { name: 'New Zealand', lat: -40.9, lng: 174.89 },
];

export const DEFAULT_TRIP_PREFS = { adults: 2, kids: [], transferComfort: 'medium', overnightOk: false, notes: '' };

const COMFORT = [
  { val: 'short', label: 'Short hops', sub: '≤ 2.5 h between stops' },
  { val: 'medium', label: 'Some travel', sub: 'up to ~4.5 h' },
  { val: 'long', label: 'Long journeys fine', sub: 'incl. full travel days' },
];

const s = {
  hint: { fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: '0.6rem' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.9rem' },
  chip: (sel) => ({
    padding: '7px 14px', borderRadius: 100, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem',
    border: `1px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.12)'}`,
    background: sel ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)',
    color: sel ? '#00d4aa' : 'rgba(255,255,255,0.75)', fontWeight: sel ? 700 : 500,
  }),
  row: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' },
  rowLabel: { color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', minWidth: 80 },
  stepBtn: { width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: '1.1rem' },
  num: { color: '#00d4aa', fontWeight: 800, minWidth: 24, textAlign: 'center' },
  kid: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 12px', borderRadius: 100, border: '1px solid rgba(0,212,170,0.3)', background: 'rgba(0,212,170,0.06)', color: '#fff', fontSize: '0.85rem' },
  select: { background: '#111827', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 6px', fontFamily: 'inherit' },
  x: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.9rem' },
  addKid: { padding: '6px 12px', borderRadius: 100, border: '1px dashed rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' },
  comfort: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginBottom: '1rem' },
  comfortBtn: (sel) => ({
    padding: '0.7rem 0.9rem', borderRadius: 10, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
    border: `${sel ? 2 : 1}px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`,
    background: sel ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)', color: sel ? '#00d4aa' : '#fff',
  }),
  check: { display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', marginBottom: '1rem', cursor: 'pointer' },
  textarea: { width: '100%', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 10, color: '#fff', fontFamily: 'inherit', fontSize: '0.9rem', resize: 'vertical' },
};

export function CountryChips({ selectedName, onPick }) {
  return (
    <div>
      <div style={s.hint}>Pick a country and we'll suggest the best route through it — or search any place below.</div>
      <div style={s.chips}>
        {CURATED_COUNTRIES.map(c => (
          <button
            type="button"
            key={c.name}
            style={s.chip(selectedName === c.name)}
            onClick={() => onPick({ name: c.name, country: c.name, lat: c.lat, lng: c.lng, isCountry: true })}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WhoIsTravelling({ value, onChange }) {
  const v = { ...DEFAULT_TRIP_PREFS, ...(value || {}) };
  const set = (patch) => onChange({ ...v, ...patch });
  const youngest = v.kids.length ? Math.min(...v.kids) : null;

  return (
    <div>
      <div style={s.row}>
        <span style={s.rowLabel}>Adults</span>
        <button type="button" style={s.stepBtn} aria-label="One adult fewer" onClick={() => set({ adults: Math.max(1, v.adults - 1) })}>−</button>
        <span style={s.num}>{v.adults}</span>
        <button type="button" style={s.stepBtn} aria-label="One adult more" onClick={() => set({ adults: Math.min(12, v.adults + 1) })}>+</button>
      </div>

      <div style={s.row}>
        <span style={s.rowLabel}>Kids</span>
        {v.kids.map((age, i) => (
          <span key={i} style={s.kid}>
            Age
            <select
              aria-label={`Age of child ${i + 1}`}
              style={s.select}
              value={age}
              onChange={e => set({ kids: v.kids.map((a, j) => (j === i ? Number(e.target.value) : a)) })}
            >
              {Array.from({ length: 18 }, (_, a) => <option key={a} value={a}>{a === 0 ? '<1' : a}</option>)}
            </select>
            <button type="button" style={s.x} aria-label={`Remove child ${i + 1}`} onClick={() => set({ kids: v.kids.filter((_, j) => j !== i) })}>✕</button>
          </span>
        ))}
        {v.kids.length < 8 && (
          <button type="button" style={s.addKid} onClick={() => set({ kids: [...v.kids, 6], ...(youngest !== null && youngest < 6 ? { overnightOk: false } : {}) })}>
            + Add a child
          </button>
        )}
      </div>

      <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
        How much travel between stops?
      </div>
      <div style={s.comfort}>
        {COMFORT.map(c => (
          <button type="button" key={c.val} style={s.comfortBtn(v.transferComfort === c.val)} onClick={() => set({ transferComfort: c.val })}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.label}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      <label style={{ ...s.check, opacity: youngest !== null && youngest < 6 ? 0.5 : 1 }}>
        <input
          type="checkbox"
          checked={v.overnightOk && !(youngest !== null && youngest < 6)}
          disabled={youngest !== null && youngest < 6}
          onChange={e => set({ overnightOk: e.target.checked })}
        />
        Overnight trains or buses are OK{youngest !== null && youngest < 6 ? ' (not suggested with under-6s)' : ''}
      </label>

      <textarea
        style={s.textarea}
        rows={2}
        maxLength={300}
        placeholder="Anything else? e.g. must see Sapa, skip big cities, grandparent with limited mobility"
        value={v.notes}
        onChange={e => set({ notes: e.target.value })}
      />
    </div>
  );
}
