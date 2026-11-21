// src/pages/PlanTrip.jsx
// The trip planner (Nov 2026 redesign, approved by Gundeep): five steps in one frame
// (components/plantrip/PlanShell.jsx) — summary bar on top, Back / Continue at the bottom.
//   0 Trip basics (StepBasics) · 1 Your route (StepRoute) · 2 Plan your days (StepDays)
//   3 Stays & flights (StepStays, optional) · 4 Check your trip (StepReview)
// Step numbers live in utils/planSteps.js; API calls in src/api/itinerary.js.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PlanShell from '../components/plantrip/PlanShell';
import StepBasics from '../components/plantrip/StepBasics';
import StepRoute, { routeKey } from '../components/plantrip/StepRoute';
import StepDays, { daysStatus } from '../components/plantrip/StepDays';
import StepStays from '../components/plantrip/StepStays';
import StepReview, { reviewAction } from '../components/plantrip/StepReview';
import { DEFAULT_TRIP_PREFS } from '../components/plantrip/WhoIsTravelling';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { submitItinerary, fetchRoutePlan, fetchEntitlement, savePlanDraft, deletePlanDraft } from '../api/itinerary';
import { useAuth } from '../context/AuthContext';
import { analytics } from '../utils/analytics';
import { visitorCountry } from '../api/pricing';
import { usePricing } from '../hooks/usePricing';
import PriceNote from '../components/plantrip/PriceNote';
import { homeCity } from '../utils/seasons';
import { getCurrencyForCountry } from '../utils/countryToCurrency';
import { validateBudget } from '../utils/validators/budgetValidator';
import { validateDateRange, calculateTripDays } from '../utils/validators/dateValidator';
import { tripDatesText, endDateFor, daysForEnd, MIN_DAYS, MAX_DAYS } from '../utils/tripDates';
import { formatRange } from '../utils/dateRange';
import {
  PLAN_VERSION, STEP_BASICS, STEP_ROUTE, STEP_DAYS, STEP_STAYS, STEP_REVIEW, STEP_NAMES,
  STEP_STORAGE_KEY, FORM_STORAGE_KEY, resumeStep,
} from '../utils/planSteps';

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'JPY'];
const PACE_LABEL = { relaxed: 'Relaxed', balanced: 'Balanced', packed: 'Full days' };

const INITIAL_FORM = {
  planVersion: PLAN_VERSION,
  destinations: [], days: 5, budget: '',
  currency: (typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency')) || 'USD',
  travelerType: '', travelStyle: [], interests: '',
  travelDate: '', travelDateEnd: '', datesFlexible: false, travelPace: 'balanced', wantsHotelRecs: true,
  startTime: '09:00', userMustDos: '',
  language: 'English', userAge: '', userLocation: '', email: '',
  selected_venues: { version: 2, picks: [], interests: [] }, // set by StepDays
  budgetScope: 'full-trip',
  alreadyBooked: false,
  tripPrefs: DEFAULT_TRIP_PREFS,
};

/** "Solo" / "Couple" / "Family" / "Group of friends" from who's travelling (no separate question). */
export function travelerTypeOf(prefs = {}) {
  const adults = Number(prefs.adults) || 2;
  if ((prefs.kids || []).length) return 'Family';
  if (adults === 1) return 'Solo';
  if (adults === 2) return 'Couple';
  return 'Group of friends';
}

/** The form as the API wants it: no dates when they're not fixed; traveller type derived. */
export function formForApi(form) {
  const { preferRouteId: _p, ...rest } = form; // a UI hint from Home/Explore, not trip data
  return {
    ...rest,
    travelerType: travelerTypeOf(form.tripPrefs),
    ...(form.datesFlexible ? { travelDate: '', travelDateEnd: '' } : {}),
  };
}

/** The route picked on Home/Explore goes first in Step 2 (if the API offered it). */
export function preferFirst(options = [], id) {
  const i = id ? options.findIndex(o => o.id === id) : -1;
  return i > 0 ? [options[i], ...options.slice(0, i), ...options.slice(i + 1)] : options;
}

/** Route stops with their trip days, de-duplicated (a route can pass a town twice). */
export function stopsOf(form) {
  const bases = form.route?.bases || [];
  let day = 1;
  const seen = new Map();
  bases.forEach(b => {
    const from = day;
    day += b.days || 0;
    if (!seen.has(b.name)) {
      seen.set(b.name, {
        name: b.name, country: b.country || form.destinations[0]?.country || form.destinations[0]?.name || '',
        lat: b.lat ?? null, lng: b.lng ?? null, fromDay: from, toDay: day - 1,
        stayType: b.stayType || null, why: b.why || null,
      });
    }
  });
  return [...seen.values()];
}

export default function PlanTrip() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || {};
  const { currentUser, getIdToken } = useAuth();

  const [form, setForm] = useState(() => {
    if (Object.keys(prefill).length > 0) return { ...INITIAL_FORM, ...prefill };
    try {
      const saved = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (saved) return { ...INITIAL_FORM, ...JSON.parse(saved) };
    } catch { /* ignore corrupt storage */ }
    return { ...INITIAL_FORM };
  });
  const pricing = usePricing(); // Stripe prices for the step-1 note and the guest price table
  const [step, setStep] = useState(() => {
    if (location.state?.startStep != null) return location.state.startStep;
    try {
      const v3 = sessionStorage.getItem(STEP_STORAGE_KEY);
      if (v3 != null) return resumeStep({ planVersion: PLAN_VERSION }, v3);
      const old = sessionStorage.getItem('wz_plan_step_v2'); // a plan in progress before the redesign
      if (old != null) return resumeStep({}, old);
    } catch { /* ignore */ }
    return STEP_BASICS;
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [entitlement, setEntitlement] = useState(null);
  const [personalRecs, setPersonalRecs] = useState([]);
  // Route request state (the chosen route is on form.route because it is submitted).
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [routeOptions, setRouteOptions] = useState({ key: null, list: [] });

  // ── Signed in: home city, language, travel history ──
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
        if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
          const d = await profileRes.value.json();
          const p = d.profile;
          if (p) {
            setForm(f => ({
              ...f,
              email: currentUser.email || f.email,
              userAge: p.age ? String(p.age) : f.userAge,
              userLocation: f.userLocation || p.home_city || '',
              language: f.language && f.language !== 'English' ? f.language : (p.language || f.language),
            }));
          }
        }
        if (recsRes.status === 'fulfilled' && recsRes.value.ok) {
          const d = await recsRes.value.json();
          if (Array.isArray(d.recommendations)) setPersonalRecs(d.recommendations);
        }
      } catch { /* optional */ }
    })();
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Currency and a "from" city for flights, guessed from the browser time zone (same guess as the
  // home page and pricing; nothing leaves the browser). Only fills what the visitor hasn't set.
  useEffect(() => {
    setForm(f => {
      const next = { ...f };
      if (!(typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency'))) {
        const detected = getCurrencyForCountry(visitorCountry());
        if (SUPPORTED_CURRENCIES.includes(detected)) next.currency = detected;
      }
      if (!f.userLocation) {
        const city = homeCity();
        if (city) next.userLocation = city;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (step !== STEP_REVIEW || !currentUser) { setEntitlement(null); return undefined; }
    let live = true;
    fetchEntitlement().then(e => { if (live) setEntitlement(e); });
    return () => { live = false; };
  }, [step, currentUser]);

  // Signed in: keep the plan on the account (dashboard "Continue planning").
  useEffect(() => {
    if (!currentUser || !form.destinations?.length) return undefined;
    const timer = setTimeout(() => { savePlanDraft(form, step); }, 3000);
    return () => clearTimeout(timer);
  }, [form, step, currentUser]);

  useEffect(() => {
    try { sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form]);

  const goToStep = (n) => {
    const clamped = Math.max(0, Math.min(n, STEP_NAMES.length - 1));
    setStep(clamped);
    setErrors({});
    try { sessionStorage.setItem(STEP_STORAGE_KEY, String(clamped)); } catch { /* ignore */ }
  };

  // ── Field setters ──
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val, ...(key === 'datesFlexible' && val ? { travelDate: '', travelDateEnd: '' } : {}) }));
    setErrors(e => ({ ...e, [key]: '', ...(key === 'datesFlexible' ? { travelDate: '', travelDateEnd: '' } : {}) }));
  };
  const setDays = (n) => {
    const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, n));
    setForm(f => ({ ...f, days, travelDateEnd: endDateFor(f.travelDate, days) || f.travelDateEnd }));
    setErrors(e => ({ ...e, days: '', travelDateEnd: '' }));
  };
  const setStartDate = (iso) => {
    setForm(f => ({ ...f, travelDate: iso, travelDateEnd: endDateFor(iso, f.days) || f.travelDateEnd }));
    setErrors(e => ({ ...e, travelDate: '', travelDateEnd: '' }));
  };
  const setEndDate = (iso) => {
    setForm(f => ({ ...f, travelDateEnd: iso, days: daysForEnd(f.travelDate, iso, f.days) }));
    setErrors(e => ({ ...e, travelDateEnd: '' }));
  };
  const setCurrency = (code) => {
    set('currency', code);
    try { localStorage.setItem('wz_currency', code); } catch { /* ignore */ }
  };
  const onDestination = (d) => {
    const list = Array.isArray(d) ? d : [d];
    setForm(f => ({ ...f, destinations: list.filter(Boolean) }));
    setErrors(e => ({ ...e, destination: '' }));
  };

  // ── Route ──
  const planRoute = async ({ more = false } = {}) => {
    const key = routeKey(form);
    setRouteLoading(true);
    setRouteError('');
    try {
      const avoid = more ? routeOptions.list.map(o => o.name) : [];
      const result = await fetchRoutePlan(formForApi(form), { more, avoid });
      setRouteOptions({ key, list: preferFirst(result.options, form.preferRouteId) });
      analytics.stepReached?.('Route options shown', STEP_ROUTE);
    } catch (err) {
      setRouteError(err.message || 'Could not plan a route right now.');
    } finally {
      setRouteLoading(false);
    }
  };
  const chooseRoute = (option) => {
    const { fitsConstraints: _f, caution: _c, longestTransferHours: _l, inSeason: _s, bestMonths: _b, bestMonthsLabel: _bl, ...route } = option;
    setForm(f => ({ ...f, route: { ...route, forKey: routeKey(f) } }));
    setErrors(e => ({ ...e, route: '' }));
    analytics.stepReached?.('Route chosen', STEP_ROUTE);
  };

  const stops = useMemo(() => stopsOf(form), [form.route, form.destinations]); // eslint-disable-line react-hooks/exhaustive-deps
  const routeOk = form.route?.forKey === routeKey(form) && (form.route?.bases || []).length > 0;

  // ── Validation per step ──
  const validate = () => {
    const errs = {};
    if (step === STEP_BASICS) {
      if (!form.destinations.length) errs.destination = 'Pick a country or search for a place.';
      if (form.days < MIN_DAYS || form.days > MAX_DAYS) errs.days = `Trips can be ${MIN_DAYS}–${MAX_DAYS} days.`;
      const budget = validateBudget(Number(form.budget));
      if (!budget.valid) errs.budget = budget.error;
      if (!form.datesFlexible) {
        const span = calculateTripDays(form.travelDate, form.travelDateEnd);
        if (form.travelDate && form.travelDateEnd && (span < MIN_DAYS || span > MAX_DAYS)) {
          errs.travelDateEnd = `Trips can be ${MIN_DAYS}–${MAX_DAYS} days — these dates make ${span}.`;
        }
        const range = validateDateRange(form.travelDate, form.travelDateEnd);
        if (!range.valid && !errs.travelDateEnd) {
          const first = range.errors[0] || '';
          if (/start/i.test(first) || /past/i.test(first)) errs.travelDate = first.includes('required') ? 'Pick a start date, or tick "Dates not fixed yet".' : first;
          else errs.travelDateEnd = first;
        }
      }
    }
    if (step === STEP_ROUTE) {
      const total = (form.route?.bases || []).reduce((a, b) => a + (b.days || 0), 0);
      if (!routeOk) errs.route = 'Pick one of the suggested routes first.';
      else if (total !== +form.days) errs.route = `Your route covers ${total} of ${form.days} days — adjust the days so they add up.`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    goToStep(step + 1);
    analytics.stepReached(STEP_NAMES[step + 1], step + 1);
  };
  const back = () => goToStep(step - 1);

  const exit = () => {
    if (currentUser && form.destinations?.length) {
      savePlanDraft(form, step);
      navigate('/dashboard');
    } else {
      navigate('/'); // the plan stays in this browser tab's session
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) { navigate('/signup?next=%2Fplan'); return; }
    if (!currentUser.email) { setSubmitError('Your account has no email address — please sign in again.'); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      const { status, data } = await submitItinerary(formForApi(form));
      if (status === 402) {
        analytics.freeLimitHit();
        const reason = data?.code === 'MONTHLY_LIMIT_REACHED' ? 'monthly_limit' : 'free_limit';
        navigate('/pricing', { state: { reason, destination: form.destinations[0]?.name || null } });
        return;
      }
      if (!data.success) throw new Error(data.message || 'Submission failed');
      const destinationName = form.destinations[0]?.name || 'Unknown';
      analytics.tripSubmitted({ destination: destinationName, days: form.days, travelStyle: form.travelStyle });
      try { sessionStorage.removeItem(STEP_STORAGE_KEY); sessionStorage.removeItem('wz_plan_step_v2'); sessionStorage.removeItem(FORM_STORAGE_KEY); } catch { /* ignore */ }
      deletePlanDraft();
      navigate(`/confirmation?id=${encodeURIComponent(data.data.submissionId)}`, {
        state: { submissionId: data.data.submissionId, destination: destinationName, email: currentUser?.email || form.email },
      });
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shell content per step ──
  const dest = form.destinations[0]?.name;
  const prefs = form.tripPrefs || {};
  const kids = (prefs.kids || []).length;
  const summary = step > STEP_BASICS && dest
    ? [
      dest,
      form.travelDate && form.travelDateEnd && !form.datesFlexible ? formatRange(form.travelDate, form.travelDateEnd) : `${form.days} days`,
      `${prefs.adults || 2} adult${(prefs.adults || 2) > 1 ? 's' : ''}${kids ? ` + ${kids} child${kids > 1 ? 'ren' : ''}` : ''}`,
      PACE_LABEL[form.travelPace] || 'Balanced',
    ].join(' · ')
    : null;

  const shell = {
    step,
    summary,
    onEditSummary: () => goToStep(STEP_BASICS),
    onJump: goToStep,
    onExit: exit,
    onBack: step > STEP_BASICS ? back : null,
    onNext: next,
  };

  let content;
  if (step === STEP_BASICS) {
    Object.assign(shell, {
      title: 'Trip basics',
      subtitle: 'Where, when and who. We suggest the route next.',
      status: dest ? `${dest} · ${form.datesFlexible || !form.travelDate ? `${form.days} days` : tripDatesText(form.travelDate, form.travelDateEnd)}` : null,
    });
    content = (
      <>
        <PriceNote pricing={pricing} />
        <StepBasics form={form} errors={errors} set={set} setDays={setDays} setStartDate={setStartDate} setEndDate={setEndDate}
          setCurrency={setCurrency} onDestination={onDestination} personalRecs={personalRecs} />
      </>
    );
  } else if (step === STEP_ROUTE) {
    Object.assign(shell, {
      title: 'Your route',
      subtitle: routeOk
        ? `Where you'll sleep for your ${form.days} days. Change the days, the order, or add and remove stops.`
        : `Suggested routes for ${form.days} days in ${dest || 'your destination'}, planned around who's travelling. Pick one — you can adjust it next.`,
      status: routeOk ? form.route.bases.map(b => b.name).join(' → ') : null,
      nextDisabled: routeLoading,
    });
    content = (
      <StepRoute form={form} route={form.route} options={routeOptions.list} optionsKey={routeOptions.key} loading={routeLoading} error={routeError}
        onPlan={planRoute} onChoose={chooseRoute}
        onChange={(route) => { setForm(f => ({ ...f, route })); setErrors(e => ({ ...e, route: '' })); }}
        errorText={errors.route} />
    );
  } else if (step === STEP_DAYS) {
    Object.assign(shell, {
      title: 'Plan your days',
      subtitle: "Add places you don't want to miss. We'll build the rest around them.",
      optional: true,
      wide: true,
      status: daysStatus(form.selected_venues, form.days),
    });
    content = stops.length ? (
      <StepDays stops={stops} startDate={form.datesFlexible ? '' : form.travelDate} travelStyles={form.travelStyle}
        value={form.selected_venues} onChange={(sel) => setForm(f => ({ ...f, selected_venues: sel }))} />
    ) : <p>Pick a route first.</p>;
  } else if (step === STEP_STAYS) {
    Object.assign(shell, {
      title: 'Stays & flights',
      subtitle: 'One stay for each stop on your route. Links open with your town and dates filled in.',
      optional: true,
    });
    content = (
      <StepStays stops={stops} startDate={form.datesFlexible ? '' : form.travelDate} endDate={form.datesFlexible ? '' : form.travelDateEnd} days={form.days}
        adults={prefs.adults || 2} origin={form.userLocation || ''} onOrigin={(v) => set('userLocation', v)}
        alreadyBooked={form.alreadyBooked} onAlreadyBooked={(v) => set('alreadyBooked', v)} />
    );
  } else {
    const action = reviewAction({ signedIn: !!currentUser, entitlement, submitting });
    Object.assign(shell, {
      title: 'Check your trip',
      subtitle: 'Everything you chose, in one place. Tap Edit to change a part.',
      nextLabel: action.label,
      nextDisabled: submitting,
      onNext: () => {
        if (action.kind === 'signup') { analytics.stepReached('signup_gate', STEP_REVIEW); navigate('/signup?next=%2Fplan'); }
        else if (action.kind === 'plans') {
          navigate('/pricing', { state: { reason: entitlement?.code === 'MONTHLY_LIMIT_REACHED' ? 'monthly_limit' : 'free_limit', destination: dest || null } });
        } else handleSubmit();
      },
    });
    content = (
      <StepReview form={formForApi(form)} set={set} onEditStep={goToStep} submitError={submitError}
        accountEmail={currentUser?.email || form.email} signedIn={!!currentUser} entitlement={entitlement} pricing={pricing}
        onSignIn={() => navigate('/login?next=%2Fplan')} />
    );
  }

  return (
    <PlanShell {...shell}>
      <style>{`
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.55); }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.6); }
        select option { background: #111827; color: #fff; }
      `}</style>
      <ErrorBoundary scoped={true}>{content}</ErrorBoundary>
    </PlanShell>
  );
}
