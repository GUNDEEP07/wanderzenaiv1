// src/pages/PlanTrip.jsx
// Orchestrator for the multi-step itinerary planning form.
// Steps 0–1 are new components (DestinationSearch, VenueSelection).
// Steps 2–5 are existing steps.
// Step 4 is extracted to StepReview.jsx.
// API calls are in src/api/itinerary.js.

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DestinationSearch } from '../components/plantrip/DestinationSearch';
import { VenueSelection } from '../components/plantrip/VenueSelection';
import StepReview from '../components/plantrip/StepReview';
import { fetchPreview, submitItinerary } from '../api/itinerary';
import { useAuth } from '../context/AuthContext';
import { analytics } from '../utils/analytics';
import { getUserLocationFromIP } from '../utils/geolocation';
import { getCurrencyForCountry } from '../utils/countryToCurrency';

// ─── Constants ────────────────────────────────────────────────────────────────

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

// Step names drive the progress bar — keep in sync with step indices
const STEPS = ['Destination', 'Venues', 'Travel dates', 'Travel style', 'Your details', 'Review'];

// Initial form state — all fields null-safe
const INITIAL_FORM = {
  destinations: [], days: 5, budget: '',
  currency: (typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency')) || 'USD',
  travelerType: '', travelStyle: [], interests: '',
  travelDate: '', travelPace: 'balanced', wantsHotelRecs: true,
  startTime: '09:00', userMustDos: '',
  language: 'English', userAge: '', userLocation: '', email: '',
  selected_venues: {},
  day_assignments: {},   // ← day→venue mapping from VenueSelection
};

// ─── Styles ────────────────────────────────────────────────────────────────────
// Matches the s-object pattern used in Pricing.jsx, Landing.jsx, etc.

const s = {
  page: { minHeight: '100vh', background: '#0a0f1e', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  inner: { maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem 4rem' },
  card: { background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '2.5rem', marginBottom: '1rem' },
  stepLabel: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '0.5rem' },
  stepTitle: { fontFamily: "'Fraunces', serif", fontSize: '2rem', color: '#fff', marginBottom: '0.5rem', lineHeight: 1.35, letterSpacing: '-0.02em' },
  stepSub: { color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', marginBottom: '2rem', fontStyle: 'italic' },
  fieldWrap: { marginBottom: '1.75rem' },
  label: { display: 'block', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '0.75rem' },
  input: { width: '100%', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.05rem', outline: 'none', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
  inputError: { borderColor: '#ff6b6b' },
  error: { fontSize: '0.8rem', color: '#ff6b6b', marginTop: '0.4rem' },
  daysRow: { display: 'flex', alignItems: 'center', gap: '1rem' },
  daysBtn: { width: 44, height: 44, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' },
  daysNum: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '2.5rem', fontWeight: 800, color: '#00d4aa', minWidth: 60, textAlign: 'center' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' },
  choiceBtn: (sel) => ({
    padding: '0.75rem 1rem',
    border: `${sel ? '2px' : '1px'} solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 10,
    background: sel ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.07)',
    color: sel ? '#00d4aa' : 'rgba(255,255,255,0.6)',
    cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: '0.875rem', fontWeight: sel ? 700 : 400,
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
  textarea: { width: '100%', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', resize: 'vertical', outline: 'none', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
  toggle: (on) => ({ width: 44, height: 24, borderRadius: 12, background: on ? '#00d4aa' : 'rgba(255,255,255,0.12)', flexShrink: 0, position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }),
  toggleThumb: (on) => ({ position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: on ? '#0a0f1e' : 'rgba(255,255,255,0.4)', transition: 'left 0.2s' }),
  summaryBox: { background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.75rem' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.35rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  navBtns: { display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' },
  backBtnForm: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.9rem', color: 'rgba(255,255,255,0.4)', transition: 'color 0.2s' },
  nextBtn: { background: '#00d4aa', color: '#0a0f1e', border: 'none', padding: '0.875rem 2rem', borderRadius: 12, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', marginLeft: 'auto' },
  footerNote: { textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' },
  submitError: { marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, fontSize: '0.875rem', color: '#ff6b6b' },
  select: { width: '100%', padding: '0.875rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1rem', outline: 'none', cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || {};

  const [step, setStep] = useState(() => {
    if (location.state?.startStep != null) return location.state.startStep;
    try {
      const saved = sessionStorage.getItem('wz_plan_step');
      if (saved != null) return parseInt(saved, 10);
    } catch { /* ignore */ }
    return 0;
  });

  const [form, setForm] = useState(() => {
    if (Object.keys(prefill).length > 0) return { ...INITIAL_FORM, ...prefill };
    try {
      const saved = sessionStorage.getItem('wz_plan_form');
      if (saved) return { ...INITIAL_FORM, ...JSON.parse(saved) };
    } catch { /* ignore corrupt storage */ }
    return { ...INITIAL_FORM };
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [venueSelState, setVenueSelState] = useState(null);
  const { currentUser, getIdToken } = useAuth();
  const [personalRecs, setPersonalRecs] = useState([]);
  const [preferredActivities, setPreferredActivities] = useState([]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const token = await getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, recsRes] = await Promise.allSettled([
          fetch(`${import.meta.env.VITE_API_URL}/profile`, { headers }),
          fetch(`${import.meta.env.VITE_API_URL}/recommendations/personalised`, { headers }),
        ]);
        if (profileRes.status === 'fulfilled') {
          const d = await profileRes.value.json();
          if (d.profile) {
            const p = d.profile;
            setForm(f => ({
              ...f,
              email:        currentUser.email || f.email,
              userAge:      p.age ? String(p.age) : f.userAge,
              userLocation: p.home_city || f.userLocation,
              language:     p.language || f.language,
            }));
          }
        }
        if (recsRes.status === 'fulfilled') {
          const d = await recsRes.value.json();
          if (d.recommendations) setPersonalRecs(d.recommendations);
          if (d.preferred_activities) setPreferredActivities(d.preferred_activities);
        }
      } catch { /* graceful */ }
    })();
  }, [currentUser]);

  // Auto-detect currency from IP if no saved preference
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency')) return;
    const SUPPORTED = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'JPY'];
    getUserLocationFromIP()
      .then(({ countryCode }) => {
        const detected = getCurrencyForCountry(countryCode);
        if (SUPPORTED.includes(detected)) {
          setForm(f => ({ ...f, currency: detected }));
        }
      })
      .catch(() => {});
  }, []);

  // Persist form to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('wz_plan_form', JSON.stringify(form));
    } catch { /* ignore */ }
  }, [form]);

  // Wrapper for setStep that also persists to sessionStorage
  const goToStep = (n) => {
    const clamped = Math.max(0, Math.min(n, STEPS.length - 1));
    setStep(clamped);
    try { sessionStorage.setItem('wz_plan_step', String(clamped)); } catch { /* ignore */ }
  };

  // Field setter — clears error on change
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const setCurrency = (code) => {
    set('currency', code);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('wz_currency', code);
    }
  };

  const toggleStyle = (style) => {
    setForm(f => ({
      ...f,
      travelStyle: f.travelStyle.includes(style)
        ? f.travelStyle.filter(s => s !== style)
        : [...f.travelStyle, style],
    }));
  };

  const handleDestinationSelect = (destinations) => {
    setForm(f => ({
      ...f,
      destinations: Array.isArray(destinations) ? destinations : [destinations],
    }));
  };

  const handleVenueSelect = (venueData) => {
    setForm(f => ({
      ...f,
      selected_venues: venueData.venues || venueData,
      day_assignments: venueData.dayAssignments || {},
    }));
    goToStep(2);
  };

  // Calls /preview and stores result on form._preview
  const loadPreview = async (formData) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const data = await fetchPreview(formData);
      setPreview(data.days || null);
    } catch (e) {
      console.error('Preview failed', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (step === 0 && form.destinations.length === 0) errs.destination = 'Select at least one destination';
    if (step === 4) {
      if (!form.email.trim()) errs.email = 'We need your email to send the itinerary';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    const nextStep = step + 1;
    goToStep(nextStep);
    analytics.stepReached(STEPS[nextStep], nextStep);
    if (nextStep === 5) loadPreview(form);
  };

  const back = () => goToStep(step - 1);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const { status, data } = await submitItinerary(form);
      if (status === 402) {
        analytics.freeLimitHit();
        const dest = form.destinations.length > 0 ? form.destinations[0].name : null;
        navigate('/pricing', { state: { reason: 'free_limit', destination: dest } });
        return;
      }
      if (!data.success) throw new Error(data.message || 'Submission failed');
      const destinationName = form.destinations.length > 0 ? form.destinations[0].name : 'Unknown';
      analytics.tripSubmitted({ destination: destinationName, days: form.days, travelStyle: form.travelStyle });
      sessionStorage.removeItem('wz_plan_step');
      sessionStorage.removeItem('wz_plan_form');
      navigate('/confirmation', {
        state: { submissionId: data.data.submissionId, destination: destinationName, email: form.email },
      });
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const progressBar = (
    <div className="plantrip-progress">
      {STEPS.map((_, i) => {
        const isDone = i < step;
        const isActive = i === step;
        let cls = 'plantrip-progress__seg';
        if (isDone) cls += ' plantrip-progress__seg--done';
        else if (isActive) cls += ' plantrip-progress__seg--active';
        return (
          <div
            key={i}
            className={cls}
            onClick={isDone ? () => goToStep(i) : undefined}
            style={isDone ? { cursor: 'pointer' } : undefined}
            title={isDone ? `Go back to ${STEPS[i]}` : undefined}
          />
        );
      })}
    </div>
  );

  const sharedStyles = `
    input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.4); }
    input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
    select option { background: #111827; color: #fff; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;

  /* ── Step 1 (Venues): full-bleed, full-height ────────────────────── */
  if (step === 1 && form.destinations.length > 0) {
    return (
      <div style={{ ...s.page, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <style>{sharedStyles}</style>
        <nav className="plantrip-nav" style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--desktop-pad, 2.5rem)', background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0a0f1e' }}>W</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
          </a>
          <button type="button" onClick={() => { sessionStorage.removeItem('wz_plan_step'); sessionStorage.removeItem('wz_plan_form'); navigate('/'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>✕ Exit</button>
        </nav>
        <div style={{ padding: '12px 24px 0' }}>
          {progressBar}
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginTop: 8, paddingBottom: 4 }}>
            Step 2 of 6 — Choose your experiences
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <VenueSelection
            destinations={form.destinations}
            travelStyles={form.travelStyle}
            startDate={form.travelDate}
            endDate={form.travelDate
              ? new Date(new Date(form.travelDate).getTime() + form.days * 24 * 60 * 60 * 1000)
                  .toISOString().split('T')[0]
              : null}
            days={form.days}
            onSubmit={handleVenueSelect}
            onSkip={() => goToStep(2)}
            onBack={() => goToStep(0)}
            savedState={venueSelState}
            onSave={setVenueSelState}
            preferredActivities={preferredActivities}
            currency={form.currency}
            budget={form.budget}
            userLocation={form.userLocation}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <style>{sharedStyles}</style>

      <nav className="plantrip-nav" style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--desktop-pad, 2.5rem)', background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0a0f1e' }}>W</div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
        </a>
        <button type="button" onClick={() => { sessionStorage.removeItem('wz_plan_step'); sessionStorage.removeItem('wz_plan_form'); navigate('/'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>✕ Exit</button>
      </nav>

      <div style={s.inner}>
        <div style={{ marginBottom: '2rem' }}>{progressBar}</div>

        {/* All steps — inside the card */}
        {(step !== 1 || form.destinations.length === 0) && (
        <div style={s.card}>

          {/* ── Step 0: Destination Search ─────────────────────────────────── */}
          {(step === 0 || (step === 1 && form.destinations.length === 0)) && (
            <div>
              <div style={s.stepLabel}>Step 1 of 6</div>
              <h2 style={s.stepTitle}>Where to?</h2>
              <p style={s.stepSub}>Tell us your dream destination — we'll find the real, local version of it.</p>

              <div style={s.fieldWrap}>
                <DestinationSearch onSelect={handleDestinationSelect} disabled={false} allowMultiple={true} />
                {errors.destination && <div style={s.error}>{errors.destination}</div>}
                {personalRecs.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Based on your travels</div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {personalRecs.map((rec, i) => (
                        <button type="button" key={i} onClick={() => handleDestinationSelect({ name: rec.destination.split(',')[0].trim(), lat: 0, lng: 0 })} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.07)', color: '#00d4aa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {rec.emoji} {rec.destination.split(',')[0].trim()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>How many days?</label>
                <div style={s.daysRow}>
                  <button type="button" style={s.daysBtn} onClick={() => set('days', Math.max(1, form.days - 1))}>−</button>
                  <div style={s.daysNum}>{form.days}</div>
                  <button type="button" style={s.daysBtn} onClick={() => set('days', Math.min(30, form.days + 1))}>+</button>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>days</span>
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Total budget <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${errors.budget ? '#ff6b6b' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, overflow: 'hidden' }}>
                  <select
                    style={{ padding: '0.875rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: 'none', color: 'rgba(255,255,255,0.7)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.85rem', outline: 'none', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}
                    value={form.currency}
                    onChange={e => setCurrency(e.target.value)}
                  >
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label.match(/\((.+)\)/)?.[1] || c.code}</option>)}
                  </select>
                  <input
                    style={{ ...s.input, border: 'none', borderRadius: 0, flex: 1 }}
                    type="number" min="0" placeholder="e.g. 5000"
                    value={form.budget}
                    onChange={e => set('budget', e.target.value)}
                  />
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Travelling as</label>
                <div style={s.grid2}>
                  {TRAVELER_TYPES.map(t => (
                    <button type="button" key={t} style={s.choiceBtn(form.travelerType === t)} onClick={() => set('travelerType', t)}>{t}</button>
                  ))}
                </div>
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Travel style <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(pick any)</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {TRAVEL_STYLES.map(st => (
                    <button type="button" key={st} style={s.tag(form.travelStyle.includes(st))} onClick={() => toggleStyle(st)}>{st}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Travel dates ──────────────────────────────── */}
          {step === 2 && (
            <div>
              <div style={s.stepLabel}>Step 3 of 6</div>
              <h2 style={s.stepTitle}>Travel dates</h2>
              <p style={s.stepSub}>When are you heading off? This helps us check flight options and seasonal highlights.</p>
              <div style={s.fieldWrap}>
                <label style={s.label}>Start date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <input style={s.input} type="date" value={form.travelDate} onChange={e => set('travelDate', e.target.value)} />
              </div>
            </div>
          )}

          {/* ── Step 3: Travel style ────────────────────────────────── */}
          {step === 3 && (
            <div>
              <div style={s.stepLabel}>Step 4 of 6</div>
              <h2 style={s.stepTitle}>How do you travel?</h2>
              <p style={s.stepSub}>This shapes the entire plan: activities, pace, food and accommodation.</p>

              <div style={s.fieldWrap}>
                <label style={s.label}>Pace</label>
                <div style={s.grid3}>
                  {PACE_OPTIONS.map(p => (
                    <button type="button" key={p.val} style={{ ...s.choiceBtn(form.travelPace === p.val), padding: '0.875rem' }} onClick={() => set('travelPace', p.val)}>
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
                  value={form.interests}
                  onChange={e => set('interests', e.target.value)}
                />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Your age <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <input style={s.input} type="number" min="16" max="99" placeholder="e.g. 28" value={form.userAge} onChange={e => set('userAge', e.target.value)} />
              </div>

              <div style={s.fieldWrap}>
                <label style={s.label}>Where are you based? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <input style={s.input} type="text" placeholder="e.g. Sydney, Australia · Mumbai, India · London, UK" value={form.userLocation} onChange={e => set('userLocation', e.target.value)} />
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

          {/* ── Step 4: Your details ────────────────────────────────── */}
          {step === 4 && (
            <div>
              <div style={s.stepLabel}>Step 5 of 6</div>
              <h2 style={s.stepTitle}>Where should we send it?</h2>
              <p style={s.stepSub}>Your personalised {form.destinations.length > 0 ? form.destinations[0].name : 'itinerary'} itinerary arrives in your inbox within 3 minutes.</p>

              <div style={s.summaryBox}>
                {[
                  ['Destinations', form.destinations.map(d => d.name).join(', ') || '—'],
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
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
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

          {/* ── Step 5: Review & Preview (extracted component) ─────── */}
          {step === 5 && (
            <StepReview
              form={form}
              set={set}
              onBack={back}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitError={submitError}
            />
          )}

          {/* Nav buttons — steps 0–4 only; step 5 has its own buttons */}
          {step < 5 && (
            <div style={s.navBtns}>
              {step > 0 && (
                <button type="button" style={s.backBtnForm} onClick={back} disabled={submitting}>← Back</button>
              )}
              <div style={{ flex: 1 }} />
              <button
                type="button"
                style={{
                  ...s.nextBtn,
                  ...(submitting ? { background: 'rgba(0,212,170,0.5)', cursor: 'not-allowed' } : {}),
                  ...(step === 4 ? { minWidth: 200 } : {}),
                }}
                onClick={next}
                disabled={submitting}
              >
                {step === 4 ? 'Review my trip →' : 'Continue →'}
              </button>
            </div>
          )}
        </div>
        )}

        <div style={s.footerNote}>Free plan · 1 itinerary per month · No card required</div>
      </div>
    </div>
  );
}
