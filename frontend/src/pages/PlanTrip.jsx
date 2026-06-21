// src/pages/PlanTrip.jsx
// Orchestrator for the multi-step itinerary planning form.
// Step 0: Destination & Preferences
// Step 1: Travel dates
// Step 2: Trip Overview (Flights, Hotels, Activities, Budget)
// Step 3: VenueSelection component (full-page)
// Step 3: Review (Email & Summary of all selections)
// Step 4: Preview & Submit (extracted to StepReview.jsx)
// API calls are in src/api/itinerary.js.

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DestinationSearch } from '../components/plantrip/DestinationSearch';
import { VenueSelection } from '../components/plantrip/VenueSelection';
import StepReview from '../components/plantrip/StepReview';
import { fetchPreview, submitItinerary } from '../api/itinerary';
import { fetchDestinationInsights } from '../api/destinationInsights';
import { useAuth } from '../context/AuthContext';
import { analytics } from '../utils/analytics';
import { getUserLocationFromIP } from '../utils/geolocation';
import { getCurrencyForCountry } from '../utils/countryToCurrency';
import { validateBudget } from '../utils/validators/budgetValidator';
import { validateDateRange, calculateTripDays } from '../utils/validators/dateValidator';
import { FlightsSection } from '../components/plantrip/subcomponents/FlightsSection';
import { AccommodationSection } from '../components/plantrip/subcomponents/AccommodationSection';
import { BudgetClarificationBox } from '../components/plantrip/subcomponents/BudgetClarificationBox';

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

const PREDEFINED_INTERESTS = [
  'Hiking', 'Museums', 'Food tours', 'Beaches', 'Temples',
  'Markets', 'Nightlife', 'Shopping', 'Photography', 'History',
  'Yoga & Wellness', 'Coffee culture', 'Wine tasting', 'Boating', 'Wildlife',
  'Architecture', 'Local experiences', 'Spas', 'Meditation', 'Road trips',
];


// Step names drive the progress bar — keep in sync with step indices
const STEPS = ['Destination & Preferences', 'Travel dates', 'Trip Overview', 'Review', 'Submit'];

// Initial form state — all fields null-safe
const INITIAL_FORM = {
  destinations: [], days: 5, budget: '',
  currency: (typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency')) || 'USD',
  travelerType: '', travelStyle: [], interests: '',
  travelDate: '', travelDateEnd: '', travelPace: 'balanced', wantsHotelRecs: true,
  startTime: '09:00', userMustDos: '',
  language: 'English', userAge: '', userLocation: '', email: '',
  selected_venues: {},
  day_assignments: {},   // ← day→venue mapping from VenueSelection
  budgetScope: 'full-trip',  // 'full-trip' or 'activities-only'
  alreadyBooked: false,  // Skip flights/accommodation if true
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
  const [destinationInsights, setDestinationInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

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
          console.log('Personalised recommendations response:', d);
          if (d.recommendations) {
            console.log('Setting personalRecs:', d.recommendations);
            setPersonalRecs(d.recommendations);
          }
          if (d.preferred_activities) setPreferredActivities(d.preferred_activities);
        } else {
          console.error('Recommendations fetch failed:', recsRes.reason);
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

  // Fetch destination insights when entering step 2
  useEffect(() => {
    if (step !== 2) return;
    if (!form.destinations.length || !form.travelDate || !form.travelDateEnd) return;

    const loadInsights = async () => {
      setInsightsLoading(true);
      try {
        const destName = form.destinations[0].name;
        const data = await fetchDestinationInsights(destName, form.travelStyle, form.travelDate, form.travelDateEnd);
        setDestinationInsights(data);
      } catch (err) {
        console.error('Failed to load destination insights:', err);
        setDestinationInsights(null);
      } finally {
        setInsightsLoading(false);
      }
    };

    loadInsights();
  }, [step, form.destinations, form.travelDate, form.travelDateEnd, form.travelStyle]);

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

  const toggleInterest = (interest) => {
    const interestsList = form.interests.split(',').map(i => i.trim()).filter(Boolean);
    const index = interestsList.findIndex(i => i.toLowerCase() === interest.toLowerCase());

    if (index > -1) {
      interestsList.splice(index, 1);
    } else {
      interestsList.push(interest);
    }

    set('interests', interestsList.join(', '));
  };

  const getSelectedInterests = () => {
    return form.interests.split(',').map(i => i.trim()).filter(Boolean);
  };

  const handleDestinationSelect = (destinations) => {
    console.log('handleDestinationSelect called with:', destinations);
    const destArray = Array.isArray(destinations) ? destinations : [destinations];
    console.log('Setting destinations to:', destArray);
    setForm(f => ({
      ...f,
      destinations: destArray,
    }));
  };

  const handleVenueSelect = (venueData) => {
    setForm(f => ({
      ...f,
      selected_venues: venueData.venues || venueData,
      day_assignments: venueData.dayAssignments || {},
    }));
    goToStep(3);
    analytics.stepReached(STEPS[3], 3);
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
    if (step === 0) {
      if (form.destinations.length === 0) errs.destination = 'Select a destination';
      if (form.days < 2 || form.days > 30) errs.days = 'Duration must be 2–30 days';

      const budgetValidation = validateBudget(Number(form.budget));
      if (!budgetValidation.valid) errs.budget = budgetValidation.error;

      if (!form.interests || form.interests.trim().length === 0) {
        errs.interests = 'Please tell us what interests you';
      } else if (form.interests.trim().length < 5) {
        errs.interests = 'Please be more specific (at least 5 characters)';
      }
      if (!form.travelPace) errs.travelPace = 'Select a travel pace';
      if (!form.language) errs.language = 'Select a language';
      if (!form.currency) errs.currency = 'Select a currency';
      if (!form.budgetScope) errs.budgetScope = 'Tell us what your budget covers';
    }
    if (step === 1) {
      const dateValidation = validateDateRange(form.travelDate, form.travelDateEnd);
      if (!dateValidation.valid) {
        dateValidation.errors.forEach(err => {
          if (err.includes('Start date')) errs.travelDate = err;
          else if (err.includes('End date')) errs.travelDateEnd = err;
          else if (err.includes('End date must be after')) errs.travelDateEnd = err;
          else if (err.includes('cannot be in the past')) errs.travelDate = err;
        });
      }
    }
    if (step === 3) {
      if (!form.email.trim()) errs.email = 'We need your email to send the itinerary';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    let nextStep = step + 1;
    // If user says flights/hotels already booked, skip Trip Overview (step 2) and go to Activities (step 3)
    if (step === 1 && form.alreadyBooked) {
      nextStep = 3;
    }
    goToStep(nextStep);
    analytics.stepReached(STEPS[nextStep], nextStep);
    if (nextStep === 4) loadPreview(form);
  };

  const back = () => {
    // If on Step 3 and skipped Step 2 (activities only), go back to Step 1
    if (step === 3 && form.alreadyBooked) {
      goToStep(1);
    } else {
      goToStep(step - 1);
    }
  };

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

  /* ── Step 3 (Venues): full-bleed, full-height ────────────────────── */
  if (step === 3 && form.destinations.length > 0) {
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
            Step 4 of 5 — Choose your experiences
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <VenueSelection
            destinations={form.destinations}
            travelStyles={form.travelStyle}
            startDate={form.travelDate}
            endDate={form.travelDateEnd}
            days={form.days}
            onSubmit={handleVenueSelect}
            onSkip={() => { goToStep(3); analytics.stepReached(STEPS[3], 3); }}
            onBack={() => goToStep(1)}
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
        {(step !== 3 || form.destinations.length === 0) && (
        <div style={s.card}>

          {/* ── Step 0: Destination & Preferences ─────────────────────────────────── */}
          {step === 0 && (
            <div>
              <div style={s.stepLabel}>Step 1 of 5</div>
              <h2 style={s.stepTitle}>Where & When</h2>
              <p style={s.stepSub}>Tell us your destination, how long you'll stay, and what interests you.</p>

              {/* Destination */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Destination *</label>
                <div style={s.fieldWrap}>
                  <DestinationSearch onSelect={handleDestinationSelect} disabled={false} allowMultiple={false} initialSelected={form.destinations} />
                  {errors.destination && <div style={s.error}>{errors.destination}</div>}
                  {personalRecs.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Based on your travels</div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {personalRecs.map((rec, i) => {
                          const cityName = rec.destination.split(',')[0].trim();
                          const countryName = rec.country || rec.destination.split(',')[1]?.trim() || 'Unknown';
                          return (
                            <button type="button" key={i} onClick={() => handleDestinationSelect({ name: cityName, country: countryName, lat: null, lng: null })} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.07)', color: '#00d4aa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.target.style.background = 'rgba(0,212,170,0.15)'; e.target.style.borderColor = 'rgba(0,212,170,0.5)'; }} onMouseLeave={(e) => { e.target.style.background = 'rgba(0,212,170,0.07)'; e.target.style.borderColor = 'rgba(0,212,170,0.25)'; }}>
                              {rec.emoji} {cityName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Days */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Duration (Days) *</label>
                <div style={s.daysRow}>
                  <button
                    type="button"
                    style={s.daysBtn}
                    onClick={() => set('days', Math.max(2, form.days - 1))}
                  >
                    −
                  </button>
                  <div style={s.daysNum}>{form.days}</div>
                  <button
                    type="button"
                    style={s.daysBtn}
                    onClick={() => set('days', Math.min(30, form.days + 1))}
                  >
                    +
                  </button>
                </div>
                {errors.days && <div style={s.error}>{errors.days}</div>}
              </div>

              {/* Budget */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Total Budget *</label>
                <input
                  style={{ ...s.input, ...(errors.budget ? s.inputError : {}) }}
                  type="number"
                  placeholder="e.g., 2500"
                  value={form.budget}
                  onChange={e => set('budget', e.target.value)}
                />
                {errors.budget && <div style={s.error}>{errors.budget}</div>}
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                  For flights + accommodation + activities
                </div>
              </div>

              {/* Currency */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Currency *</label>
                <select style={s.select} value={form.currency} onChange={e => setCurrency(e.target.value)}>
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
                {errors.currency && <div style={s.error}>{errors.currency}</div>}
              </div>

              {/* Interests */}
              <div style={s.fieldWrap}>
                <label style={s.label}>What excites you? * (Pick one or more)</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {PREDEFINED_INTERESTS.map(interest => {
                    const selected = getSelectedInterests().some(i => i.toLowerCase() === interest.toLowerCase());
                    return (
                      <button
                        type="button"
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        style={{
                          ...s.tag(selected),
                          fontSize: '0.8rem',
                        }}
                      >
                        {selected ? '✓ ' : ''}{interest}
                      </button>
                    );
                  })}
                </div>
                <label style={{ ...s.label, marginBottom: '0.5rem' }}>Or describe your interests:</label>
                <textarea
                  style={{ ...s.textarea, ...(errors.interests ? s.inputError : {}) }}
                  rows={2}
                  placeholder="Add any additional interests not listed above..."
                  value={form.interests}
                  onChange={e => set('interests', e.target.value)}
                />
                {errors.interests && <div style={s.error}>{errors.interests}</div>}
                {!errors.interests && form.interests.length > 0 && form.interests.length < 5 && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                    Keep going! Share more about what you're looking for in this trip.
                  </div>
                )}
                {!errors.interests && form.interests.length >= 5 && (
                  <div style={{ fontSize: '0.75rem', color: 'rgba(0,212,170,0.6)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                    ✓ Great! This helps us tailor your itinerary.
                  </div>
                )}
              </div>

              {/* Travel Pace */}
              <div style={s.fieldWrap}>
                <label style={s.label}>How do you travel? *</label>
                <div style={s.grid3}>
                  {PACE_OPTIONS.map(p => (
                    <button
                      type="button"
                      key={p.val}
                      style={s.choiceBtn(form.travelPace === p.val)}
                      onClick={() => set('travelPace', p.val)}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 400 }}>{p.sub}</div>
                    </button>
                  ))}
                </div>
                {errors.travelPace && <div style={s.error}>{errors.travelPace}</div>}
              </div>

              {/* Traveler Type (Optional) */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Traveler Type (Optional)</label>
                <div style={s.grid4}>
                  {TRAVELER_TYPES.map(type => (
                    <button
                      type="button"
                      key={type}
                      style={s.choiceBtn(form.travelerType === type)}
                      onClick={() => set('travelerType', type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Language for itinerary generation & delivery *</label>
                <select style={s.select} value={form.language} onChange={e => set('language', e.target.value)}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                {errors.language && <div style={s.error}>{errors.language}</div>}
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem', fontStyle: 'italic' }}>
                  The language in which your itinerary will be delivered
                </div>
              </div>

              {/* Budget Scope */}
              <div style={s.fieldWrap}>
                <label style={s.label}>What does your budget cover? *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => set('budgetScope', 'full-trip')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: form.budgetScope === 'full-trip' ? '2px solid #00d4aa' : '1px solid rgba(255,255,255,0.1)',
                      background: form.budgetScope === 'full-trip' ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                      color: form.budgetScope === 'full-trip' ? '#00d4aa' : '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ marginBottom: 4 }}>🌍 Entire Trip</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.7 }}>Flights, hotels & activities</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { set('budgetScope', 'activities-only'); set('alreadyBooked', true); }}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      border: form.budgetScope === 'activities-only' ? '2px solid #00d4aa' : '1px solid rgba(255,255,255,0.1)',
                      background: form.budgetScope === 'activities-only' ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                      color: form.budgetScope === 'activities-only' ? '#00d4aa' : '#fff',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ marginBottom: 4 }}>🎯 Activities Only</div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.7 }}>Already booked flights & hotels</div>
                  </button>
                </div>
                {errors.budgetScope && <div style={s.error}>{errors.budgetScope}</div>}
              </div>

              {/* Already Booked Explanation */}
              {form.budgetScope === 'activities-only' && (
                <div style={{ marginBottom: '1.5rem', padding: '12px 14px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 10, fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                  ✓ You'll skip the flight & hotel booking steps and go straight to selecting activities and venues for your trip.
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Travel dates ──────────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={s.stepLabel}>Step 2 of 5</div>
              <h2 style={s.stepTitle}>Travel dates</h2>
              <p style={s.stepSub}>When are you heading off?</p>

              {/* Start Date */}
              <div style={s.fieldWrap}>
                <label style={s.label}>Start date *</label>
                <input
                  style={{ ...s.input, ...(errors.travelDate ? s.inputError : {}) }}
                  type="date"
                  value={form.travelDate}
                  onChange={e => set('travelDate', e.target.value)}
                />
                {errors.travelDate && <div style={s.error}>{errors.travelDate}</div>}
              </div>

              {/* End Date */}
              <div style={s.fieldWrap}>
                <label style={s.label}>End date *</label>
                <input
                  style={{ ...s.input, ...(errors.travelDateEnd ? s.inputError : {}) }}
                  type="date"
                  value={form.travelDateEnd}
                  onChange={e => set('travelDateEnd', e.target.value)}
                />
                {errors.travelDateEnd && <div style={s.error}>{errors.travelDateEnd}</div>}
              </div>

              {/* Trip Duration Summary */}
              {form.travelDate && form.travelDateEnd && (
                <div style={s.summaryBox}>
                  <div style={{ color: '#00d4aa', fontSize: '1rem', fontWeight: 600 }}>
                    📅 {calculateTripDays(form.travelDate, form.travelDateEnd)} days planned
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Trip Overview ────────────────────────────────── */}
          {step === 2 && (
            <div>
              <div style={s.stepLabel}>Step 3 of 5</div>
              <h2 style={s.stepTitle}>Trip Overview</h2>
              <p style={s.stepSub}>Here's what to expect for your {form.days}-day trip to {form.destinations.length > 0 ? form.destinations[0].name : 'your destination'}.</p>

              {insightsLoading && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'rgba(255,255,255,0.5)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                  <div style={{ fontSize: '1rem' }}>Generating recommendations...</div>
                </div>
              )}

              {!insightsLoading && (
                <>
                  {/* Flights Section */}
                  {form.destinations.length > 0 && (
                    <FlightsSection
                      destination={form.destinations[0]}
                      origin={form.userLocation}
                      travelDate={form.travelDate}
                      budgetEstimateUSD={destinationInsights?.budgetEstimateUSD}
                      currency={form.currency}
                      onOriginChange={(origin) => set('userLocation', origin)}
                    />
                  )}

                  {/* Accommodation Section */}
                  {form.destinations.length > 0 && (
                    <AccommodationSection
                      destination={form.destinations[0]}
                      insights={destinationInsights}
                      budget={form.budget}
                      currency={form.currency}
                      days={form.days}
                      travelStyle={form.travelStyle}
                      startDate={form.travelDate}
                      endDate={form.travelDateEnd}
                    />
                  )}

                  {/* Budget Clarification Box */}
                  {destinationInsights?.budgetEstimateUSD && (
                    <BudgetClarificationBox
                      budgetEstimateUSD={destinationInsights.budgetEstimateUSD}
                      currency={form.currency}
                    />
                  )}
                </>
              )}
            </div>
          )}


          {/* ── Step 3: Review ────────────────────────────────── */}
          {step === 3 && (
            <div>
              <div style={s.stepLabel}>Step 4 of 5</div>
              <h2 style={s.stepTitle}>Review your trip</h2>
              <p style={s.stepSub}>Here's everything we'll use to create your personalised itinerary.</p>

              <div style={s.summaryBox}>
                {[
                  ['Destinations', form.destinations.map(d => d.name).join(', ') || '—'],
                  ['Travel Dates', form.travelDate && form.travelDateEnd ? `${form.travelDate} to ${form.travelDateEnd}` : '—'],
                  ['Duration', `${form.days} days`],
                  ['Budget', `${form.currency} ${form.budget}`],
                  ['Traveller Type', form.travelerType || '—'],
                  ['Travel Pace', form.travelPace],
                  ['Interests', form.interests || '—'],
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

          {/* ── Step 4: Preview & Submit (extracted component) ─────── */}
          {step === 4 && (
            <StepReview
              form={form}
              set={set}
              onBack={back}
              onSubmit={handleSubmit}
              submitting={submitting}
              submitError={submitError}
            />
          )}

          {/* Nav buttons — steps 0–2 have Back/Next, step 3 has Submit; step 4 (StepReview) has its own buttons */}
          {step < 4 && (
            <div style={s.navBtns}>
              {step > 0 && (
                <button type="button" style={s.backBtnForm} onClick={back} disabled={submitting}>← Back</button>
              )}
              <div style={{ flex: 1 }} />
              {step < 3 ? (
                <button
                  type="button"
                  style={{
                    ...s.nextBtn,
                    ...(submitting ? { background: 'rgba(0,212,170,0.5)', cursor: 'not-allowed' } : {}),
                  }}
                  onClick={next}
                  disabled={submitting}
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="button"
                  style={{
                    ...s.nextBtn,
                    ...(submitting ? { background: 'rgba(0,212,170,0.5)', cursor: 'not-allowed' } : {}),
                    minWidth: 200,
                  }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Generating...' : 'Generate My Itinerary'}
                </button>
              )}
            </div>
          )}
        </div>
        )}

        <div style={s.footerNote}>Free plan · 1 itinerary per month · No card required</div>
      </div>
    </div>
  );
}
