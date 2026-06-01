# PlanTrip Form Polish

**Date:** 2026-06-01
**Status:** Approved, ready for implementation
**Scope:** PlanTrip.jsx inline styles + PlanTrip.css — 8 targeted visual fixes

---

## Fixes

### 1. Progress bar — define missing CSS classes

**Problem:** `plantrip-progress`, `plantrip-progress__seg`, `plantrip-progress__seg--done`, `plantrip-progress__seg--active` are used in PlanTrip.jsx JSX but have no definitions in PlanTrip.css. The progress bar renders with no visual style.

**Fix:** Add to `PlanTrip.css`:

```css
.plantrip-progress {
  display: flex; gap: 4px; margin-bottom: 2rem;
}
.plantrip-progress__seg {
  flex: 1; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,0.12);
  transition: background 0.3s;
}
.plantrip-progress__seg--done { background: rgba(0,212,170,0.5); }
.plantrip-progress__seg--active { background: #00d4aa; }
```

---

### 2. Placeholder contrast

**Problem:** `sharedStyles` in PlanTrip.jsx sets `input::placeholder { color: rgba(255,255,255,0.2) }` — 20% opacity on a dark card is unreadable.

**Fix:** Change to `rgba(255,255,255,0.4)` in `sharedStyles`.

---

### 3. Days counter font

**Problem:** `s.daysNum` uses `fontFamily: "'Fraunces', serif"` for the large day number. The +/− stepper buttons are clean sans-serif circles, creating a visual mismatch.

**Fix:** Change `s.daysNum` to:
```js
daysNum: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '2.5rem', fontWeight: 800, color: '#00d4aa', minWidth: 60, textAlign: 'center' },
```

---

### 4. Ampersand in "Budget & dates"

**Problem:** The step title uses `fontFamily: "'Fraunces', serif"` — the `&` renders as a stylised serif ligature that looks decorative and out of place in the form context.

**Fix:** In the JSX step title for Budget step (around line 416), wrap the `&` in a sans-serif span:

```jsx
<h2 style={s.stepTitle}>Budget <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>&</span> dates</h2>
```

---

### 5. Active state border thickness

**Problem:** Selected choice buttons have `border: 1px solid #00d4aa` — 1px is barely visible on mobile.

**Fix:** In `s.choiceBtn`, change the selected border from `1px` to `2px`:

```js
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
```

Note the inactive background also changes from `0.04` to `0.07` (fix 6 combined here).

---

### 6. Inactive choice card background

**Problem:** Unselected `s.choiceBtn` has `background: rgba(255,255,255,0.04)` — nearly invisible against the dark card, making buttons hard to identify as tappable.

**Fix:** Already combined in fix 5 above — change `0.04` to `0.07`.

---

### 7. Step title line height

**Problem:** `s.stepTitle` has `lineHeight: 1.2` — wrapping titles on mobile appear cramped.

**Fix:** Change to `lineHeight: 1.35` in `s.stepTitle`.

---

### 8. Em-dash in step subtitle

**Problem:** `"This shapes the entire plan — activities, pace, food and accommodation."` — the em-dash with surrounding spaces reads wide on narrow viewports.

**Fix:** Change the subtitle text to use a colon:
```
"This shapes the entire plan: activities, pace, food and accommodation."
```

---

## Files

- `frontend/src/pages/PlanTrip.css` — fixes 1, 2
- `frontend/src/pages/PlanTrip.jsx` — fixes 3, 4, 5+6, 7, 8

## Out of scope

- VenueSelection component (separate sub-project)
- Progress bar dot/label variant (the current segment bar is simpler and sufficient)
- Tag buttons (`s.tag`) — consistent with choiceBtn pattern, low priority
