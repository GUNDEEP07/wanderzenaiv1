import { useState } from 'react';
import { DestinationSearch } from './DestinationSearch';
import { CountryChips, WhoIsTravelling } from './WhoIsTravelling';
import { todayIso, addDaysIso, tripDatesText, MIN_DAYS, MAX_DAYS } from '../../utils/tripDates';

/**
 * Step 1 — Trip basics (Nov 2026 redesign): where, how long and when, who, pace, budget.
 * Interests, language, travel between stops and start-of-day sit under "More options".
 */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'JPY'];
const PACES = [
  { val: 'relaxed', label: 'Relaxed' },
  { val: 'balanced', label: 'Balanced' },
  { val: 'packed', label: 'Full days' },
];
export const INTERESTS = [
  'Food tours', 'Markets', 'Coffee culture', 'Hiking', 'Beaches', 'Temples', 'Museums', 'History',
  'Photography', 'Wildlife', 'Boating', 'Yoga & Wellness', 'Spas', 'Architecture', 'Local experiences',
  'Nightlife', 'Shopping', 'Wine tasting', 'Road trips', 'Meditation',
];
export const LANGUAGES = [
  ['English', 'English'], ['Hindi', 'हिन्दी (Hindi)'], ['Spanish', 'Español (Spanish)'], ['French', 'Français (French)'],
  ['German', 'Deutsch (German)'], ['Japanese', '日本語 (Japanese)'], ['Arabic', 'العربية (Arabic)'],
  ['Portuguese', 'Português (Portuguese)'], ['Italian', 'Italiano (Italian)'], ['Dutch', 'Nederlands (Dutch)'],
];
const START_TIMES = [['07:00', 'Early (7am)'], ['09:00', 'Morning (9am)'], ['11:00', 'Late (11am)']];

const s = {
  card: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 },
  h2: { margin: 0, fontSize: 16, fontWeight: 800 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.78)' },
  input: (err) => ({ minHeight: 46, borderRadius: 12, border: `1px solid ${err ? '#ff6b6b' : 'rgba(255,255,255,0.15)'}`, background: '#0a0f1e', color: '#fff', padding: '0 12px', fontFamily: 'inherit', fontSize: 15, width: '100%', boxSizing: 'border-box', colorScheme: 'dark' }),
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: '#fff', fontSize: 20, cursor: 'pointer', fontFamily: 'inherit' },
  num: { fontSize: 22, fontWeight: 800, minWidth: 32, textAlign: 'center' },
  seg: (on) => ({ minHeight: 44, borderRadius: 10, border: `1px solid ${on ? '#00d4aa' : 'rgba(255,255,255,0.15)'}`, background: on ? 'rgba(0,212,170,0.12)' : 'transparent', color: on ? '#00d4aa' : 'rgba(255,255,255,0.85)', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 600, cursor: 'pointer' }),
  chip: (on) => ({ minHeight: 38, padding: '0 14px', borderRadius: 19, border: `1px solid ${on ? '#00d4aa' : 'rgba(255,255,255,0.15)'}`, background: on ? 'rgba(0,212,170,0.12)' : 'transparent', color: on ? '#00d4aa' : 'rgba(255,255,255,0.85)', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 600, cursor: 'pointer' }),
  hint: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 },
  error: { fontSize: 13, color: '#ff8a8a' },
  check: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: 14, color: 'rgba(255,255,255,0.85)', cursor: 'pointer' },
  more: { width: '100%', minHeight: 52, borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.88)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', cursor: 'pointer', textAlign: 'left', marginBottom: 12 },
};

const Stepper = ({ label, value, onMinus, onPlus, minusLabel, plusLabel }) => (
  <div style={s.row}>
    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button type="button" style={s.stepBtn} aria-label={minusLabel} onClick={onMinus}>−</button>
      <span style={s.num} aria-live="polite">{value}</span>
      <button type="button" style={s.stepBtn} aria-label={plusLabel} onClick={onPlus}>+</button>
    </div>
  </div>
);

export default function StepBasics({ form, errors = {}, set, setDays, setStartDate, setEndDate, setCurrency, onDestination, personalRecs = [] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const interests = (form.interests || '').split(',').map(x => x.trim()).filter(Boolean);
  const toggleInterest = (name) => {
    const has = interests.some(i => i.toLowerCase() === name.toLowerCase());
    set('interests', (has ? interests.filter(i => i.toLowerCase() !== name.toLowerCase()) : [...interests, name]).join(', '));
  };
  const custom = interests.filter(i => !INTERESTS.some(x => x.toLowerCase() === i.toLowerCase())).join(', ');
  const setCustom = (text) => {
    const presets = interests.filter(i => INTERESTS.some(x => x.toLowerCase() === i.toLowerCase()));
    set('interests', [...presets, ...text.split(',').map(x => x.trim()).filter(Boolean)].join(', '));
  };
  const flexible = !!form.datesFlexible;

  return (
    <div>
      <section style={s.card} aria-labelledby="wz-where">
        <h2 id="wz-where" style={s.h2}>Where to?</h2>
        <CountryChips hint={false} selectedName={form.destinations[0]?.isCountry ? form.destinations[0].name : null} onPick={(d) => onDestination(d)} />
        <DestinationSearch key={form.destinations[0]?.name || 'none'} label="Or search any country or town" onSelect={onDestination} disabled={false} allowMultiple={false} initialSelected={form.destinations} />
        {personalRecs.length > 0 && (
          <div>
            <div style={{ ...s.hint, marginBottom: 6 }}>Based on your travels</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {personalRecs.slice(0, 5).map((rec) => {
                const city = rec.destination.split(',')[0].trim();
                const country = rec.country || rec.destination.split(',')[1]?.trim() || '';
                return <button type="button" key={rec.destination} style={s.chip(false)} onClick={() => onDestination({ name: city, country, lat: null, lng: null })}>{city}</button>;
              })}
            </div>
          </div>
        )}
        {errors.destination && <div role="alert" style={s.error}>{errors.destination}</div>}
      </section>

      <section style={s.card} aria-labelledby="wz-when">
        <h2 id="wz-when" style={s.h2}>How long, and when?</h2>
        <Stepper label="Days" value={form.days} onMinus={() => setDays(form.days - 1)} onPlus={() => setDays(form.days + 1)} minusLabel="One day fewer" plusLabel="One day more" />
        {!flexible && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: 10 }}>
              <label style={s.label} htmlFor="wz-start">Start
                <input id="wz-start" type="date" style={s.input(errors.travelDate)} min={todayIso()} value={form.travelDate} onChange={e => setStartDate(e.target.value)} />
              </label>
              <label style={s.label} htmlFor="wz-end">End (from your days)
                <input id="wz-end" type="date" style={s.input(errors.travelDateEnd)}
                  min={form.travelDate ? addDaysIso(form.travelDate, MIN_DAYS - 1) : todayIso()}
                  max={form.travelDate ? addDaysIso(form.travelDate, MAX_DAYS - 1) : undefined}
                  value={form.travelDateEnd} onChange={e => setEndDate(e.target.value)} />
              </label>
            </div>
            {form.travelDate && form.travelDateEnd && !errors.travelDateEnd && (
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00d4aa' }}>{tripDatesText(form.travelDate, form.travelDateEnd)}</div>
            )}
            {(errors.travelDate || errors.travelDateEnd) && <div role="alert" style={s.error}>{errors.travelDate || errors.travelDateEnd}</div>}
          </>
        )}
        <label style={s.check}>
          <input type="checkbox" style={{ width: 20, height: 20 }} checked={flexible} onChange={e => set('datesFlexible', e.target.checked)} />
          Dates not fixed yet — just plan the days
        </label>
      </section>

      <section style={s.card} aria-labelledby="wz-who">
        <h2 id="wz-who" style={s.h2}>Who's travelling?</h2>
        <WhoIsTravelling part="people" value={form.tripPrefs} onChange={(v) => set('tripPrefs', v)} />
        <div role="group" aria-label="Pace" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {PACES.map(p => (
            <button type="button" key={p.val} aria-pressed={form.travelPace === p.val} style={s.seg(form.travelPace === p.val)} onClick={() => set('travelPace', p.val)}>{p.label}</button>
          ))}
        </div>
      </section>

      <section style={s.card} aria-labelledby="wz-budget">
        <h2 id="wz-budget" style={s.h2}>Budget</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 104px', gap: 8 }}>
          <input type="number" inputMode="numeric" min="0" aria-label="Total budget" placeholder="e.g. 2500" style={s.input(errors.budget)} value={form.budget} onChange={e => set('budget', e.target.value)} />
          <select aria-label="Currency" style={s.input(false)} value={form.currency} onChange={e => setCurrency(e.target.value)}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {errors.budget && <div role="alert" style={s.error}>{errors.budget}</div>}
        <div role="group" aria-label="What the budget covers" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button type="button" aria-pressed={form.budgetScope !== 'activities-only'} style={s.seg(form.budgetScope !== 'activities-only')}
            onClick={() => { set('budgetScope', 'full-trip'); set('alreadyBooked', false); }}>Whole trip</button>
          <button type="button" aria-pressed={form.budgetScope === 'activities-only'} style={s.seg(form.budgetScope === 'activities-only')}
            onClick={() => { set('budgetScope', 'activities-only'); set('alreadyBooked', true); }}>Activities only</button>
        </div>
        <div style={s.hint}>{form.budgetScope === 'activities-only' ? "You've booked flights and stays — we'll plan the days." : 'Flights, stays and activities.'}</div>
      </section>

      <button type="button" style={s.more} aria-expanded={moreOpen} aria-controls="wz-more" onClick={() => setMoreOpen(o => !o)}>
        <span>More options: interests, language, travel between stops{interests.length ? ` · ${interests.length} interest${interests.length > 1 ? 's' : ''}` : ''}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ transform: moreOpen ? 'rotate(180deg)' : 'none', flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {moreOpen && (
        <div id="wz-more">
          <section style={s.card} aria-labelledby="wz-interests">
            <h2 id="wz-interests" style={s.h2}>What do you enjoy?</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {INTERESTS.map(i => {
                const on = interests.some(x => x.toLowerCase() === i.toLowerCase());
                return <button type="button" key={i} aria-pressed={on} style={s.chip(on)} onClick={() => toggleInterest(i)}>{i}</button>;
              })}
            </div>
            <label style={s.label}>Anything else (comma separated)
              <input type="text" style={s.input(false)} placeholder="e.g. street art, pottery, live jazz" value={custom} onChange={e => setCustom(e.target.value)} maxLength={200} />
            </label>
          </section>
          <section style={s.card} aria-labelledby="wz-travel">
            <h2 id="wz-travel" style={s.h2}>Travel between stops</h2>
            <WhoIsTravelling part="travel" value={form.tripPrefs} onChange={(v) => set('tripPrefs', v)} />
          </section>
          <section style={s.card} aria-labelledby="wz-lang">
            <h2 id="wz-lang" style={s.h2}>Language and start of the day</h2>
            <label style={s.label}>Itinerary language
              <select style={s.input(false)} value={form.language} onChange={e => set('language', e.target.value)}>
                {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <div role="group" aria-label="When do you like to start the day?" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {START_TIMES.map(([v, label]) => (
                <button type="button" key={v} aria-pressed={(form.startTime || '09:00') === v} style={s.seg((form.startTime || '09:00') === v)} onClick={() => set('startTime', v)}>{label}</button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
