# P1: Nav Auth State + Step Persistence + Progress Navigation

**Date:** 2026-06-02
**Status:** Approved, ready for implementation
**Scope:** Landing.jsx + Landing.css (nav) + PlanTrip.jsx (step state, progress, VenueSelection label)

---

## Fix 1: Landing nav — Dashboard link for logged-in users

**File:** `frontend/src/pages/Landing.jsx`

Current: logged-in users see nav links + "Plan my trip" CTA. No link to their dashboard.
Non-logged-in users see nav links + "Sign in" link + "Sign up free" CTA.

**Change:** Add a `Dashboard` nav link for authenticated users:

```
Non-logged-in:  [Explore][How it works][Sample plan][Pricing][For agencies] | Sign in | [Sign up free]
Logged-in:      [Explore][How it works][Sample plan][Pricing][For agencies] | Dashboard | [Plan my trip]
```

In the nav JSX, replace the current conditional block:

```jsx
{!currentUser && (
  <a href="/login" className="nav-link nav-signin">Sign in</a>
)}
<button className="nav-cta" onClick={planRoute}>
  {currentUser ? 'Plan my trip' : 'Sign up free'}
</button>
```

With:

```jsx
{currentUser ? (
  <a href="/dashboard" className="nav-link">Dashboard</a>
) : (
  <a href="/login" className="nav-link nav-signin">Sign in</a>
)}
<button className="nav-cta" onClick={planRoute}>
  {currentUser ? 'Plan my trip' : 'Sign up free'}
</button>
```

**No CSS changes needed** — `Dashboard` uses the existing `.nav-link` class (visible on desktop, hidden on mobile ≤768px). On mobile, logged-in users reach Dashboard via the "Plan my trip → Dashboard" flow or by typing the URL. The CTA stays visible on mobile regardless.

---

## Fix 2: Step + form state persistence via sessionStorage

**File:** `frontend/src/pages/PlanTrip.jsx`

**Problem:** `step` and `form` live only in React state — a browser refresh discards everything and starts at step 0 with a blank form.

**Solution:** Sync to `sessionStorage` on every change. Restore on mount.

### Storage keys
- `wz_plan_step` — current step index as a string (e.g. `"3"`)
- `wz_plan_form` — full form object as JSON string

### Restore on mount (change `useState` initialisers)

```js
const [step, setStep] = useState(() => {
  if (location.state?.startStep != null) return location.state.startStep;
  const saved = sessionStorage.getItem('wz_plan_step');
  return saved != null ? parseInt(saved, 10) : 0;
});

const [form, setForm] = useState(() => {
  const prefill = location.state?.prefill || {};
  if (Object.keys(prefill).length > 0) return { ...INITIAL_FORM, ...prefill };
  try {
    const saved = sessionStorage.getItem('wz_plan_form');
    if (saved) return { ...INITIAL_FORM, ...JSON.parse(saved) };
  } catch { /* ignore corrupt storage */ }
  return { ...INITIAL_FORM };
});
```

### Write on step change

Wrap `setStep` calls to also persist:

```js
const goToStep = (n) => {
  setStep(n);
  sessionStorage.setItem('wz_plan_step', String(n));
};
```

Replace all `setStep(...)` calls with `goToStep(...)`. This includes:
- `setStep(nextStep)` in the `next` function
- `setStep(s => s - 1)` in `back` → becomes `goToStep(step - 1)`
- `setStep(2)` in `handleVenueSelect` → becomes `goToStep(2)`
- Any `setStep(0)` reset paths

### Write on form change

The `set` helper already calls `setForm(f => ...)`. Add a `useEffect` to persist form on every change:

```js
useEffect(() => {
  sessionStorage.setItem('wz_plan_form', JSON.stringify(form));
}, [form]);
```

### Clear on submission + exit

In `handleSubmit` (after successful submit), clear storage:

```js
sessionStorage.removeItem('wz_plan_step');
sessionStorage.removeItem('wz_plan_form');
```

In the "✕ Exit" button onClick:

```js
onClick={() => {
  sessionStorage.removeItem('wz_plan_step');
  sessionStorage.removeItem('wz_plan_form');
  navigate('/');
}}
```

This applies to BOTH nav instances (VenueSelection branch and main return branch).

---

## Fix 3: Step label in VenueSelection view

**File:** `frontend/src/pages/PlanTrip.jsx`

**Problem:** The VenueSelection layout shows the segmented progress bar but no text label — users don't know they're on "Step 2 of 6".

**Change:** Add a step label div immediately after the progress bar in the VenueSelection early-return branch:

Find this block (in the `step === 1` early return):

```jsx
<div style={{ padding: '12px 24px 0' }}>{progressBar}</div>
```

Replace with:

```jsx
<div style={{ padding: '12px 24px 0' }}>
  {progressBar}
  <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#00d4aa', marginTop: 8, paddingBottom: 4 }}>
    Step 2 of 6 — Choose your experiences
  </div>
</div>
```

---

## Fix 4: Click-to-navigate on completed progress segments

**File:** `frontend/src/pages/PlanTrip.jsx`

**Problem:** Progress bar segments are decorative only — users can't jump back to a completed step by clicking.

**Change:** In the `progressBar` computed element, make completed segments clickable:

Current:
```jsx
const progressBar = (
  <div className="plantrip-progress">
    {STEPS.map((_, i) => {
      let cls = 'plantrip-progress__seg';
      if (i < step) cls += ' plantrip-progress__seg--done';
      else if (i === step) cls += ' plantrip-progress__seg--active';
      return <div key={i} className={cls}></div>;
    })}
  </div>
);
```

Replace with:
```jsx
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
          title={isDone ? `Back to ${STEPS[i]}` : undefined}
        />
      );
    })}
  </div>
);
```

Only `isDone` segments are clickable — active and future segments have no `onClick`. Uses `goToStep` from Fix 2 so the sessionStorage is also updated when navigating backwards.

---

## Out of scope

- Forward navigation by clicking future steps (would bypass validation)
- Settings link in nav (separate sub-project)
- Mobile hamburger menu (separate sub-project, already assessed earlier)
