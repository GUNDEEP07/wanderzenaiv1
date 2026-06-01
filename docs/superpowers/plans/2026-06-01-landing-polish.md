# Landing Page Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 small landing page issues — hero title line-height, ghost button border visibility, gradient end opacity, and a social proof line below the CTAs.

**Architecture:** Two file edits — Landing.css gets 3 CSS value changes, Landing.jsx gets one JSX block insertion. No new components, no new state.

**Tech Stack:** React 18, Vite, CSS (Landing.css + Landing.jsx inline)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `frontend/src/pages/Landing.css` | Modify | `.hero-title` lineHeight 1.0→1.1; `.btn-ghost` border opacity + bg; `.hero-title-gradient` end colour full opacity |
| `frontend/src/pages/Landing.jsx` | Modify | Social proof micro-text div inserted after `.hero-actions` |

---

## Task 1: Landing.css — 3 CSS value fixes

**Files:**
- Modify: `frontend/src/pages/Landing.css`

- [ ] **Step 1: Fix hero title line height**

Find `.hero-title` (search for `line-height: 1.0`). The full rule currently reads:

```css
.hero-title {
  font-family: 'Fraunces', serif;
  font-size: clamp(3rem, 8vw, 6.5rem);
  font-weight: 700; line-height: 1.0;
  letter-spacing: -0.03em;
  color: var(--white);
  margin-bottom: 1.5rem;
  max-width: 900px;
}
```

Change `line-height: 1.0` to `line-height: 1.1`:

```css
.hero-title {
  font-family: 'Fraunces', serif;
  font-size: clamp(3rem, 8vw, 6.5rem);
  font-weight: 700; line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--white);
  margin-bottom: 1.5rem;
  max-width: 900px;
}
```

- [ ] **Step 2: Fix ghost button border + background**

Find `.btn-ghost`. It currently reads:

```css
.btn-ghost {
  background: transparent; color: var(--white-60);
  border: 1px solid var(--border); padding: 1rem 2rem;
  border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1rem; font-weight: 500; cursor: pointer;
  transition: all 0.2s;
}
```

Replace with:

```css
.btn-ghost {
  background: rgba(255,255,255,0.04); color: var(--white-60);
  border: 1px solid rgba(255,255,255,0.25); padding: 1rem 2rem;
  border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1rem; font-weight: 500; cursor: pointer;
  transition: all 0.2s;
}
```

- [ ] **Step 3: Fix gradient end colour**

Find `.hero-title-gradient` (search for `rgba(0,212,170,0.75)`). It currently reads:

```css
.hero-title-gradient {
  background: linear-gradient(135deg, #ffffff 20%, rgba(0,212,170,0.75) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

Change `rgba(0,212,170,0.75)` to `#00d4aa`:

```css
.hero-title-gradient {
  background: linear-gradient(135deg, #ffffff 20%, #00d4aa 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 5: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/Landing.css && git commit -m "style: landing — hero lineHeight 1.1, ghost btn border visible, gradient full opacity teal"
```

---

## Task 2: Landing.jsx — social proof micro-text

**Files:**
- Modify: `frontend/src/pages/Landing.jsx`

- [ ] **Step 1: Insert micro-text after hero-actions**

Find the `.hero-actions` div and its closing tag, followed by the `.hero-tags` div. It currently reads:

```jsx
<div className="hero-actions">
  <button className="btn-primary" onClick={planRoute}>
    Plan my trip — free <span>→</span>
  </button>
  <button className="btn-ghost" onClick={() => document.getElementById('sample').scrollIntoView({ behavior: 'smooth' })}>
    See a sample plan
  </button>
</div>

<div className="hero-tags">
```

Replace with (insert the micro-text div between hero-actions and hero-tags):

```jsx
<div className="hero-actions">
  <button className="btn-primary" onClick={planRoute}>
    Plan my trip — free <span>→</span>
  </button>
  <button className="btn-ghost" onClick={() => document.getElementById('sample').scrollIntoView({ behavior: 'smooth' })}>
    See a sample plan
  </button>
</div>

<div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: '1.5rem' }}>
  Trusted by {stats.totalTrips}+ slow travelers · Free to start
</div>

<div className="hero-tags">
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 3: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/Landing.jsx && git commit -m "feat: social proof micro-text below hero CTAs"
```

---

## Done

2 commits. Landing hero now has:
- Slightly more breathing room between title lines
- A visible ghost button border that reads as a distinct CTA
- A punchier gradient that hits full-opacity teal
- One line of social proof directly below the CTAs
