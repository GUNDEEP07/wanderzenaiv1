import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;
import RecommendationQuiz from '../components/RecommendationQuiz';

const s = {
  page: { minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  nav: { padding: '1.25rem 2.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '12px' },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.2s' },
  logoMark: { width: 28, height: 28, borderRadius: 7, background: '#00d4aa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#0a0f1e' },
  inner: { maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem 4rem' },
  progress: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', marginBottom: '3rem' },
  progressLine: { position: 'absolute', top: 14, left: 14, right: 14, height: 1, background: 'rgba(255,255,255,0.08)', zIndex: 0 },
  progressFill: (pct) => ({ height: '100%', background: '#00d4aa', transition: 'width 0.4s ease', width: pct + '%' }),
  stepDot: (active, done) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', zIndex: 1,
  }),
  dotCircle: (active, done) => ({
    width: 28, height: 28, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 700,
    background: done ? '#00d4aa' : active ? '#00d4aa' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${done || active ? '#00d4aa' : 'rgba(255,255,255,0.12)'}`,
    color: done || active ? '#0a0f1e' : 'rgba(255,255,255,0.4)',
    transition: 'all 0.3s',
  }),
  dotLabel: (active) => ({ fontSize: '0.6rem', color: active ? '#00d4aa' : 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }),
  card: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2.5rem', marginBottom: '1rem' },
  stepLabel: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '0.5rem' },
  stepTitle: { fontFamily: "'Fraunces', serif", fontSize: '2rem', color: '#fff', marginBottom: '0.5rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
  stepSub: { color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', marginBottom: '2rem', fontStyle: 'italic' },
  fieldWrap: { marginBottom: '1.75rem' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.75rem' },
  input: { width: '100%', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.05rem', outline: 'none', transition: 'border-color 0.2s' },
  inputError: { borderColor: '#ff6b6b' },
  error: { fontSize: '0.8rem', color: '#ff6b6b', marginTop: '0.4rem' },
  daysRow: { display: 'flex', alignItems: 'center', gap: '1rem' },
  daysBtn: { width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  daysNum: { fontFamily: "'Fraunces', serif", fontSize: '2.5rem', fontWeight: 700, color: '#00d4aa', minWidth: 60, textAlign: 'center' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' },
  choiceBtn: (sel) => ({
    padding: '0.75rem 1rem', border: `1px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10, background: sel ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)',
    color: sel ? '#00d4aa' : 'rgba(255,255,255,0.6)', cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.875rem', fontWeight: sel ? 700 : 400,
    transition: 'all 0.15s', textAlign: 'left',
  }),
  tag: (sel) => ({
    padding: '0.5rem 1rem', borderRadius: 100,
    border: `1px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`,
    background: sel ? 'rgba(0,212,170,0.1)' : 'transparent',
    color: sel ? '#00d4aa' : 'rgba(255,255,255,0.5)',
    cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '0.875rem', fontWeight: sel ? 600 : 400, transition: 'all 0.15s',
  }),
  textarea: { width: '100%', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', resize: 'vertical', outline: 'none' },
  toggle: (on) => ({ width: 44, height: 24, borderRadius: 12, background: on ? '#00d4aa' : 'rgba(255,255,255,0.12)', flexShrink: 0, position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }),
  toggleThumb: (on) => ({ position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: on ? '#0a0f1e' : 'rgba(255,255,255,0.4)', transition: 'left 0.2s' }),
  summaryBox: { background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.75rem' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  navBtns: { display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' },
  backBtnForm: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', transition: 'color 0.2s' },
  nextBtn: { background: '#00d4aa', color: '#0a0f1e', border: 'none', padding: '0.875rem 2rem', borderRadius: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', marginLeft: 'auto' },
  footerNote: { textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' },
  submitError: { marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, fontSize: '0.875rem', color: '#ff6b6b' },
  select: { width: '100%', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1rem', outline: 'none', cursor: 'pointer' },
};

const CURRENCIES = [
  { code: 'USD', label: 'USD ($)' }, { code: 'EUR', label: 'EUR (€)' },
  { code: 'GBP', label: 'GBP (£)' }, { code: 'INR', label: 'INR (₹)' },
  { code: 'AUD', label: 'AUD (A$)' }, { code: 'CAD', label: 'CAD (C$)' },
  { code: 'SGD', label: 'SGD (S$)' }, { code: 'JPY', label: 'JPY (¥)' },
];

const TRAVELER_TYPES = ['Solo', 'Couple', 'Family', 'Group of friends'];
const TRAVEL_STYLES = ['Nature', 'Relaxation', 'Cultural', 'Foodie', 'Wellness', 'Adventure', 'Luxury'];
const PACE_OPTIONS = [
  { val: 'relaxed', label: 'Relaxed', sub: 'Slow, flexible, breathing room' },
  { val: 'balanced', label: 'Balanced', sub: 'Mix of activities and downtime' },
  { val: 'packed', label: 'Full days', sub: 'See as much as possible' },
];
const LANGUAGES = [
  { code: 'English', label: 'English' },
  { code: 'Hindi', label: 'हिन्दी (Hindi)' },
  { code: 'Spanish', label: 'Español (Spanish)' },
  { code: 'French', label: 'Français (French)' },
  { code: 'German', label: 'Deutsch (German)' },
  { code: 'Japanese', label: '日本語 (Japanese)' },
  { code: 'Arabic', label: 'العربية (Arabic)' },
  { code: 'Portuguese', label: 'Português (Portuguese)' },
  { code: 'Italian', label: 'Italiano (Italian)' },
  { code: 'Dutch', label: 'Nederlands (Dutch)' },
];

const STEPS = ['Destination', 'Budget & dates', 'Travel style', 'Your details', 'Review'];

const initial = {
  destination: '', days: 5, budget: '', currency: 'USD',
  travelerType: '', travelStyle: [], interests: '',
  travelDate: '', travelPace: 'balanced', wantsHotelRecs: true, startTime: '09:00', userMustDos: '',
  language: 'English', userAge: '', userLocation: '', email: '',
};

export default function PlanTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || {};
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...initial, ...prefill });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [preview, setPreview] = useState(null);
const [previewLoading, setPreviewLoading] = useState(false);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const toggleStyle = style => {
    setForm(f => ({
      ...f,
      travelStyle: f.travelStyle.includes(style)
        ? f.travelStyle.filter(s => s !== style)
        : [...f.travelStyle, style],
    }));
  };



  const fetchPreview = async (formData) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const res = await fetch(`${API_URL}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: formData.destination,
          days: +formData.days,
          travelerType: formData.travelerType,
          travelStyle: formData.travelStyle,
          travelPace: formData.travelPace,
          startTime: formData.startTime || '09:00',
          userMustDos: formData.userMustDos || '',
        }),
      });
      const data = await res.json();
      if (data.days) setPreview(data.days);
    } catch (e) {
      console.error('Preview failed', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (step === 0 && !form.destination.trim()) errs.destination = 'Where are you headed?';
    if (step === 1 && (!form.budget || isNaN(form.budget) || +form.budget <= 0)) errs.budget = 'Enter your total budget';
    if (step === 2 && !form.travelerType) errs.travelerType = 'Select traveller type';
    if (step === 3) {
      if (!form.email.trim()) errs.email = 'We need your email to send the itinerary';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (validate()) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep === 4) fetchPreview(form);
    }
  };
  const back = () => setStep(s => s - 1);

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          days: +form.days,
          budget: +form.budget,
          travelDate: form.travelDate && form.travelDate.trim() !== '' ? form.travelDate : null,
          startTime: form.startTime || '09:00',
          userMustDos: form.userMustDos && form.userMustDos.trim() !== '' ? form.userMustDos.trim() : null,
        }),
      });
      const data = await res.json();
      if (res.status === 402) { navigate('/pricing', { state: { reason: 'free_limit' } }); return; }
      if (!res.ok || !data.success) throw new Error(data.message || 'Submission failed');
      navigate('/confirmation', { state: { submissionId: data.data.submissionId, destination: form.destination, email: form.email } });
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const pct = (step / (STEPS.length - 1)) * 100;

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&display=swap');
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
        select option { background: #111827; color: #fff; }
      `}</style>

      <nav style={s.nav}>
        <button style={s.backBtn} onClick={() => navigate('/')}>
          <div style={s.logoMark}>W</div>
          WanderZenAI
        </button>
      </nav>

      <div style={s.inner}>
        {/* Progress */}
        <div style={s.progress}>
          {STEPS.map((name, i) => (
            <div key={name} style={s.stepDot(i === step, i < step)}>
              <div style={s.dotCircle(i === step, i < step)}>
                {i < step ? '✓' : i + 1}
              </div>
              <div style={s.dotLabel(i === step)}>{name}</div>
            </div>
          ))}
          <div style={s.progressLine}>
            <div style={s.progressFill(pct)} />
          </div>
        </div>

        <div style={s.card}>

          {/* Step 0 */}
          {step === 0 && (
            <div>
              <div style={s.stepLabel}>Step 1 of 4</div>
              <h2 style={s.stepTitle}>Where to?</h2>
              <p style={s.stepSub}>Tell us your dream destination — we'll find the real, local version of it.</p>

              <div style={s.fieldWrap}>
                <label style={s.label}>Destination</label>
                <input
                  style={{ ...s.input, fontSize: '1.2rem', ...(errors.destination ? s.inputError : {}) }}
                  type="text" placeholder="e.g. Kyoto · Oaxaca · Tbilisi · Faroe Islands"
                  value={form.destination}
                  onChange={e => set('destination', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && next()}
                  autoFocus
                />
                {errors.destination && <div style={s.error}>{errors.destination}</div>}
                <RecommendationQuiz onSelect={(dest) => { set('destination', dest); }} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>How many days?</label>
                <div style={s.daysRow}>
                  <button style={s.daysBtn} onClick={() => set('days', Math.max(1, form.days - 1))}>−</button>
                  <div style={s.daysNum}>{form.days}</div>
                  <button style={s.daysBtn} onClick={() => set('days', Math.min(30, form.days + 1))}>+</button>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>days</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <div style={s.stepLabel}>Step 2 of 4</div>
              <h2 style={s.stepTitle}>Budget & dates</h2>
              <p style={s.stepSub}>A rough estimate helps us plan realistic activities and stays.</p>

              <div style={s.fieldWrap}>
                <label style={s.label}>Currency</label>
                <div style={s.grid4}>
                  {CURRENCIES.map(c => (
                    <button key={c.code} style={s.choiceBtn(form.currency === c.code)} onClick={() => set('currency', c.code)}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Total trip budget</label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${errors.budget ? '#ff6b6b' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, overflow: 'hidden' }}>
                  <span style={{ padding: '0 1rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem', borderRight: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', background: 'rgba(255,255,255,0.02)' }}>
                    {CURRENCIES.find(c => c.code === form.currency)?.label.match(/\((.+)\)/)?.[1] || form.currency}
                  </span>
                  <input
                    style={{ ...s.input, border: 'none', borderRadius: 0, flex: 1 }}
                    type="number" min="0" placeholder="5000"
                    value={form.budget} onChange={e => set('budget', e.target.value)}
                  />
                </div>
                {errors.budget && <div style={s.error}>{errors.budget}</div>}
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Travel date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <input style={s.input} type="date" value={form.travelDate} onChange={e => set('travelDate', e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <div style={s.stepLabel}>Step 3 of 4</div>
              <h2 style={s.stepTitle}>How do you travel?</h2>
              <p style={s.stepSub}>This shapes the entire plan — activities, pace, food and accommodation.</p>

              <div style={s.fieldWrap}>
                <label style={s.label}>You are travelling as</label>
                <div style={s.grid2}>
                  {TRAVELER_TYPES.map(t => (
                    <button key={t} style={s.choiceBtn(form.travelerType === t)} onClick={() => set('travelerType', t)}>{t}</button>
                  ))}
                </div>
                {errors.travelerType && <div style={s.error}>{errors.travelerType}</div>}
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Travel style <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(pick any)</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {TRAVEL_STYLES.map(st => (
                    <button key={st} style={s.tag(form.travelStyle.includes(st))} onClick={() => toggleStyle(st)}>{st}</button>
                  ))}
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Pace</label>
                <div style={s.grid3}>
                  {PACE_OPTIONS.map(p => (
                    <button key={p.val} style={{ ...s.choiceBtn(form.travelPace === p.val), padding: '0.875rem' }} onClick={() => set('travelPace', p.val)}>
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 400 }}>{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Specific interests <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <textarea
                  style={s.textarea} rows={3}
                  placeholder="e.g. morning hikes, roadside noodle shops, pottery villages, hidden waterfalls..."
                  value={form.interests} onChange={e => set('interests', e.target.value)}
                />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Your age <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <input
                  style={s.input}
                  type="number" min="16" max="99"
                  placeholder="e.g. 28"
                  value={form.userAge}
                  onChange={e => set('userAge', e.target.value)}
                />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Where are you based? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <input
                  style={s.input}
                  type="text"
                  placeholder="e.g. Sydney, Australia · Mumbai, India · London, UK"
                  value={form.userLocation}
                  onChange={e => set('userLocation', e.target.value)}
                />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Itinerary language</label>
                <select style={s.select} value={form.language} onChange={e => set('language', e.target.value)}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>

              <div style={s.fieldWrap}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, cursor: 'pointer' }}
                  onClick={() => set('wantsHotelRecs', !form.wantsHotelRecs)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', marginBottom: 2 }}>Include accommodation suggestions</div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>Homestays, guesthouses and Airbnbs near nature</div>
                  </div>
                  <div style={s.toggle(form.wantsHotelRecs)}>
                    <div style={s.toggleThumb(form.wantsHotelRecs)} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <div style={s.stepLabel}>Step 4 of 4</div>
              <h2 style={s.stepTitle}>Where should we send it?</h2>
              <p style={s.stepSub}>Your personalised {form.destination} itinerary arrives in your inbox within 3 minutes.</p>

              <div style={s.summaryBox}>
                {[
                  ['Destination', form.destination],
                  ['Duration', `${form.days} days`],
                  ['Budget', `${form.currency} ${form.budget}`],
                  ['Traveller', form.travelerType || '—'],
                  ['Pace', form.travelPace],
                  ['Language', form.language],
                  ...(form.userAge ? [['Your age', `${form.userAge} yrs`]] : []),
                  ...(form.userLocation ? [['Based in', form.userLocation]] : []),
                ].map(([k, v]) => (
                  <div key={k} style={s.summaryRow}>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                    <strong style={{ color: '#00d4aa' }}>{v}</strong>
                  </div>
                ))}
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Your email address</label>
                <input
                  style={{ ...s.input, ...(errors.email ? s.inputError : {}) }}
                  type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => set('email', e.target.value)}
                  autoFocus
                />
                {errors.email && <div style={s.error}>{errors.email}</div>}
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  We only use your email to send the itinerary. No spam, ever.
                </div>
              </div>

              {submitError && <div style={s.submitError}>{submitError}</div>}
            </div>
            )}

            {/* Step 4 — Review & Preview */}
          {step === 4 && (
            <div>
              <div style={s.stepLabel}>Step 5 of 5 — Almost there</div>
              <h2 style={s.stepTitle}>Review your trip</h2>
              <p style={s.stepSub}>Tweak anything before we generate your full itinerary.</p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

                {/* Left — editable preferences */}
                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '1rem' }}>Your preferences</div>

                  {/* Destination summary */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Destination & duration</div>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{form.destination} — {form.days} days</div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Budget</div>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{form.currency} {(+form.budget).toLocaleString()}</div>
                  </div>

                  {/* Travel style chips */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Travel style</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Nature', 'Cultural', 'Food & Markets', 'Wellness', 'Adventure', 'Off-grid'].map(style => {
                        const active = form.travelStyle.includes(style);
                        return (
                          <button key={style} onClick={() => {
                            const updated = active
                              ? form.travelStyle.filter(s => s !== style)
                              : [...form.travelStyle, style];
                            set('travelStyle', updated);
                            fetchPreview({ ...form, travelStyle: updated });
                          }} style={{
                            fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20,
                            border: active ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.2)',
                            background: active ? 'rgba(0,212,170,0.15)' : 'transparent',
                            color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}>{style}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pace */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Pace</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {['relaxed', 'balanced', 'fast-paced'].map(p => {
                        const active = form.travelPace === p;
                        return (
                          <button key={p} onClick={() => { set('travelPace', p); fetchPreview({ ...form, travelPace: p }); }} style={{
                            flex: 1, fontSize: '0.72rem', padding: '6px 4px', borderRadius: 8,
                            border: active ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.2)',
                            background: active ? 'rgba(0,212,170,0.15)' : 'transparent',
                            color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                            cursor: 'pointer', textTransform: 'capitalize',
                          }}>{p}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start time */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>When do you start your day?</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ label: '🌅 Early — 7am', value: '07:00' }, { label: '☕ Morning — 9am', value: '09:00' }, { label: '🌞 Late — 11am', value: '11:00' }].map(opt => {
                        const active = (form.startTime || '09:00') === opt.value;
                        return (
                          <button key={opt.value} onClick={() => { set('startTime', opt.value); fetchPreview({ ...form, startTime: opt.value }); }} style={{
                            flex: 1, fontSize: '0.68rem', padding: '6px 4px', borderRadius: 8,
                            border: active ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.2)',
                            background: active ? 'rgba(0,212,170,0.15)' : 'transparent',
                            color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                          }}>{opt.label}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Must-dos */}
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Anything you want included?</div>
                    <textarea
                      value={form.userMustDos || ''}
                      onChange={e => set('userMustDos', e.target.value)}
                      onBlur={() => fetchPreview(form)}
                      placeholder={'e.g. Already booked dinner at Noma on Day 3\nWant to visit Senso-ji at dawn\nMy friend recommended Cafe X'}
                      maxLength={300}
                      rows={4}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
                        color: '#fff', fontSize: '0.8rem', padding: '10px 12px',
                        resize: 'none', outline: 'none', fontFamily: 'inherit',
                        lineHeight: 1.5,
                      }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 3 }}>
                      {(form.userMustDos || '').length} / 300
                    </div>
                  </div>
                </div>

                {/* Right — AI day outline */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '1rem' }}>Day outline preview</div>

                  {previewLoading && (
                    <div>
                      {Array.from({ length: +form.days > 7 ? 7 : +form.days }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ width: 36, height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 4, flexShrink: 0, marginTop: 3 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ width: '60%', height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 5 }} />
                            <div style={{ width: '85%', height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!previewLoading && preview && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {preview.map((d, i) => (
                        <li key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < preview.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', minWidth: 36, paddingTop: 2, flexShrink: 0 }}>Day {d.day}</span>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: 2 }}>{d.theme}</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{d.vibe}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!previewLoading && !preview && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', fontStyle: 'italic', paddingTop: '0.5rem' }}>
                      Preview will appear here…
                    </div>
                  )}
                </div>
              </div>

              {submitError && <p style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '0.9rem' }}>{submitError}</p>}

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={back} style={{ padding: '14px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', cursor: 'pointer' }}>
                  ← Edit
                </button>
                <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: '14px 24px', background: submitting ? 'rgba(0,212,170,0.4)' : '#00d4aa', border: 'none', borderRadius: 10, color: '#0a1628', fontWeight: 700, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                  {submitting ? 'Generating…' : 'Generate full itinerary →'}
                </button>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', textAlign: 'center', marginTop: '0.75rem' }}>Takes 2–3 minutes · PDF delivered by email</p>
            </div>
          )}


          

                  {!previewLoading && preview && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {preview.map((d, i) => (
                        <li key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < preview.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                          <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', minWidth: 36, paddingTop: 2, flexShrink: 0 }}>Day {d.day}</span>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: 2 }}>{d.theme}</div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{d.vibe}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!previewLoading && !preview && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', fontStyle: 'italic', paddingTop: '0.5rem' }}>
                      Preview will appear here…
                    </div>
                  )}
                </div>
              </div>

              {submitError && <p style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '0.9rem' }}>{submitError}</p>}

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={back} style={{ padding: '14px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', cursor: 'pointer' }}>
                  ← Edit
                </button>
                <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: '14px 24px', background: submitting ? 'rgba(0,212,170,0.4)' : '#00d4aa', border: 'none', borderRadius: 10, color: '#0a1628', fontWeight: 700, fontSize: '1rem', cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                  {submitting ? 'Generating…' : 'Generate full itinerary →'}
                </button>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', textAlign: 'center', marginTop: '0.75rem' }}>Takes 2–3 minutes · PDF delivered by email</p>
            </div>
          )}

          {/* Nav buttons */}
          <div style={s.navBtns}>
            {step > 0 && (
              <button style={s.backBtnForm} onClick={back} disabled={submitting}>← Back</button>
            )}
            <div style={{ flex: 1 }} />
            {step < STEPS.length - 1 ? (
              <button style={s.nextBtn} onClick={next}>Continue →</button>
            ) : (
              <button
                style={{ ...s.nextBtn, background: submitting ? 'rgba(0,212,170,0.5)' : '#00d4aa', cursor: submitting ? 'not-allowed' : 'pointer', minWidth: 200 }}
                onClick={submit} disabled={submitting}
              >
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center' }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(10,15,30,0.3)', borderTopColor: '#0a0f1e', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                    Crafting your plan...
                  </span>
                ) : 'Generate my itinerary →'}
              </button>
            )}
          </div>
        </div>

        <div style={s.footerNote}>Free plan · 1 itinerary per month · No card required</div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
