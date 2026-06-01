# Landing Page Polish

**Date:** 2026-06-01
**Status:** Approved, ready for implementation
**Scope:** 4 targeted visual fixes to Landing.css + Landing.jsx

---

## Fix 1: Hero title line height

**File:** `frontend/src/pages/Landing.css`

`.hero-title` has `line-height: 1.0` — no breathing room between lines at display size.

Change `line-height: 1.0` → `line-height: 1.1`.

---

## Fix 2: Ghost CTA button border + background

**File:** `frontend/src/pages/Landing.css`

`.btn-ghost` has `border: 1px solid var(--border)` where `--border = rgba(255,255,255,0.08)` — nearly invisible.

Change:
```css
.btn-ghost {
  background: transparent; color: var(--white-60);
  border: 1px solid var(--border); padding: 1rem 2rem;
  border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1rem; font-weight: 500; cursor: pointer;
  transition: all 0.2s;
}
```

To:
```css
.btn-ghost {
  background: rgba(255,255,255,0.04); color: var(--white-60);
  border: 1px solid rgba(255,255,255,0.25); padding: 1rem 2rem;
  border-radius: 12px; font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 1rem; font-weight: 500; cursor: pointer;
  transition: all 0.2s;
}
```

---

## Fix 3: Gradient end colour — full opacity teal

**File:** `frontend/src/pages/Landing.css`

`.hero-title-gradient` ends at `rgba(0,212,170,0.75)` — 75% opacity makes the gradient tail look pale.

Change:
```css
.hero-title-gradient {
  background: linear-gradient(135deg, #ffffff 20%, rgba(0,212,170,0.75) 100%);
```

To:
```css
.hero-title-gradient {
  background: linear-gradient(135deg, #ffffff 20%, #00d4aa 100%);
```

---

## Fix 4: Social proof micro-text below CTA buttons

**File:** `frontend/src/pages/Landing.jsx`

Add one line of micro-text directly after the closing `</div>` of `.hero-actions` and before the `.hero-tags` block.

Find (around line 137):
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

Change to:
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

---

## Out of scope

- Background image overlay (already at 0.08 opacity — already minimal)
- "real" span font-weight (already italic + teal, sufficiently distinct)
