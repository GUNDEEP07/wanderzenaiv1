// Explore, design B (approved Nov 16 2026): filter the hand-curated Asia routes by month,
// length, longest travel day and kids; closest to the visitor first. The month defaults to
// THIS month, so the list follows the seasons by itself. Data: src/data/guides.json.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GUIDES from '../../data/guides.json';
import { CreditedPhoto } from '../PhotoCredit';
import {
  LIVE_REGIONS, liveRegionLabel, ORIGINS, MONTHS, guessOrigin, saveOrigin, currentMonth, rankCountries, inSeason, bestLabel, routeLine, planPrefill,
} from '../../utils/seasons';

const teal = '#00d4aa';
const LENGTHS = [
  { label: 'Any length', test: () => true },
  { label: 'Up to 8 days', test: d => d <= 8 },
  { label: '9 days or more', test: d => d >= 9 },
];
const HOPS = [
  { label: 'Any', test: () => true },
  { label: 'Under 3 h', test: h => h < 3 },
  { label: 'Under 4 h', test: h => h < 4 },
];

const s = {
  section: { padding: '2.5rem 2rem 3.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 },
  eyebrow: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: teal },
  h2: { fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', margin: 0 },
  countRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', color: 'rgba(255,255,255,0.75)', fontSize: 15 },
  select: { background: '#121a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '7px 10px', font: "500 14px 'Plus Jakarta Sans', sans-serif", minHeight: 40 },
  panel: { background: '#121a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 },
  label: { fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  row: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  pill: (on) => ({
    background: on ? teal : 'transparent', color: on ? '#0a0f1e' : '#fff', border: `1px solid ${on ? teal : 'rgba(255,255,255,0.28)'}`,
    borderRadius: 10, padding: '9px 13px', fontWeight: on ? 700 : 500, fontSize: 14, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16 },
  card: { textAlign: 'left', color: '#fff', background: '#121a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' },
  planBtn: { marginTop: 'auto', alignSelf: 'flex-start', background: 'none', border: 0, padding: '10px 0', minHeight: 44, color: teal, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  cardBody: { padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: 10, flex: '1 1 auto' },
  tag: (bg, fg) => ({ background: bg, color: fg, borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 600 }),
  empty: { background: '#121a2e', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start', color: 'rgba(255,255,255,0.8)' },
  cta: { background: teal, color: '#0a0f1e', border: 0, fontWeight: 700, borderRadius: 12, padding: '12px 20px', cursor: 'pointer', fontFamily: 'inherit', minHeight: 44 },
};

export default function RouteFinder() {
  const navigate = useNavigate();
  const thisMonth = currentMonth();
  const [origin, setOrigin] = useState(() => guessOrigin());
  const [month, setMonth] = useState(thisMonth); // 0 = any month
  const [len, setLen] = useState(0);
  const [hop, setHop] = useState(0);
  const [kids, setKids] = useState(false);
  const [region, setRegion] = useState(''); // '' = every live region; the row shows once there are 2+
  const regions = region ? LIVE_REGIONS.filter(r => r.id === region) : LIVE_REGIONS;
  const only = regions.flatMap(r => r.countries);

  const onlyKey = only.join('|');
  const all = useMemo(() => rankCountries(GUIDES, { month: month || thisMonth, origin, only: onlyKey.split('|') })
    .flatMap(c => c.routes.map(r => ({ ...r, country: c.name, hours: c.hours }))), [month, thisMonth, origin, onlyKey]);
  const results = all
    .filter(r => (!month || inSeason(r, month)) && LENGTHS[len].test(r.days) && HOPS[hop].test(r.longestTransferHours) && (!kids || r.kidFriendly))
    .sort((a, b) => (a.hours ?? 99) - (b.hours ?? 99));

  const changeOrigin = (e) => {
    const o = ORIGINS.find(x => x.id === e.target.value);
    if (o) { saveOrigin(o.id); setOrigin({ ...o, guessed: false }); }
  };
  const plan = (r) => navigate('/plan', { state: { prefill: planPrefill(r.country, r) } });

  return (
    <section style={s.section} aria-labelledby="route-finder-title">
      <div style={s.inner}>
        <div style={s.eyebrow}>Hand-picked routes</div>
        <h2 id="route-finder-title" style={s.h2}>Find your slow route</h2>
        <div style={s.countRow}>
          <span>{results.length} of {all.length} {liveRegionLabel(regions)} routes match, closest to</span>
          <label htmlFor="rf-from" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Planning from</label>
          <select id="rf-from" value={origin.id} onChange={changeOrigin} style={s.select}>
            {ORIGINS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <span>first.</span>
        </div>

        <div style={s.panel}>
          {LIVE_REGIONS.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={s.label} id="rf-region">Where</span>
              <div role="group" aria-labelledby="rf-region" style={s.row}>
                <button type="button" aria-pressed={region === ''} style={s.pill(region === '')} onClick={() => setRegion('')}>Everywhere</button>
                {LIVE_REGIONS.map(r => (
                  <button key={r.id} type="button" aria-pressed={region === r.id} style={s.pill(region === r.id)} onClick={() => setRegion(r.id)}>{r.name}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={s.label} id="rf-month">When are you going?</span>
            <div role="group" aria-labelledby="rf-month" style={s.row}>
              <button type="button" aria-pressed={month === 0} style={s.pill(month === 0)} onClick={() => setMonth(0)}>Any month</button>
              {MONTHS.map((m, i) => (
                <button key={m} type="button" aria-pressed={month === i + 1} style={s.pill(month === i + 1)} onClick={() => setMonth(i + 1)}>
                  {m}{i + 1 === thisMonth ? ' (now)' : ''}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
            <Choice label="Trip length" options={LENGTHS} value={len} onChange={setLen} />
            <Choice label="Longest travel day" options={HOPS} value={hop} onChange={setHop} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={s.label}>Travelling with kids</span>
              <button type="button" aria-pressed={kids} style={s.pill(kids)} onClick={() => setKids(k => !k)}>
                {kids ? 'Kid-friendly routes only' : 'Show all routes'}
              </button>
            </div>
          </div>
        </div>

        {results.length > 0 ? (
          <div style={s.grid}>
            {results.map(r => (
              // A div, not a button: the photo credit inside holds links. The card is clickable
              // with the mouse; keyboard users reach the real button at the bottom.
              <div key={r.id} style={s.card} onClick={() => plan(r)}>
                <CreditedPhoto destination={r.country} keyword={r.photoQuery} size="card" alt={`${r.name}, ${r.country}`} style={{ height: 170, width: '100%' }} corner="bottom-right" />
                <span style={s.cardBody}>
                  <span style={{ fontSize: 13, color: teal, fontWeight: 600 }}>
                    {r.country}{r.hours ? ` · about ${r.hours} h from ${origin.name}` : ''}
                  </span>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 21, lineHeight: 1.2 }}>{r.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 1.5 }}>{routeLine(r)}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={s.tag('rgba(0,212,170,0.14)', '#7fffe0')}>{r.days} days</span>
                    <span style={s.tag('rgba(255,255,255,0.08)', 'rgba(255,255,255,0.88)')}>Longest hop {r.longestTransferHours} h</span>
                    {r.kidFriendly && <span style={s.tag('rgba(255,217,61,0.16)', '#ffe78a')}>Good with kids</span>}
                    <span style={s.tag('rgba(255,255,255,0.08)', 'rgba(255,255,255,0.88)')}>Best {bestLabel(r)}</span>
                  </span>
                  <button type="button" style={s.planBtn} onClick={(e) => { e.stopPropagation(); plan(r); }} aria-label={`Plan ${r.name}, ${r.country}`}>
                    Plan this route →
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={s.empty}>
            <strong style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#fff' }}>No hand-picked route fits all of that.</strong>
            <span>Loosen a filter, or let us plan a route around your dates and limits.</span>
            <button type="button" style={s.cta} onClick={() => navigate('/plan')}>Plan my own route</button>
          </div>
        )}
      </div>
    </section>
  );
}

function Choice({ label, options, value, onChange }) {
  const id = `rf-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={s.label} id={id}>{label}</span>
      <div role="group" aria-labelledby={id} style={s.row}>
        {options.map((o, i) => (
          <button key={o.label} type="button" aria-pressed={value === i} style={s.pill(value === i)} onClick={() => onChange(i)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}
