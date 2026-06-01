# PlanTrip Form Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 visual issues in the PlanTrip multi-step form — progress bar visibility, placeholder contrast, days counter font, ampersand rendering, active state borders, inactive button backgrounds, line height, and em-dash in subtitle.

**Architecture:** Two independent edits — PlanTrip.css (adds missing progress bar classes and improves placeholder contrast) and PlanTrip.jsx (updates inline `s` object values and one text node). No new files, no logic changes, purely visual.

**Tech Stack:** React 18, Vite, CSS, Plus Jakarta Sans + Fraunces fonts (already loaded via index.html)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `frontend/src/pages/PlanTrip.css` | Modify | Add `.plantrip-progress*` classes; bump placeholder opacity |
| `frontend/src/pages/PlanTrip.jsx` | Modify | `s.daysNum` font, `s.stepTitle` lineHeight, `s.choiceBtn` border+bg, step 3 title ampersand, step 3 subtitle text |

---

## Task 1: PlanTrip.css — progress bar + placeholder

**Files:**
- Modify: `frontend/src/pages/PlanTrip.css`

- [ ] **Step 1: Add progress bar CSS classes**

Open `frontend/src/pages/PlanTrip.css`. At the very end of the file (after the existing `@media (max-width: 640px)` block), append:

```css
/* ── Progress bar (dark theme) ─────────────────────────────────── */
.plantrip-progress {
  display: flex;
  gap: 4px;
  margin-bottom: 2rem;
}
.plantrip-progress__seg {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: rgba(255,255,255,0.12);
  transition: background 0.3s;
}
.plantrip-progress__seg--done    { background: rgba(0,212,170,0.5); }
.plantrip-progress__seg--active  { background: #00d4aa; }
```

- [ ] **Step 2: Fix placeholder contrast**

In `PlanTrip.css`, find the existing `@media (max-width: 640px)` block — it is the last block in the file. The placeholder override lives inside `sharedStyles` in `PlanTrip.jsx`, NOT in this CSS file, so skip this step here (handled in Task 2).

- [ ] **Step 3: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 4: Visual check**

Run `npm run dev` from `frontend/`. Open `http://localhost:5173/plan`. The top progress bar should now show as a thin teal/white segmented bar — teal for the current step, lighter teal for completed, dim white for future steps.

- [ ] **Step 5: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/PlanTrip.css && git commit -m "style: add plantrip progress bar CSS; segment bar now visible"
```

---

## Task 2: PlanTrip.jsx — s object + placeholder + text fixes

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

- [ ] **Step 1: Fix placeholder contrast in sharedStyles**

Find `sharedStyles` (search for `input::placeholder`). It currently reads:

```jsx
const sharedStyles = `
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
  select option { background: #111827; color: #fff; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
```

Change `rgba(255,255,255,0.2)` to `rgba(255,255,255,0.4)`:

```jsx
const sharedStyles = `
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.4); }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
  select option { background: #111827; color: #fff; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
```

- [ ] **Step 2: Fix days counter font in s.daysNum**

Find `s.daysNum` in the `s` object (search for `daysNum`). It currently reads:

```js
daysNum: { fontFamily: "'Fraunces', serif", fontSize: '2.5rem', fontWeight: 700, color: '#00d4aa', minWidth: 60, textAlign: 'center' },
```

Replace with (switch to Plus Jakarta Sans, bump weight to 800):

```js
daysNum: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '2.5rem', fontWeight: 800, color: '#00d4aa', minWidth: 60, textAlign: 'center' },
```

- [ ] **Step 3: Fix step title line height in s.stepTitle**

Find `s.stepTitle` (search for `stepTitle`). It currently reads:

```js
stepTitle: { fontFamily: "'Fraunces', serif", fontSize: '2rem', color: '#fff', marginBottom: '0.5rem', lineHeight: 1.2, letterSpacing: '-0.02em' },
```

Change `lineHeight: 1.2` to `lineHeight: 1.35`:

```js
stepTitle: { fontFamily: "'Fraunces', serif", fontSize: '2rem', color: '#fff', marginBottom: '0.5rem', lineHeight: 1.35, letterSpacing: '-0.02em' },
```

- [ ] **Step 4: Fix choiceBtn — 2px active border + improved inactive background**

Find `s.choiceBtn` in the `s` object (search for `choiceBtn`). It currently reads:

```js
choiceBtn: (sel) => ({
  padding: '0.75rem 1rem',
  border: `1px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`,
  borderRadius: 10,
  background: sel ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)',
  color: sel ? '#00d4aa' : 'rgba(255,255,255,0.6)',
  cursor: 'pointer', fontFamily: "'Plus Jakarta Sans', sans-serif",
  fontSize: '0.875rem', fontWeight: sel ? 700 : 400,
  transition: 'all 0.15s', textAlign: 'left',
}),
```

Replace with (2px border when selected, 0.07 bg when unselected):

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

- [ ] **Step 5: Fix ampersand in "Budget & dates" title**

Find the Budget step title (search for `Budget & dates`). It currently reads:

```jsx
<h2 style={s.stepTitle}>Budget & dates</h2>
```

Replace with (wrap `&` in a sans-serif span):

```jsx
<h2 style={s.stepTitle}>Budget <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 400 }}>&</span> dates</h2>
```

- [ ] **Step 6: Fix em-dash in step 3 subtitle**

Find the travel style step subtitle (search for `This shapes the entire plan`). It currently reads:

```jsx
<p style={s.stepSub}>This shapes the entire plan — activities, pace, food and accommodation.</p>
```

Replace with (colon replaces em-dash):

```jsx
<p style={s.stepSub}>This shapes the entire plan: activities, pace, food and accommodation.</p>
```

- [ ] **Step 7: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 8: Visual spot-check at 375px**

Open DevTools → device toolbar → 375px wide. Verify on `/plan`:

- Step 1 form: placeholder text in the destination input is visibly readable (not nearly-invisible)
- Days counter: the "5" is bold sans-serif, not a thin serif character
- Traveler type and pace buttons: unselected cards have a subtle visible background; selected cards show a 2px teal border that clearly stands out
- Step 3 title reads "Budget & dates" with a thinner `&`
- Step 4 subtitle reads "This shapes the entire plan: activities, pace, food and accommodation."

- [ ] **Step 9: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/PlanTrip.jsx && git commit -m "style: plantrip form polish — placeholder contrast, days font, choiceBtn borders, ampersand, subtitle text"
```

---

## Done

2 commits, 8 visual fixes. The form now has a visible progress bar, readable placeholders, a consistent sans-serif days counter, thicker active borders on all selection buttons, and cleaner step titles.
