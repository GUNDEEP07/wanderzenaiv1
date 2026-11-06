import React, { useEffect, useRef, useState } from 'react';
import { DestinationSearch } from './DestinationSearch';

/**
 * Step 3 of 6 — "Your route" (route first, option B — Gundeep, Nov 6 2026).
 *
 * 1. Suggests 2–3 ready-made routes for the trip straight away (hand-curated for the
 *    launch countries, Claude for the rest), each with stops, days, longest transfer,
 *    and a heads-up when it doesn't suit the travellers (kids, travel-time limit).
 * 2. The traveller taps "This looks good" — no research needed — and can still tweak
 *    days, order and stops, or ask for other ideas.
 *
 * State: the chosen route lives on the form (it is submitted); the suggested options,
 * loading and error are owned by PlanTrip as separate state.
 */

const MODE_ICON = { train: '🚆', bus: '🚌', car: '🚗', ferry: '⛴️', flight: '✈️', walk: '🥾', other: '🧭' };
const MAX_BASES = 6;

const s = {
  summary: { color: 'rgba(255,255,255,0.65)', fontSize: '0.95rem', marginBottom: '1.25rem', lineHeight: 1.6 },
  counter: (ok) => ({ fontSize: '0.8rem', fontWeight: 700, color: ok ? '#00d4aa' : '#ff6b6b', marginBottom: '1rem' }),
  option: (fits) => ({ background: 'rgba(255,255,255,0.03)', border: `1px solid ${fits ? 'rgba(0,212,170,0.35)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: '1.1rem 1.2rem', marginBottom: '0.9rem' }),
  optionTop: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  optionName: { color: '#fff', fontWeight: 800, fontSize: '1.05rem' },
  badge: (tone) => ({ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 100, border: `1px solid ${tone === 'teal' ? 'rgba(0,212,170,0.35)' : 'rgba(255,255,255,0.15)'}`, color: tone === 'teal' ? '#00d4aa' : 'rgba(255,255,255,0.55)' }),
  chain: { color: '#fff', fontSize: '0.9rem', margin: '0.55rem 0', lineHeight: 1.6 },
  meta: { color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem' },
  caution: { color: '#ffb86b', fontSize: '0.8rem', marginTop: '0.4rem' },
  choose: { marginTop: '0.8rem', padding: '0.6rem 1.2rem', borderRadius: 10, border: 'none', background: '#00d4aa', color: '#0a1628', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem' },
  card: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1rem 1.1rem' },
  cardTop: { display: 'flex', alignItems: 'flex-start', gap: '0.75rem' },
  num: { width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,212,170,0.12)', color: '#00d4aa', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { color: '#fff', fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.3 },
  place: { color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' },
  range: { color: '#00d4aa', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', marginTop: 2 },
  why: { color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', lineHeight: 1.55, marginTop: '0.5rem' },
  stay: { color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: '0.35rem' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: '0.6rem' },
  chip: { fontSize: '0.75rem', padding: '3px 10px', borderRadius: 100, border: '1px solid rgba(0,212,170,0.25)', color: '#00d4aa', background: 'rgba(0,212,170,0.05)' },
  stepper: { display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 },
  stepBtn: { width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 },
  stepNum: { color: '#fff', fontWeight: 700, minWidth: 48, textAlign: 'center', fontSize: '0.85rem' },
  actions: { display: 'flex', gap: 10, marginTop: '0.75rem' },
  link: { background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' },
  transfer: { display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', padding: '0.6rem 0 0.6rem 1.1rem', borderLeft: '2px dashed rgba(0,212,170,0.25)', marginLeft: '1.6rem' },
  loading: { textAlign: 'center', padding: '3rem 1rem', color: 'rgba(255,255,255,0.55)' },
  spinner: { width: 28, height: 28, margin: '0 auto 1rem', borderRadius: '50%', border: '2px solid #00d4aa', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' },
  errorBox: { background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 12, padding: '1rem', color: '#ff9b9b', fontSize: '0.9rem', marginBottom: '1rem' },
  secondaryBtn: { padding: '0.6rem 1.1rem', borderRadius: 10, border: '1px solid rgba(0,212,170,0.35)', background: 'transparent', color: '#00d4aa', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 600 },
  note: { color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '1.25rem' },
};

/** Day ranges for each base, e.g. ["Days 1–4", "Days 5–7", "Day 8"]. */
export function dayRanges(bases) {
  let day = 1;
  return (bases || []).map(b => {
    const from = day;
    day += b.days;
    return b.days > 1 ? `Days ${from}–${day - 1}` : `Day ${from}`;
  });
}

/**
 * What a route was planned for. A different destination, length, kids or travel-time
 * comfort needs new suggestions.
 */
export const routeKey = (form) => {
  const p = form.tripPrefs || {};
  return [form.destinations?.[0]?.name || '', form.days, (p.kids || []).join('.'), p.transferComfort || 'medium', p.overnightOk ? 1 : 0].join('|');
};

const hours = (h) => (h ? `~${h} h` : 'no transfers');
const transferText = (t) => (t
  ? `${t.mode[0].toUpperCase()}${t.mode.slice(1)}${t.hours ? ` · ~${t.hours} h` : ''}${t.note ? ` — ${t.note}` : ''}`
  : 'Getting here: we\'ll suggest the best way in your itinerary');

function OptionCard({ option, onChoose }) {
  return (
    <div style={s.option(option.fitsConstraints !== false)}>
      <div style={s.optionTop}>
        <div style={s.optionName}>{option.name}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {option.source === 'curated' && <span style={s.badge('teal')}>WanderZen pick</span>}
          {option.kidFriendly && <span style={s.badge('teal')}>Kid-friendly</span>}
        </div>
      </div>
      <div style={s.chain}>
        {option.bases.map((b, i) => (
          <React.Fragment key={`${b.name}-${i}`}>
            {i > 0 && <span style={{ color: 'rgba(255,255,255,0.3)' }}> → </span>}
            <strong>{b.name}</strong> <span style={{ color: '#00d4aa' }}>{b.days}d</span>
          </React.Fragment>
        ))}
      </div>
      {option.summary && <div style={s.meta}>{option.summary}</div>}
      <div style={{ ...s.meta, marginTop: 4 }}>Longest transfer: {hours(option.longestTransferHours)}</div>
      {option.caution && <div style={s.caution}>⚠︎ {option.caution}</div>}
      <button type="button" style={s.choose} onClick={() => onChoose(option)}>This looks good →</button>
    </div>
  );
}

export default function StepRoute({ form, route, options = [], optionsKey = null, loading, error, onPlan, onChoose, onChange, errorText }) {
  const key = routeKey(form);
  const chosen = route && route.forKey === key ? route : null;
  const bases = chosen?.bases || [];
  const total = bases.reduce((a, b) => a + (b.days || 0), 0);
  const days = +form.days;
  const ranges = dayRanges(bases);
  const asked = useRef(null);
  const [browsing, setBrowsing] = useState(false); // showing the options again after choosing
  const shown = optionsKey === key ? options : []; // never show routes planned for another trip

  // Suggest routes on arrival, and again when the trip or the travellers changed.
  useEffect(() => {
    if (loading || chosen) return;
    if (shown.length) return;
    if (asked.current === key) return; // don't loop on a failed request
    asked.current = key;
    onPlan({ more: false });
  }, [key, loading, chosen]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (nextBases) => onChange({ ...chosen, bases: nextBases.map((b, i) => (i === 0 ? { ...b, transferIn: null } : b)) });
  const setDays = (i, delta) => update(bases.map((b, j) => (j === i ? { ...b, days: Math.max(1, Math.min(30, b.days + delta)) } : b)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= bases.length) return;
    const next = [...bases];
    [next[i], next[j]] = [next[j], next[i]];
    update(next.map((b, k) => (k === i || k === j ? { ...b, transferIn: null } : b))); // transfers were for the old order
  };
  const remove = (i) => {
    if (bases.length <= 1) return;
    const removed = bases[i];
    const next = bases.filter((_, j) => j !== i);
    const k = Math.min(i, next.length - 1); // its days go to the neighbour
    next[k] = { ...next[k], days: next[k].days + removed.days, transferIn: k === i ? null : next[k].transferIn };
    update(next);
  };
  const add = (picked) => {
    const d = Array.isArray(picked) ? picked[picked.length - 1] : picked;
    if (!d?.name || bases.length >= MAX_BASES) return;
    update([...bases, {
      name: d.name.split(',')[0].trim(), country: d.country || null, region: null,
      lat: d.lat || null, lng: d.lng || null, days: 1,
      why: null, stayType: null, transferIn: null, dayTrips: [],
    }]);
  };

  if (loading) {
    return (
      <div style={s.loading}>
        <div style={s.spinner} />
        <div>Finding the best routes through {form.destinations?.[0]?.name || 'your destination'}…</div>
        <div style={{ fontSize: '0.8rem', marginTop: 6, color: 'rgba(255,255,255,0.35)' }}>Matching stops and travel times to who's travelling.</div>
      </div>
    );
  }

  // ── Choose one of the suggested routes ────────────────────────────────
  if (!chosen || browsing) {
    return (
      <div>
        {error && (
          <div style={s.errorBox}>
            {error}
            <div style={{ marginTop: 10 }}>
              <button type="button" style={s.secondaryBtn} onClick={() => { asked.current = null; onPlan({ more: false }); }}>Try again</button>
            </div>
          </div>
        )}
        {shown.map(o => (
          <OptionCard key={o.id + o.name} option={o} onChoose={(opt) => { setBrowsing(false); onChoose(opt); }} />
        ))}
        {shown.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button type="button" style={s.secondaryBtn} onClick={() => onPlan({ more: true })}>Show other ideas</button>
            {chosen && <button type="button" style={s.link} onClick={() => setBrowsing(false)}>← Back to my route</button>}
          </div>
        )}
        {errorText && <div style={{ fontSize: '0.8rem', color: '#ff6b6b', marginTop: '0.75rem' }}>{errorText}</div>}
      </div>
    );
  }

  // ── The chosen route, editable ────────────────────────────────────────
  return (
    <div>
      {chosen.name && <div style={{ color: '#fff', fontWeight: 800, marginBottom: 4 }}>{chosen.name}</div>}
      {chosen.summary && <p style={s.summary}>{chosen.summary}</p>}

      <div style={s.counter(total === days)}>
        {total === days ? `✓ All ${days} days placed` : `${total} of ${days} days placed — adjust the days so they add up to ${days}`}
      </div>

      {bases.map((b, i) => (
        <React.Fragment key={`${b.name}-${i}`}>
          {i > 0 && (
            <div style={s.transfer}>
              <span>{MODE_ICON[b.transferIn?.mode] || '🧭'}</span>
              <span>{transferText(b.transferIn)}</span>
            </div>
          )}
          <div style={s.card}>
            <div style={s.cardTop}>
              <div style={s.num}>{i + 1}</div>
              <div style={{ minWidth: 0 }}>
                <div style={s.name}>{b.name}</div>
                {(b.region || b.country) && <div style={s.place}>{[b.region, b.country].filter(Boolean).join(', ')}</div>}
                <div style={s.range}>{ranges[i]}{i > 0 ? ' · first day is a travel day' : ''}</div>
              </div>
              <div style={s.stepper} aria-label={`Days in ${b.name}`}>
                <button type="button" style={s.stepBtn} onClick={() => setDays(i, -1)} disabled={b.days <= 1} aria-label={`One day less in stop ${i + 1}, ${b.name}`}>−</button>
                <span style={s.stepNum}>{b.days} day{b.days > 1 ? 's' : ''}</span>
                <button type="button" style={s.stepBtn} onClick={() => setDays(i, +1)} aria-label={`One day more in stop ${i + 1}, ${b.name}`}>+</button>
              </div>
            </div>
            {b.why && <div style={s.why}>{b.why}</div>}
            {b.stayType && <div style={s.stay}>Stay: {b.stayType}</div>}
            {b.dayTrips?.length > 0 && (
              <div style={s.chips}>
                {b.dayTrips.map(t => <span key={t.name} style={s.chip} title={t.why || ''}>Day trip: {t.name}</span>)}
              </div>
            )}
            <div style={s.actions}>
              {i > 0 && <button type="button" style={s.link} onClick={() => move(i, -1)}>↑ Earlier</button>}
              {i < bases.length - 1 && <button type="button" style={s.link} onClick={() => move(i, +1)}>↓ Later</button>}
              {bases.length > 1 && <button type="button" style={s.link} onClick={() => remove(i)}>✕ Remove</button>}
            </div>
          </div>
        </React.Fragment>
      ))}

      {bases.length < MAX_BASES && (
        <div style={{ marginTop: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.5rem' }}>
            Add a stop
          </div>
          {/* Remounts after each add so the box is empty again. */}
          <DestinationSearch key={bases.length} onSelect={add} disabled={false} allowMultiple={false} initialSelected={null} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem', flexWrap: 'wrap' }}>
        <button type="button" style={s.secondaryBtn} onClick={() => setBrowsing(true)}>↺ Choose a different route</button>
      </div>
      <p style={s.note}>The next steps suggest places around these stops, and your itinerary keeps each day close to where you're staying.</p>
      {errorText && <div style={{ fontSize: '0.8rem', color: '#ff6b6b', marginTop: '0.75rem' }}>{errorText}</div>}
    </div>
  );
}
