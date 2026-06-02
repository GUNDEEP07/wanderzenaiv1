# P3: Step 6 Review Redesign

**Date:** 2026-06-02
**Status:** Approved, ready for implementation
**Scope:** `frontend/src/components/plantrip/StepReview.jsx` only

---

## Current state

Step 6 shows: destination, budget, travel style, pace, start time, must-dos, day outline preview.

Missing: traveler type, travel date, language, hotel recs, selected venues from step 2, email.
Layout breaks on mobile (2-col grid too narrow at <640px).

---

## New layout

```
[Trip summary header]
[Your trip panel]  |  [Day outline preview]
[Selected venues section — if any]
[← Edit]  [Generate full itinerary →]
```

---

## Section 1: Trip summary header

A teal-tinted full-width banner at the top. Shows:
- Destination name (large, Fraunces serif)
- Travel dates (if set) or duration only
- Tags: traveler type + pace

```jsx
<div style={{
  background: 'linear-gradient(135deg, rgba(0,212,170,0.1), rgba(0,212,170,0.04))',
  border: '1px solid rgba(0,212,170,0.2)', borderRadius: 14,
  padding: '1.25rem 1.5rem', marginBottom: '1.5rem',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  flexWrap: 'wrap', gap: 12,
}}>
  <div>
    <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 4 }}>
      Your trip
    </div>
    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '1.6rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
      {form.destinations?.[0]?.name || 'Unknown'}{form.destinations?.length > 1 ? ` +${form.destinations.length - 1}` : ''}
    </div>
    {form.travelDate && (
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
        From {new Date(form.travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {form.days} days
      </div>
    )}
    {!form.travelDate && (
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{form.days} days</div>
    )}
  </div>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {form.travelerType && (
      <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
        {form.travelerType}
      </span>
    )}
    <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', textTransform: 'capitalize' }}>
      {form.travelPace} pace
    </span>
    <span style={{ padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
      {form.language || 'English'}
    </span>
  </div>
</div>
```

---

## Section 2: Left panel additions

Keep existing fields. Add the following new rows to `Your preferences` panel, after the budget row:

**Traveler type** (read-only display, not editable here):
```jsx
{form.travelerType && (
  <div style={{ marginBottom: '1rem' }}>
    <div style={fieldLabel}>Travelling as</div>
    <div style={{ color: '#fff', fontWeight: 600 }}>{form.travelerType}</div>
  </div>
)}
```

**Travel date** (read-only):
```jsx
{form.travelDate && (
  <div style={{ marginBottom: '1rem' }}>
    <div style={fieldLabel}>Start date</div>
    <div style={{ color: '#fff', fontWeight: 600 }}>
      {new Date(form.travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
    </div>
  </div>
)}
```

**Language** (read-only):
```jsx
<div style={{ marginBottom: '1rem' }}>
  <div style={fieldLabel}>Itinerary language</div>
  <div style={{ color: '#fff', fontWeight: 600 }}>{form.language || 'English'}</div>
</div>
```

**Hotel recommendations** (read-only toggle display):
```jsx
<div style={{ marginBottom: '1rem' }}>
  <div style={fieldLabel}>Accommodation suggestions</div>
  <div style={{ color: form.wantsHotelRecs ? '#00d4aa' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.85rem' }}>
    {form.wantsHotelRecs ? '✓ Included' : 'Not included'}
  </div>
</div>
```

---

## Section 3: Mobile layout fix

The 2-col grid wrapping both panels must collapse to single column on mobile.

Replace the current outer grid div:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
```

With:
```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
```

`minmax(280px, 1fr)` collapses to a single column at ≤640px without needing a separate media query.

---

## Section 4: Selected venues section

If the user selected venues/activities in step 2, show them after the 2-col grid.

`form.selected_venues` is a nested object like:
```js
{
  "Kyoto/Hiking": ["venueId1", "venueId2"],
  "Kyoto/Food": ["venueId3"]
}
```

Parse the keys to show which activities were selected per destination.

Add after the closing `</div>` of the 2-col grid, before the submit buttons:

```jsx
{form.selected_venues && Object.keys(form.selected_venues).length > 0 && (
  <div style={{ ...panel, marginBottom: '1.5rem' }}>
    <div style={sectionLabel}>Selected experiences</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {Object.entries(form.selected_venues)
        .filter(([, venues]) => (Array.isArray(venues) ? venues.length > 0 : venues instanceof Set ? venues.size > 0 : false))
        .map(([key]) => {
          const parts = key.split('/');
          const activity = parts[parts.length - 1];
          return (
            <span
              key={key}
              style={{
                padding: '5px 12px', borderRadius: 20,
                background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)',
                fontSize: '0.75rem', color: '#00d4aa', fontWeight: 600,
              }}
            >
              {activity}
            </span>
          );
        })}
    </div>
  </div>
)}
```

---

## Section 5: Step label fix

Current says "Step 5 of 5" — but the wizard has 6 steps (0-indexed to 5). Fix the label:

```jsx
<div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '0.5rem' }}>Step 6 of 6 — Almost there</div>
```

---

## Out of scope

- Email display in review (email is entered in step 5, shown in the confirmation page)
- Re-editing destinations from the review (too complex — user can click "← Edit" to go back)
