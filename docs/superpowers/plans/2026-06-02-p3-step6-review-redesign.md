# Step 6 Review Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PlanTrip Step 6 (Review) screen to show a trip summary header, all selected preferences, selected venues, and fix the mobile layout.

**Architecture:** All changes are in `StepReview.jsx` — a self-contained component that receives the `form` object as a prop. No new state or API calls. The `selected_venues` object already exists in `form` from VenueSelection. The new layout adds a header banner, fills in missing fields in the left panel, collapses to single-column on mobile, and adds a selected venues section.

**Tech Stack:** React 18, inline styles (existing pattern in this component)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `frontend/src/components/plantrip/StepReview.jsx` | Modify | Trip summary header; 4 new fields in left panel; mobile grid fix; selected venues section; step label fix |

---

## Task 1: Redesign StepReview.jsx

**Files:**
- Modify: `frontend/src/components/plantrip/StepReview.jsx`

Read the file before making changes to confirm line numbers. The file is 128 lines.

---

- [ ] **Step 1: Fix the step label**

Find (line 46):
```jsx
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '0.5rem' }}>Step 5 of 5 — Almost there</div>
```

Replace with:
```jsx
      <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: '0.5rem' }}>Step 6 of 6 — Almost there</div>
```

---

- [ ] **Step 2: Add trip summary header**

Find the paragraph subtitle (line 48):
```jsx
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', marginBottom: '2rem', fontStyle: 'italic' }}>Tweak anything before we generate your full itinerary.</p>
```

Replace with:
```jsx
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.95rem', marginBottom: '1.25rem', fontStyle: 'italic' }}>Tweak anything before we generate your full itinerary.</p>

      {/* ── Trip summary banner ── */}
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
          {form.travelDate ? (
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
              From {new Date(form.travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {form.days} days
            </div>
          ) : (
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

- [ ] **Step 3: Fix mobile grid layout**

Find (line 50 — now shifted by the new banner):
```jsx
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
```

Replace with:
```jsx
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
```

---

- [ ] **Step 4: Add 4 missing fields to left panel**

Inside the left panel (`Your preferences`), find the budget row:
```jsx
          <div style={{ marginBottom: '1rem' }}><div style={fieldLabel}>Budget</div><div style={{ color: '#fff', fontWeight: 600 }}>{form.currency} {(+form.budget).toLocaleString()}</div></div>
```

After the budget row, before the travel style row, insert:

```jsx
          {form.travelerType && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={fieldLabel}>Travelling as</div>
              <div style={{ color: '#fff', fontWeight: 600 }}>{form.travelerType}</div>
            </div>
          )}
          {form.travelDate && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={fieldLabel}>Start date</div>
              <div style={{ color: '#fff', fontWeight: 600 }}>
                {new Date(form.travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>Itinerary language</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{form.language || 'English'}</div>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <div style={fieldLabel}>Accommodation suggestions</div>
            <div style={{ color: form.wantsHotelRecs ? '#00d4aa' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.85rem' }}>
              {form.wantsHotelRecs ? '✓ Included' : 'Not included'}
            </div>
          </div>
```

---

- [ ] **Step 5: Add selected venues section**

Find the closing `</div>` of the 2-col grid (the line just before the `{submitError && ...}` line):

```jsx
      </div>

      {submitError && <p style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '0.9rem' }}>{submitError}</p>}
```

Insert the venues section between the grid close and the submit error:

```jsx
      </div>

      {/* ── Selected experiences ── */}
      {form.selected_venues && Object.keys(form.selected_venues).length > 0 && (() => {
        const validEntries = Object.entries(form.selected_venues).filter(([, venues]) =>
          Array.isArray(venues) ? venues.length > 0 : venues instanceof Set ? venues.size > 0 : false
        );
        return validEntries.length > 0 ? (
          <div style={{ ...panel, marginBottom: '1.5rem' }}>
            <div style={sectionLabel}>Selected experiences</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {validEntries.map(([key]) => {
                const parts = key.split('/');
                const activity = parts[parts.length - 1];
                if (activity === '__search__') return null;
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
        ) : null;
      })()}

      {submitError && <p style={{ color: '#ff6b6b', marginBottom: '1rem', fontSize: '0.9rem' }}>{submitError}</p>}
```

Note: The `activity === '__search__'` check filters out the internal `__search__` key used for Foursquare venue search results.

---

- [ ] **Step 6: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

---

- [ ] **Step 7: Visual check**

Start dev server: `npm run dev`

Navigate to `http://localhost:5173/plan`, fill in a destination + some fields, advance to step 6. Verify:
- Step label shows "Step 6 of 6 — Almost there"
- Teal banner shows destination name, duration, traveler type tag, pace tag, language tag
- Left panel shows traveler type, start date (if set), language, accommodation toggle
- Day outline preview still loads on the right
- Resize browser to 375px width — both panels stack vertically (not two narrow columns)
- If venues were selected in step 2, a "Selected experiences" section appears below

---

- [ ] **Step 8: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/components/plantrip/StepReview.jsx && git commit -m "feat: redesign step 6 review — trip banner, full preferences, venues, mobile layout"
```

---

## Done

1 commit. Step 6 now shows everything the user selected — destination, dates, traveler type, language, accommodation preference, selected venues — with a prominent trip summary banner and a mobile-friendly single-column layout.
