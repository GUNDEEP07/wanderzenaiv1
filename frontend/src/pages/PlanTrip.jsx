import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PlanTrip.css';

const API_URL = import.meta.env.VITE_API_URL;

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

const STEPS = ['Destination', 'Budget & dates', 'Travel style', 'Contact'];

const initial = {
  destination: '', days: 7, budget: '', currency: 'USD',
  travelerType: '', travelStyle: [], interests: '',
  travelDate: '', travelPace: 'balanced', wantsHotelRecs: true, email: '',
};

export default function PlanTrip() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const toggleStyle = (style) => {
    setForm(f => ({
      ...f,
      travelStyle: f.travelStyle.includes(style)
        ? f.travelStyle.filter(s => s !== style)
        : [...f.travelStyle, style],
    }));
  };

  const validateStep = () => {
    const errs = {};
    if (step === 0 && !form.destination.trim()) errs.destination = 'Where are you headed?';
    if (step === 1) {
      if (!form.budget || isNaN(form.budget) || +form.budget <= 0) errs.budget = 'Enter your total budget';
    }
    if (step === 2 && !form.travelerType) errs.travelerType = 'Select traveler type';
    if (step === 3) {
      if (!form.email.trim()) errs.email = 'We need your email to send the itinerary';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const next = () => { if (validateStep()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const submit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, days: +form.days, budget: +form.budget }),
      });

      const data = await res.json();

      if (res.status === 402) {
        navigate('/pricing', { state: { reason: 'free_limit' } });
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Submission failed');
      }

      navigate('/confirmation', {
        state: { submissionId: data.data.submissionId, destination: form.destination, email: form.email },
      });

    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt">
      <div className="pt-nav">
        <button className="pt-back-home" onClick={() => navigate('/')}>← WanderZenAI</button>
      </div>

      <div className="pt-inner">
        {/* Progress */}
        <div className="pt-progress">
          {STEPS.map((s, i) => (
            <div key={s} className={`pt-step-dot ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
              <div className="pt-dot-circle">{i < step ? '✓' : i + 1}</div>
              <div className="pt-dot-label">{s}</div>
            </div>
          ))}
          <div className="pt-progress-line">
            <div className="pt-progress-fill" style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} />
          </div>
        </div>

        <div className="pt-card">
          {/* Step 0 — Destination */}
          {step === 0 && (
            <div className="pt-step-content">
              <div className="pt-step-label">Step 1</div>
              <h2 className="pt-step-title">Where to?</h2>
              <p className="pt-step-sub">Tell us your dream destination. We'll find the real, local version of it.</p>

              <div className="pt-field">
                <label className="pt-label">Destination</label>
                <input
                  className={`pt-input pt-input-large ${errors.destination ? 'pt-input-error' : ''}`}
                  type="text" placeholder="e.g. Kyoto, Japan · Tuscany · Sri Lanka"
                  value={form.destination}
                  onChange={e => set('destination', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && next()}
                  autoFocus
                />
                {errors.destination && <div className="pt-error">{errors.destination}</div>}
              </div>

              <div className="pt-field">
                <label className="pt-label">How many days?</label>
                <div className="pt-days-row">
                  <button className="pt-days-btn" onClick={() => set('days', Math.max(1, form.days - 1))}>−</button>
                  <div className="pt-days-display">{form.days}</div>
                  <button className="pt-days-btn" onClick={() => set('days', Math.min(30, form.days + 1))}>+</button>
                  <span className="pt-days-label">days</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Budget */}
          {step === 1 && (
            <div className="pt-step-content">
              <div className="pt-step-label">Step 2</div>
              <h2 className="pt-step-title">What's your budget?</h2>
              <p className="pt-step-sub">A rough estimate helps us plan realistic activities and stays for you.</p>

              <div className="pt-field">
                <label className="pt-label">Currency</label>
                <div className="pt-currency-grid">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.code}
                      className={`pt-currency-btn ${form.currency === c.code ? 'selected' : ''}`}
                      onClick={() => set('currency', c.code)}
                    >{c.label}</button>
                  ))}
                </div>
              </div>

              <div className="pt-field">
                <label className="pt-label">Total trip budget</label>
                <div className="pt-budget-row">
                  <span className="pt-budget-prefix">
                    {CURRENCIES.find(c => c.code === form.currency)?.label.match(/[^(]+\((.+)\)/)?.[1] || form.currency}
                  </span>
                  <input
                    className={`pt-input pt-input-budget ${errors.budget ? 'pt-input-error' : ''}`}
                    type="number" min="0" placeholder="5000"
                    value={form.budget} onChange={e => set('budget', e.target.value)}
                  />
                </div>
                {errors.budget && <div className="pt-error">{errors.budget}</div>}
              </div>

              <div className="pt-field">
                <label className="pt-label">Travel date <span className="pt-optional">(optional)</span></label>
                <input className="pt-input" type="date" value={form.travelDate} onChange={e => set('travelDate', e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 2 — Style */}
          {step === 2 && (
            <div className="pt-step-content">
              <div className="pt-step-label">Step 3</div>
              <h2 className="pt-step-title">How do you travel?</h2>
              <p className="pt-step-sub">This shapes the entire plan — activities, pace, and local recommendations.</p>

              <div className="pt-field">
                <label className="pt-label">You're travelling as</label>
                <div className="pt-choice-grid">
                  {TRAVELER_TYPES.map(t => (
                    <button
                      key={t}
                      className={`pt-choice-btn ${form.travelerType === t ? 'selected' : ''}`}
                      onClick={() => set('travelerType', t)}
                    >{t}</button>
                  ))}
                </div>
                {errors.travelerType && <div className="pt-error">{errors.travelerType}</div>}
              </div>

              <div className="pt-field">
                <label className="pt-label">Travel style <span className="pt-optional">(pick any)</span></label>
                <div className="pt-tags">
                  {TRAVEL_STYLES.map(s => (
                    <button
                      key={s}
                      className={`pt-tag ${form.travelStyle.includes(s) ? 'selected' : ''}`}
                      onClick={() => toggleStyle(s)}
                    >{s}</button>
                  ))}
                </div>
              </div>

              <div className="pt-field">
                <label className="pt-label">Pace</label>
                <div className="pt-pace-grid">
                  {PACE_OPTIONS.map(p => (
                    <button
                      key={p.val}
                      className={`pt-pace-btn ${form.travelPace === p.val ? 'selected' : ''}`}
                      onClick={() => set('travelPace', p.val)}
                    >
                      <div className="pt-pace-name">{p.label}</div>
                      <div className="pt-pace-sub">{p.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-field">
                <label className="pt-label">Specific interests <span className="pt-optional">(optional)</span></label>
                <textarea
                  className="pt-textarea"
                  placeholder="e.g. morning hikes, roadside noodle shops, pottery villages, deserted beaches..."
                  rows={3}
                  value={form.interests}
                  onChange={e => set('interests', e.target.value)}
                />
              </div>

              <div className="pt-field">
                <div className="pt-toggle-row" onClick={() => set('wantsHotelRecs', !form.wantsHotelRecs)}>
                  <div>
                    <div className="pt-toggle-label">Include accommodation suggestions</div>
                    <div className="pt-toggle-sub">Guesthouses, homestays and Airbnb areas near nature</div>
                  </div>
                  <div className={`pt-toggle ${form.wantsHotelRecs ? 'on' : ''}`}>
                    <div className="pt-toggle-thumb" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Contact */}
          {step === 3 && (
            <div className="pt-step-content">
              <div className="pt-step-label">Step 4</div>
              <h2 className="pt-step-title">Where should we send it?</h2>
              <p className="pt-step-sub">Your personalised {form.destination} itinerary will arrive in your inbox within 3 minutes.</p>

              <div className="pt-summary-box">
                <div className="pt-summary-row"><span>Destination</span><strong>{form.destination}</strong></div>
                <div className="pt-summary-row"><span>Duration</span><strong>{form.days} days</strong></div>
                <div className="pt-summary-row"><span>Budget</span><strong>{form.currency} {form.budget}</strong></div>
                <div className="pt-summary-row"><span>Traveller</span><strong>{form.travelerType || '—'}</strong></div>
                <div className="pt-summary-row"><span>Pace</span><strong>{form.travelPace}</strong></div>
              </div>

              <div className="pt-field">
                <label className="pt-label">Your email address</label>
                <input
                  className={`pt-input ${errors.email ? 'pt-input-error' : ''}`}
                  type="email" placeholder="you@example.com"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  autoFocus
                />
                {errors.email && <div className="pt-error">{errors.email}</div>}
              </div>

              <div className="pt-privacy-note">
                We'll only use your email to send the itinerary. No spam, ever.
              </div>

              {submitError && <div className="pt-submit-error">{submitError}</div>}
            </div>
          )}

          {/* Navigation */}
          <div className="pt-nav-buttons">
            {step > 0 && (
              <button className="pt-btn-back" onClick={back} disabled={submitting}>← Back</button>
            )}
            <div style={{ flex: 1 }} />
            {step < STEPS.length - 1 ? (
              <button className="pt-btn-next" onClick={next}>Continue →</button>
            ) : (
              <button className="pt-btn-submit" onClick={submit} disabled={submitting}>
                {submitting ? (
                  <span className="pt-loading">
                    <span className="pt-dots"><span /><span /><span /></span>
                    Crafting your itinerary...
                  </span>
                ) : 'Generate my itinerary →'}
              </button>
            )}
          </div>
        </div>

        <div className="pt-footer-note">
          Free plan — 1 itinerary per month. No card required.
        </div>
      </div>
    </div>
  );
}
