// src/components/plantrip/StepReview.jsx
// Step 4 — Review preferences and see AI day outline before confirming.
// Editable: travel style, pace, start time, must-dos.
// Read-only summary: destination, days, budget.

import React from 'react';

const TRAVEL_STYLES = ['Nature', 'Relaxation', 'Cultural', 'Foodie', 'Wellness', 'Adventure', 'Luxury'];

const START_TIME_OPTIONS = [
  { label: '🌅 Early — 7am', value: '07:00' },
  { label: '☕ Morning — 9am', value: '09:00' },
  { label: '🌞 Late — 11am', value: '11:00' },
];

const PACE_OPTIONS = ['relaxed', 'balanced', 'packed'];

// Reusable inline style tokens — match the existing s-object pattern in the codebase
const panel = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  padding: '1.25rem',
};

const sectionLabel = {
  fontSize: '0.7rem',
  fontWeight: 700,
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: '#00d4aa',
  marginBottom: '1rem',
};

const fieldLabel = {
  fontSize: '0.75rem',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: 6,
};

const chipBase = (active) => ({
  fontSize: '0.72rem',
  padding: '4px 10px',
  borderRadius: 20,
  border: active ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.2)',
  background: active ? 'rgba(0,212,170,0.15)' : 'transparent',
  color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
  cursor: 'pointer',
  transition: 'all 0.15s',
  fontFamily: 'inherit',
});

const segBtn = (active) => ({
  flex: 1,
  fontSize: '0.72rem',
  padding: '6px 4px',
  borderRadius: 8,
  border: active ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.2)',
  background: active ? 'rgba(0,212,170,0.15)' : 'transparent',
  color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
  cursor: 'pointer',
  textTransform: 'capitalize',
  fontFamily: 'inherit',
});

const skeletonLine = (width, height = 12) => ({
  width,
  height,
  background: 'rgba(255,255,255,0.08)',
  borderRadius: 4,
  marginBottom: 5,
});

export default function StepReview({ form, set, fetchPreview, onBack, onSubmit, submitting, submitError }) {
  const handleStyleToggle = (style) => {
    const updated = form.travelStyle.includes(style)
      ? form.travelStyle.filter(s => s !== style)
      : [...form.travelStyle, style];
    set('travelStyle', updated);
    fetchPreview({ ...form, travelStyle: updated });
  };

  const handlePaceChange = (pace) => {
    set('travelPace', pace);
    fetchPreview({ ...form, travelPace: pace });
  };

  const handleStartTimeChange = (value) => {
    set('startTime', value);
    fetchPreview({ ...form, startTime: value });
  };

  return (
    <div>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '0.5rem' }}>
        Step 5 of 5 — Almost there
      </div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '2rem', color: '#fff', marginBottom: '0.5rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
        Review your trip
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', marginBottom: '2rem', fontStyle: 'italic' }}>
        Tweak anything before we generate your full itinerary.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>

        {/* ── Left: editable preferences ──────────────────────────── */}
        <div style={panel}>
          <div style={sectionLabel}>Your preferences</div>

          {/* Read-only summary */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>Destination & duration</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{form.destination} — {form.days} days</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>Budget</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{form.currency} {(+form.budget).toLocaleString()}</div>
          </div>

          {/* Travel style chips */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>Travel style</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TRAVEL_STYLES.map(style => (
                <button
                  key={style}
                  style={chipBase(form.travelStyle.includes(style))}
                  onClick={() => handleStyleToggle(style)}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Pace */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>Pace</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {PACE_OPTIONS.map(p => (
                <button key={p} style={segBtn(form.travelPace === p)} onClick={() => handlePaceChange(p)}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Start time */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>When do you start your day?</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {START_TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  style={{ ...segBtn((form.startTime || '09:00') === opt.value), fontSize: '0.66rem' }}
                  onClick={() => handleStartTimeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Must-dos */}
          <div>
            <div style={fieldLabel}>Anything you want included?</div>
            <textarea
              value={form.userMustDos || ''}
              onChange={e => set('userMustDos', e.target.value)}
              onBlur={() => fetchPreview(form)}
              placeholder={'e.g. Already booked dinner at Noma on Day 3\nWant to visit Senso-ji at dawn'}
              maxLength={300}
              rows={4}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                color: '#fff',
                fontSize: '0.8rem',
                padding: '10px 12px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginTop: 3 }}>
              {(form.userMustDos || '').length} / 300
            </div>
          </div>
        </div>

        {/* ── Right: AI day outline ────────────────────────────────── */}
        <div style={{ ...panel, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={sectionLabel}>Day outline preview</div>

          {form._previewLoading && (
            <div>
              {Array.from({ length: Math.min(+form.days, 7) }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={skeletonLine(36)} />
                  <div style={{ flex: 1 }}>
                    <div style={skeletonLine('60%')} />
                    <div style={skeletonLine('85%', 10)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!form._previewLoading && form._preview && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {form._preview.map((d, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex', gap: 10, padding: '8px 0',
                    borderBottom: i < form._preview.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', minWidth: 36, paddingTop: 2, flexShrink: 0 }}>
                    Day {d.day}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: 2 }}>{d.theme}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>{d.vibe}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!form._previewLoading && !form._preview && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', fontStyle: 'italic', paddingTop: '0.5rem' }}>
              Preview will appear here…
            </div>
          )}
        </div>
      </div>

      {submitError && (
        <p style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '0.9rem' }}>{submitError}</p>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            padding: '14px 24px', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10,
            color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ← Edit
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting}
          style={{
            flex: 1, padding: '14px 24px',
            background: submitting ? 'rgba(0,212,170,0.4)' : '#00d4aa',
            border: 'none', borderRadius: 10,
            color: '#0a1628', fontWeight: 700, fontSize: '1rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s', fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Generating…' : 'Generate full itinerary →'}
        </button>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', textAlign: 'center', marginTop: '0.75rem' }}>
        Takes 2–3 minutes · PDF delivered by email
      </p>
    </div>
  );
}
