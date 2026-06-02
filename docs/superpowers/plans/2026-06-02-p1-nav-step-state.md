# P1: Nav Auth State + Step Persistence + Progress Navigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a Dashboard link for signed-in users on the landing nav, persist the multi-step form state through browser refreshes via sessionStorage, add a step label to the VenueSelection view, and make completed progress segments clickable.

**Architecture:** Two independent file edits — Landing.jsx gets a one-line conditional nav link change. PlanTrip.jsx gets sessionStorage read/write wired into the existing state initialisers and mutation points, a `goToStep` helper that wraps `setStep`, and a progress bar upgrade. No new files, no new components.

**Tech Stack:** React 18, Vite, sessionStorage API (already available in the browser environment)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `frontend/src/pages/Landing.jsx` | Modify | Replace `Sign in` conditional with `Dashboard` for logged-in users |
| `frontend/src/pages/PlanTrip.jsx` | Modify | sessionStorage restore on mount; `goToStep` helper; form persistence effect; clear on exit/submit; step label; clickable progress segments |

---

## Task 1: Landing.jsx — Dashboard link for logged-in users

**Files:**
- Modify: `frontend/src/pages/Landing.jsx`

- [ ] **Step 1: Replace Sign in / Sign up conditional with Dashboard / Sign up**

Find this block in the nav (around line 102):

```jsx
          {!currentUser && (
            <a href="/login" className="nav-link nav-signin">Sign in</a>
          )}
          <button className="nav-cta" onClick={planRoute}>
            {currentUser ? 'Plan my trip' : 'Sign up free'}
          </button>
```

Replace with:

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

- [ ] **Step 2: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 3: Visual check**

Start dev server: `npm run dev`
Open `http://localhost:5173` logged OUT → nav should show "Sign in" link.
Open `http://localhost:5173` logged IN → nav should show "Dashboard" link (takes you to `/dashboard`).

- [ ] **Step 4: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/Landing.jsx && git commit -m "feat: show Dashboard nav link for signed-in users on landing page"
```

---

## Task 2: PlanTrip.jsx — sessionStorage persistence + step label + clickable progress

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

All changes are in one file. Apply them in order — each step builds on the previous.

- [ ] **Step 1: Restore step and form from sessionStorage on mount**

Find the two `useState` calls at the top of the component (lines 125–126):

```jsx
  const [step, setStep] = useState(location.state?.startStep || 0);
  const [form, setForm] = useState({ ...INITIAL_FORM, ...prefill });
```

Replace with (lazy initialisers that read sessionStorage):

```jsx
  const [step, setStep] = useState(() => {
    // location.state.startStep takes priority (e.g. navigating from TravelChat)
    if (location.state?.startStep != null) return location.state.startStep;
    try {
      const saved = sessionStorage.getItem('wz_plan_step');
      if (saved != null) return parseInt(saved, 10);
    } catch { /* ignore */ }
    return 0;
  });

  const [form, setForm] = useState(() => {
    // Explicit prefill (from recommendations or re-plan) always wins over saved state
    if (Object.keys(prefill).length > 0) return { ...INITIAL_FORM, ...prefill };
    try {
      const saved = sessionStorage.getItem('wz_plan_form');
      if (saved) return { ...INITIAL_FORM, ...JSON.parse(saved) };
    } catch { /* ignore corrupt storage */ }
    return { ...INITIAL_FORM };
  });
```

- [ ] **Step 2: Add goToStep helper and form persistence effect**

After the existing `useEffect` hooks (after line 181, before the `set` function at line 184), add:

```jsx
  // Persist form to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('wz_plan_form', JSON.stringify(form));
    } catch { /* ignore */ }
  }, [form]);

  // Wrapper for setStep that also persists to sessionStorage
  const goToStep = (n) => {
    setStep(n);
    try { sessionStorage.setItem('wz_plan_step', String(n)); } catch { /* ignore */ }
  };
```

- [ ] **Step 3: Replace setStep calls with goToStep**

There are 3 direct `setStep` calls to replace. Find and update each one:

**3a.** In the `next` function (around line 249):
```jsx
  const next = () => {
    if (!validate()) return;
    const nextStep = step + 1;
    setStep(nextStep);                   // ← change this
    if (nextStep === 5) loadPreview(form);
  };
```
Change `setStep(nextStep)` → `goToStep(nextStep)`:
```jsx
  const next = () => {
    if (!validate()) return;
    const nextStep = step + 1;
    goToStep(nextStep);
    if (nextStep === 5) loadPreview(form);
  };
```

**3b.** The `back` function (around line 255):
```jsx
  const back = () => setStep(s => s - 1);
```
Replace with:
```jsx
  const back = () => goToStep(step - 1);
```

**3c.** In `handleVenueSelect` (around line 218):
```jsx
    setStep(2);
```
Replace with:
```jsx
    goToStep(2);
```

- [ ] **Step 4: Clear sessionStorage on successful submission**

In `handleSubmit`, find the `navigate('/confirmation', ...)` call (around line 271). Add sessionStorage clear BEFORE the navigate:

```jsx
      analytics.tripSubmitted({ destination: destinationName, days: form.days, travelStyle: form.travelStyle });
      sessionStorage.removeItem('wz_plan_step');
      sessionStorage.removeItem('wz_plan_form');
      navigate('/confirmation', {
        state: { submissionId: data.data.submissionId, destination: destinationName, email: form.email },
      });
```

- [ ] **Step 5: Clear sessionStorage on Exit button (VenueSelection branch)**

Find the "✕ Exit" button in the VenueSelection early-return branch (around line 309):

```jsx
          <button type="button" onClick={() => navigate('/')} style={{ ... }}>✕ Exit</button>
```

Replace with:

```jsx
          <button type="button" onClick={() => { sessionStorage.removeItem('wz_plan_step'); sessionStorage.removeItem('wz_plan_form'); navigate('/'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>✕ Exit</button>
```

- [ ] **Step 6: Clear sessionStorage on Exit button (main return branch)**

Find the "✕ Exit" button in the main return nav (around line 319, second instance):

```jsx
        <button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>✕ Exit</button>
```

Replace with:

```jsx
        <button type="button" onClick={() => { sessionStorage.removeItem('wz_plan_step'); sessionStorage.removeItem('wz_plan_form'); navigate('/'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>✕ Exit</button>
```

- [ ] **Step 7: Make completed progress segments clickable**

Find the `progressBar` computed element (around line 281):

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
            title={isDone ? `Go back to ${STEPS[i]}` : undefined}
          />
        );
      })}
    </div>
  );
```

- [ ] **Step 8: Add step label to VenueSelection view**

Find this block in the step===1 early return (around line 311):

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

- [ ] **Step 9: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 10: Smoke test in browser**

Start dev server: `npm run dev`, open `http://localhost:5173/plan`.

1. **Refresh test:** Go to step 3 (Budget & dates), enter a budget, then refresh — page should reload at step 3 with the budget still filled in.
2. **Exit clears test:** Go to step 2, click "✕ Exit", then navigate back to `/plan` — should start fresh at step 0, not resume.
3. **Submit clears test:** Complete and submit — after redirect to `/confirmation`, navigate back to `/plan` — should start fresh at step 0.
4. **Back-click test:** From step 3, click the teal-filled step 1 segment — should jump to step 1 (destination).
5. **VenueSelection label:** Select a destination, advance to step 1 — should see "Step 2 of 6 — Choose your experiences" label below the progress bar.

- [ ] **Step 11: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/PlanTrip.jsx && git commit -m "feat: persist plan form state in sessionStorage; step label in venues; clickable progress segments"
```

---

## Done

2 commits. After this:
- Signed-in users see "Dashboard" in the landing nav
- Refreshing mid-form no longer wipes progress
- VenueSelection shows "Step 2 of 6" label  
- Completed progress segments are clickable to navigate backwards
