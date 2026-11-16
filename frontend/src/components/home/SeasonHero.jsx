// Home hero, design A (approved Nov 16 2026): "Where do you want to slow down?"
// Countries in season this month first, then closest to where the visitor plans from;
// pick one to see a real hand-curated route with its photo. Data: src/data/guides.json.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GUIDES from '../../data/guides.json';
import { CreditedPhoto } from '../PhotoCredit';
import {
  ORIGINS, MONTHS, MONTHS_LONG, guessOrigin, saveOrigin, currentMonth, rankCountries, inSeason, bestLabel, planPrefill,
} from '../../utils/seasons';

const teal = '#00d4aa';
const s = {
  wrap: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 1180, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start', textAlign: 'left' },
  left: { flex: '1 1 400px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 },
  fromRow: { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  select: { background: '#121a2e', color: '#fff', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '8px 10px', font: "500 14px 'Plus Jakarta Sans', sans-serif", minHeight: 40 },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  title: { margin: 0, fontFamily: "'Fraunces', serif", fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#fff' },
  sub: { margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: 18, lineHeight: 1.55 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: 10 },
  chip: (on) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', cursor: 'pointer',
    minHeight: 56, borderRadius: 14, padding: '10px 14px', fontFamily: 'inherit',
    background: on ? teal : 'rgba(255,255,255,0.04)', color: on ? '#0a0f1e' : '#fff',
    border: `1px solid ${on ? teal : 'rgba(255,255,255,0.22)'}`,
  }),
  chipMeta: (on) => ({ fontSize: 12, fontWeight: 500, color: on ? '#0a3d33' : 'rgba(255,255,255,0.72)' }),
  card: { flex: '1 1 480px', minWidth: 0, background: '#121a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, overflow: 'hidden' },
  body: { padding: '22px 26px 26px', display: 'flex', flexDirection: 'column', gap: 16 },
  tab: (on) => ({
    background: on ? '#fff' : 'rgba(255,255,255,0.06)', color: on ? '#0a0f1e' : 'rgba(255,255,255,0.85)',
    border: 0, borderRadius: 10, padding: '10px 14px', fontWeight: on ? 600 : 500, fontSize: 14, cursor: 'pointer', minHeight: 44, fontFamily: 'inherit',
  }),
  pill: (bg, fg) => ({ background: bg, color: fg, borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600 }),
  stop: { display: 'flex', gap: 14, alignItems: 'stretch' },
  dot: { width: 14, height: 14, borderRadius: '50%', background: teal, marginTop: 6, flex: '0 0 auto' },
  line: { width: 2, flex: '1 1 auto', background: 'rgba(0,212,170,0.4)', margin: '4px 0' },
  cta: { background: teal, color: '#0a0f1e', border: 0, fontWeight: 700, borderRadius: 12, padding: '14px 22px', minHeight: 48, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' },
  link: { color: 'rgba(255,255,255,0.85)', fontSize: 15 },
  small: { margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 13 },
};

export default function SeasonHero() {
  const navigate = useNavigate();
  const month = currentMonth();
  const [origin, setOrigin] = useState(() => guessOrigin());
  const countries = useMemo(() => rankCountries(GUIDES, { month, origin }), [month, origin]);
  const [picked, setPicked] = useState(null);
  const [routeIdx, setRouteIdx] = useState(0);
  const country = countries.find(c => c.name === picked) || countries[0];
  const route = country.routes[routeIdx] || country.routes[0];
  const good = inSeason(route, month);

  const changeOrigin = (e) => {
    const o = ORIGINS.find(x => x.id === e.target.value);
    if (!o) return;
    saveOrigin(o.id);
    setOrigin({ ...o, guessed: false });
    setPicked(null);
    setRouteIdx(0);
  };
  const plan = () => navigate('/plan', { state: { prefill: planPrefill(country.name, route) } });

  return (
    <div style={s.wrap}>
      <div style={s.left}>
        <div style={s.fromRow}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={teal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
          <label htmlFor="wz-from">Planning from</label>
          <select id="wz-from" value={origin.id} onChange={changeOrigin} style={s.select}>
            {ORIGINS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {origin.guessed && <span style={s.hint}>a guess from your time zone</span>}
        </div>
        <h1 style={s.title}>Where do you want to slow down?</h1>
        <p style={s.sub}>
          Countries at their best in {MONTHS_LONG[month - 1]} come first, closest to {origin.name} at the top.
          Pick one and see a route we’d actually take.
        </p>
        <div role="group" aria-label="Country" style={s.grid}>
          {countries.map(c => {
            const on = c === country;
            return (
              <button key={c.name} type="button" aria-pressed={on} style={s.chip(on)} onClick={() => { setPicked(c.name); setRouteIdx(0); }}>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</span>
                <span style={s.chipMeta(on)}>
                  {c.hours ? `about ${c.hours} h flight` : ''}{c.goodRoutes ? ` · good in ${MONTHS[month - 1]}` : ''}
                </span>
              </button>
            );
          })}
        </div>
        <p style={{ ...s.small, fontSize: 14 }}>
          Going somewhere else? <a href="/plan" style={{ color: teal }}>Plan any country →</a>
        </p>
      </div>

      <div style={s.card}>
        <CreditedPhoto
          key={route.id}
          destination={country.name}
          keyword={route.photoQuery}
          size="card"
          alt={`${route.name}, ${country.name}`}
          loading="eager"
          style={{ height: 270 }}
          corner="bottom-right"
        />
        <div style={s.body}>
          <div role="tablist" aria-label={`Routes in ${country.name}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {country.routes.map((r, i) => (
              <button key={r.id} type="button" role="tab" aria-selected={r === route} style={s.tab(r === route)} onClick={() => setRouteIdx(i)}>
                {r.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={s.pill('rgba(0,212,170,0.14)', '#7fffe0')}>{route.days} days</span>
            <span style={s.pill('rgba(255,255,255,0.08)', 'rgba(255,255,255,0.88)')}>Longest hop {route.longestTransferHours} h</span>
            {route.kidFriendly && <span style={s.pill('rgba(255,217,61,0.16)', '#ffe78a')}>Good with kids</span>}
            <span style={s.pill(good ? 'rgba(0,212,170,0.14)' : 'rgba(255,255,255,0.08)', good ? '#7fffe0' : 'rgba(255,255,255,0.88)')}>
              {good ? `Good in ${MONTHS[month - 1]}` : `Best ${bestLabel(route)}`}
            </span>
          </div>
          {!good && route.seasonNote && <p style={s.small}>{route.seasonNote}.</p>}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {route.stops.map((st, i) => (
              <li key={`${st.name}-${i}`} style={s.stop}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 18 }}>
                  <span aria-hidden="true" style={s.dot} />
                  {i < route.stops.length - 1 && <span aria-hidden="true" style={s.line} />}
                </div>
                <div style={{ paddingBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 12, flex: '1 1 auto' }}>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: 21, color: '#fff' }}>{st.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, whiteSpace: 'nowrap' }}>{st.days} {st.days === 1 ? 'day' : 'days'}</span>
                </div>
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <button type="button" style={s.cta} onClick={plan}>Plan this route, free</button>
            <a href={`/guides/${country.slug}`} style={s.link}>Read the {country.name} guide</a>
          </div>
          <p style={s.small}>Day 1 written in full for free. You can change towns and days on the next step.</p>
        </div>
      </div>
    </div>
  );
}
