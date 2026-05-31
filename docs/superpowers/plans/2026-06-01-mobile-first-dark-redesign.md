# Mobile-First Dark UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all broken mobile layouts across every page and apply a unified dark aurora glass design language, with CSS media queries replacing all JS-based mobile detection.

**Architecture:** CSS-only responsive system using two breakpoints (640px, 768px) defined consistently across all pages. Dashboard's JS `isMobile` flag is removed entirely and replaced with a new `Dashboard.css` file. Aurora ambient glows apply to hero sections only; content sections stay clean.

**Tech Stack:** React 18, Vite, CSS (no new libraries), existing Fraunces + Plus Jakarta Sans fonts

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/index.css` | Modify | Add CSS custom property tokens |
| `frontend/src/pages/Landing.css` | Modify | Aurora h1, mobile hero, stats 2×2, photo strip 2-col, section padding, testimonials |
| `frontend/src/pages/Landing.jsx` | Modify | Add purple glow div, gradient class on h1, remove font @import from PlanTrip sharedStyles |
| `frontend/src/pages/Dashboard.css` | **Create** | All responsive classes replacing isMobile JS logic |
| `frontend/src/pages/Dashboard.jsx` | Modify | Import Dashboard.css, remove isMobile state/effect, add classNames, remove ternaries |
| `frontend/src/pages/ExplorePage.jsx` | Modify | Remove @import, update nav, scrollable continent tabs, mobile grid |
| `frontend/src/pages/Pricing.css` | Modify | Add nav styles, mobile grids, card padding media queries |
| `frontend/src/pages/Pricing.jsx` | Modify | Update nav to shared pattern, add classNames for Pricing.css, import Pricing.css |
| `frontend/src/pages/PlanTrip.jsx` | Modify | Update nav to shared pattern, remove @import from sharedStyles, mobile progress bar |
| `frontend/src/pages/PlanTrip.css` | Modify | Add mobile progress bar label hiding |

---

## Task 1: CSS tokens in index.css

**Files:**
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Add padding tokens and aurora keyframe**

Open `frontend/src/index.css`. After the existing rules, add:

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,400&display=swap');

*, *::before, *::after { box-sizing: border-box; }
html, body, #root {
  margin: 0;
  padding: 0;
  background: #0a0f1e;
  min-height: 100vh;
}

:root {
  --mobile-pad: 1rem;
  --tablet-pad: 2rem;
  --desktop-pad: 2.5rem;
}
```

The full file should look exactly like this — replacing the current contents:

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,700;0,9..144,900;1,9..144,300;1,9..144,400&display=swap');

*, *::before, *::after { box-sizing: border-box; }
html, body, #root {
  margin: 0;
  padding: 0;
  background: #0a0f1e;
  min-height: 100vh;
}

:root {
  --mobile-pad: 1rem;
  --tablet-pad: 2rem;
  --desktop-pad: 2.5rem;
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: add CSS padding tokens to index.css"
```

---

## Task 2: Landing — aurora hero + mobile CTAs

**Files:**
- Modify: `frontend/src/pages/Landing.jsx`
- Modify: `frontend/src/pages/Landing.css`

- [ ] **Step 1: Add purple aurora glow to hero in Landing.jsx**

In `Landing.jsx`, find the `hero-bg` div (around line 108). It currently has `hero-grid`, `hero-glow-1`, `hero-glow-2`. Add a third glow:

```jsx
<div className="hero-bg">
  <div style={{
    position: 'absolute', inset: 0, zIndex: 0,
    backgroundImage: 'url(https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&h=900&fit=crop&auto=format)',
    backgroundSize: 'cover', backgroundPosition: 'center',
    opacity: 0.08,
  }} />
  <div className="hero-grid" />
  <div className="hero-glow-1" />
  <div className="hero-glow-2" />
  <div className="hero-glow-3" />
</div>
```

- [ ] **Step 2: Add gradient class to h1 in Landing.jsx**

Find the `<h1 className="hero-title">` (around line 126). Add `hero-title-gradient` class:

```jsx
<h1 className="hero-title hero-title-gradient">
  Find the <span className="hero-title-teal">real</span> destination<br />
  <span className="hero-title-dim">hiding behind the tourist trail</span>
</h1>
```

- [ ] **Step 3: Add aurora glow-3, gradient title, and mobile CTA rules to Landing.css**

Add these rules to `Landing.css` (append before the `@media` blocks):

```css
/* Purple aurora glow */
.hero-glow-3 {
  position: absolute; bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 600px; height: 400px; border-radius: 50%;
  background: radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 70%);
}

/* Gradient text on hero h1 */
.hero-title-gradient {
  background: linear-gradient(135deg, #ffffff 20%, rgba(0,212,170,0.75) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
/* Override teal span and dim span to work within gradient */
.hero-title-gradient .hero-title-teal {
  -webkit-text-fill-color: #00d4aa;
}
.hero-title-gradient .hero-title-dim {
  -webkit-text-fill-color: rgba(255,255,255,0.5);
}
```

- [ ] **Step 4: Add mobile CTA rules to Landing.css `@media (max-width: 640px)` block**

The existing `@media (max-width: 640px)` block at the bottom of `Landing.css` currently has:

```css
@media (max-width: 480px) {
  .hero-tags { display: none; }
  .nav-links { display: none; }
  .proof-grid, .hero-proof { flex-direction: column; gap: 12px; }
}
```

Add a new `@media (max-width: 640px)` block before the 480px block:

```css
@media (max-width: 640px) {
  .hero { padding: 5rem 1rem 3rem; }
  .hero-actions { flex-direction: column; width: 100%; }
  .btn-primary { width: 100%; justify-content: center; min-height: 52px; }
  .btn-ghost { width: 100%; justify-content: center; min-height: 48px; }
}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Visual check at 375px**

Run dev server: `npm run dev`  
Open `http://localhost:5173`, open DevTools → toggle device toolbar → set to 375px wide.  
Verify: hero h1 has gradient text, teal word is teal, CTAs are full-width and stacked.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Landing.jsx frontend/src/pages/Landing.css
git commit -m "style: aurora h1 gradient + full-width mobile CTAs on landing"
```

---

## Task 3: Landing — stats grid, photo strip, sections, testimonials

**Files:**
- Modify: `frontend/src/pages/Landing.css`

- [ ] **Step 1: Add stats 2×2 grid rule**

The `.hero-proof` element is a flex row of 4 stat items. Add to the `@media (max-width: 640px)` block created in Task 2:

```css
@media (max-width: 640px) {
  .hero { padding: 5rem 1rem 3rem; }
  .hero-actions { flex-direction: column; width: 100%; }
  .btn-primary { width: 100%; justify-content: center; min-height: 52px; }
  .btn-ghost { width: 100%; justify-content: center; min-height: 48px; }
  .hero-proof { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; padding-top: 0; }
  .proof-item { padding: 14px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .proof-item:nth-child(2n) { border-right: none; }
  .proof-item:nth-child(3), .proof-item:nth-child(4) { border-bottom: none; }
}
```

- [ ] **Step 2: Add photo strip 2-column rule**

The photo strip uses an inline `gridTemplateColumns: 'repeat(6, minmax(0,1fr))'` on a div in `Landing.jsx`. Since it's inline, we can't override it with a CSS class media query. Change it in `Landing.jsx` — find the photo strip grid div (around line 213):

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 8 }} className="reveal photo-strip-grid" ref={addRef}>
```

Change to:

```jsx
<div className="reveal photo-strip-grid" ref={addRef}>
```

Then add to `Landing.css`:

```css
.photo-strip-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

@media (max-width: 640px) {
  .photo-strip-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
}
```

- [ ] **Step 3: Add section padding reduction**

The `.section` class has `padding: 7rem 2rem`. Add to `@media (max-width: 640px)`:

```css
  .section { padding: 4rem var(--mobile-pad); }
```

- [ ] **Step 4: Fix testimonials min-width**

The testimonials grid uses an inline `gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'` at around line 373 in `Landing.jsx`. Change it:

```jsx
<div className="reveal testimonials-grid" ref={addRef} style={{ gap: 20 }}>
```

And add to `Landing.css`:

```css
.testimonials-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

@media (max-width: 640px) {
  .testimonials-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Visual check at 375px**

At 375px verify:
- Stats show as 2×2 grid below the hero
- Photo strip shows 2 columns of portrait images
- Testimonials show single column
- "How it works" and "Features" sections have 1rem horizontal padding

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Landing.jsx frontend/src/pages/Landing.css
git commit -m "style: landing mobile — stats 2x2, photo strip 2-col, section padding, testimonials"
```

---

## Task 4: Create Dashboard.css + remove isMobile from Dashboard.jsx

**Files:**
- Create: `frontend/src/pages/Dashboard.css`
- Modify: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Create Dashboard.css**

Create `frontend/src/pages/Dashboard.css` with this full content:

```css
/* Dashboard responsive layout — replaces all isMobile JS logic */

.dash-nav { height: 52px; padding: 0 36px; }
.dash-hero { padding: 52px 36px 44px; }
.dash-hero-title { font-size: 48px; }

.dash-stats {
  display: flex;
  max-width: 600px;
  flex-direction: row;
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(255,255,255,0.02);
}
.dash-stat { flex: 1; padding: 16px 20px; border-right: 1px solid rgba(255,255,255,0.06); }
.dash-stat:last-child { border-right: none; }

.dash-main { padding: 0 36px 60px; display: grid; gap: 44px; }

.dash-cta-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: row;
  gap: 24px;
}
.dash-cta-btn { width: auto; }

.dash-recs-grid   { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.dash-trending-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.dash-dna-grid    { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
.dash-trips-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.dash-search-input { flex: 1; min-width: 180px; }

@media (max-width: 640px) {
  .dash-nav { height: 52px; padding: 0 16px; }
  .dash-hero { padding: 28px 16px 32px; }
  .dash-hero-title { font-size: 28px; }

  .dash-stats { flex-direction: column; max-width: 100%; }
  .dash-stat { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .dash-stat:last-child { border-bottom: none; }

  .dash-main { padding: 0 16px 60px; }

  .dash-cta-card { flex-direction: column; align-items: flex-start; }
  .dash-cta-btn { width: 100%; text-align: center; }

  .dash-recs-grid   { grid-template-columns: 1fr; }
  .dash-trending-grid { grid-template-columns: 1fr 1fr; }
  .dash-dna-grid    { grid-template-columns: 1fr; }
  .dash-trips-grid  { grid-template-columns: 1fr; }
  .dash-search-input { min-width: 0; }
}
```

- [ ] **Step 2: Import Dashboard.css in Dashboard.jsx**

At the top of `Dashboard.jsx`, add after the existing imports:

```jsx
import './Dashboard.css';
```

- [ ] **Step 3: Remove isMobile state and effect**

Find and remove these lines (lines 137–142):

```jsx
const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
useEffect(() => {
  const handler = () => setIsMobile(window.innerWidth < 768);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);
```

Delete them entirely.

- [ ] **Step 4: Update nav — remove isMobile ternary**

Find (line ~239):
```jsx
<nav style={{ ...s.nav, padding: isMobile ? '12px 16px' : '14px 36px' }}>
```
Replace with:
```jsx
<nav style={s.nav} className="dash-nav">
```
Also remove `padding` from `s.nav` in the `s` object definition (~line 199) since `.dash-nav` now owns it:
```js
nav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(16px)' },
```

- [ ] **Step 5: Update hero div — remove isMobile ternary**

Find (line ~253):
```jsx
<div style={{ padding: isMobile ? '28px 16px 32px' : '52px 36px 44px', position: 'relative', overflow: 'hidden' }}>
```
Replace with:
```jsx
<div className="dash-hero" style={{ position: 'relative', overflow: 'hidden' }}>
```

- [ ] **Step 6: Update hero title — remove isMobile fontSize**

Find (line ~262):
```jsx
<div style={{ ...s.heroTitle, fontSize: isMobile ? 28 : 48 }}>
```
Replace with:
```jsx
<div style={s.heroTitle} className="dash-hero-title">
```
Also remove `fontSize: 48` from `s.heroTitle` in the `s` object since `.dash-hero-title` now owns it:
```js
heroTitle: { fontFamily: "'Fraunces', serif", fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.025em', marginBottom: 6 },
```

- [ ] **Step 7: Update stats strip — remove isMobile ternaries**

Find (line ~285–303), the entire stats block. Replace:
```jsx
<div style={{ ...s.statsStrip, maxWidth: isMobile ? '100%' : 600, flexDirection: isMobile ? 'column' : 'row' }}>
  <div style={{ ...s.stat, borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
    <div style={{ ...s.statNum, color: '#00d4aa' }}>{totalTrips}</div>
    <div style={s.statLabel}>Itineraries</div>
  </div>
  <div style={{ ...s.stat, borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
    <div style={s.statNum}>{countryCount}</div>
    <div style={s.statLabel}>Countries</div>
  </div>
  <div style={{ ...s.stat, borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)', borderBottom: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
    <div style={s.statNum}>{totalDays}</div>
    <div style={s.statLabel}>Days planned</div>
  </div>
  <div style={{ ...s.stat, borderRight: 'none', borderBottom: 'none' }}>
    <div style={{ ...s.statNum, fontSize: sinceLastTrip ? 18 : 28 }}>{sinceLastTrip || '–'}</div>
    <div style={s.statLabel}>Since last trip</div>
  </div>
</div>
```
With:
```jsx
<div style={s.statsStrip} className="dash-stats">
  <div style={s.stat} className="dash-stat">
    <div style={{ ...s.statNum, color: '#00d4aa' }}>{totalTrips}</div>
    <div style={s.statLabel}>Itineraries</div>
  </div>
  <div style={s.stat} className="dash-stat">
    <div style={s.statNum}>{countryCount}</div>
    <div style={s.statLabel}>Countries</div>
  </div>
  <div style={s.stat} className="dash-stat">
    <div style={s.statNum}>{totalDays}</div>
    <div style={s.statLabel}>Days planned</div>
  </div>
  <div style={s.stat} className="dash-stat">
    <div style={{ ...s.statNum, fontSize: sinceLastTrip ? 18 : 28 }}>{sinceLastTrip || '–'}</div>
    <div style={s.statLabel}>Since last trip</div>
  </div>
</div>
```
Also remove `maxWidth: 600` from `s.statsStrip` since `.dash-stats` owns it, and remove `borderRight` from `s.stat` since `.dash-stat` owns it:
```js
statsStrip: { display: 'flex', gap: 0, overflow: 'hidden' },
stat: { flex: 1, padding: '16px 20px' },
```

- [ ] **Step 8: Update main container padding**

Find (line ~306):
```jsx
<div style={{ ...s.main, padding: isMobile ? '0 16px 60px' : '0 36px 60px' }}>
```
Replace with:
```jsx
<div style={s.main} className="dash-main">
```
Remove `padding` from `s.main`:
```js
main: { display: 'grid', gap: 44 },
```

- [ ] **Step 9: Update CTA card — remove isMobile ternaries**

Find the "Ready for next adventure" card (line ~315). Replace the outer div style:
```jsx
<div style={{ background: 'linear-gradient(135deg,rgba(0,212,170,0.08),rgba(96,165,250,0.05))', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20, padding: '28px 32px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 24, position: 'relative', overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>
```
With:
```jsx
<div className="dash-cta-card" style={{ background: 'linear-gradient(135deg,rgba(0,212,170,0.08),rgba(96,165,250,0.05))', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 20, padding: '28px 32px', position: 'relative', overflow: 'hidden' }}>
```
And the CTA button (line ~335), replace `width: isMobile ? '100%' : 'auto'`:
```jsx
<button
  onClick={() => navigate('/plan')}
  className="dash-cta-btn"
  style={{ padding: '14px 28px', background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,212,170,0.3)', flexShrink: 0, position: 'relative', zIndex: 1, textAlign: 'center' }}
>
```

- [ ] **Step 10: Update recommendations grid**

Find (line ~350):
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 14 }}>
```
Replace with:
```jsx
<div className="dash-recs-grid">
```

- [ ] **Step 11: Update trending grid**

Find (line ~395):
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
```
Replace with:
```jsx
<div className="dash-trending-grid">
```

- [ ] **Step 12: Update Travel DNA grid**

Find (line ~433):
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 14 }}>
```
Replace with:
```jsx
<div className="dash-dna-grid">
```

- [ ] **Step 13: Update search input min-width**

Find (line ~519):
```jsx
<div style={{ flex: 1, minWidth: isMobile ? 0 : 180, display: 'flex', ...
```
Replace with:
```jsx
<div className="dash-search-input" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '8px 12px' }}>
```

- [ ] **Step 14: Update past trips grid**

Find (line ~590):
```jsx
<div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px,1fr))', gap: 14 }}>
```
Replace with:
```jsx
<div className="dash-trips-grid">
```

- [ ] **Step 15: Verify build**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`. If errors, check that `isMobile` no longer appears anywhere in Dashboard.jsx:
```bash
grep -n "isMobile" frontend/src/pages/Dashboard.jsx
```
Expected: no output.

- [ ] **Step 16: Visual check at 375px**

In DevTools at 375px verify:
- Nav padding is tighter (12px 16px)
- Hero title is 28px
- Stats show as column (stacked), each separated by bottom border
- CTA card button is full-width
- Recommendations: 1 column
- Trending: 2 columns
- Travel DNA: 1 column
- Past trips: 1 column

- [ ] **Step 17: Commit**

```bash
git add frontend/src/pages/Dashboard.css frontend/src/pages/Dashboard.jsx
git commit -m "style: replace isMobile JS flag with Dashboard.css responsive classes"
```

---

## Task 5: Explore page — nav, scrollable tabs, mobile grids

**Files:**
- Modify: `frontend/src/pages/ExplorePage.jsx`

- [ ] **Step 1: Remove Google Fonts @import**

In `ExplorePage.jsx`, find the `<style>` block (line ~125):
```jsx
<style>{`
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,400&display=swap');
  * { box-sizing: border-box; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
`}</style>
```
Replace with:
```jsx
<style>{`
  * { box-sizing: border-box; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @media (max-width: 640px) {
    .explore-nav { padding: 0 1rem !important; }
    .explore-hero { padding: 2rem 1rem 1.5rem !important; }
    .explore-country-grid { grid-template-columns: 1fr !important; }
    .explore-trending-grid { grid-template-columns: 1fr !important; }
  }
`}</style>
```

- [ ] **Step 2: Update nav — add className and reduce right-side gap on mobile**

Find the `<nav>` element (line ~132):
```jsx
<nav style={{ height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2.5rem', background: navy2, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, zIndex: 100 }}>
```
Replace with:
```jsx
<nav className="explore-nav" style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2.5rem', background: navy2, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(20px)' }}>
```
The nav links (`Home`, `Pricing`) hide below 768px via the media query in the style block. Add to the `<style>` block:
```jsx
  @media (max-width: 768px) {
    .explore-nav-links { display: none !important; }
  }
```
And add `className="explore-nav-links"` to the links div (line ~137):
```jsx
<div className="explore-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
```

- [ ] **Step 3: Add className to hero section**

Find the hero div (line ~147):
```jsx
<div style={{ padding: '3rem 2rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
```
Replace with:
```jsx
<div className="explore-hero" style={{ padding: '3rem 2rem 2rem', maxWidth: 1200, margin: '0 auto' }}>
```

- [ ] **Step 4: Make continent tabs scrollable**

Find the continent tabs row. It currently renders continent buttons in a flex div. Find the wrapping div that contains the continent filter buttons and update it to be horizontally scrollable. Look for the div rendering `CONTINENTS.map(...)` buttons (around line 160–180 in the JSX). The container div should be:

```jsx
<div style={{
  display: 'flex', gap: 8, padding: '0 2rem 1.5rem',
  maxWidth: 1200, margin: '0 auto',
  overflowX: 'auto', WebkitOverflowScrolling: 'touch',
  msOverflowStyle: 'none', scrollbarWidth: 'none',
}}>
```
And each continent button should add `flexShrink: 0` and `whiteSpace: 'nowrap'` to prevent wrapping:
```jsx
<div
  key={c.id}
  onClick={() => handleContinent(c.id)}
  style={{
    flexShrink: 0, whiteSpace: 'nowrap',
    padding: '8px 16px', borderRadius: 100, cursor: 'pointer',
    fontSize: '0.875rem', fontWeight: 600,
    border: `1px solid ${activeContinent === c.id ? tealBorder : border}`,
    background: activeContinent === c.id ? tealGlow : w08,
    color: activeContinent === c.id ? teal : w40,
    transition: 'all 0.2s',
  }}
>
  {c.emoji} {c.name}
</div>
```

- [ ] **Step 5: Add className to country grid**

Find the country cards grid div (the one rendering `countries.map(...)`). It uses `gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'`. Add `className="explore-country-grid"`:
```jsx
<div className="explore-country-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, padding: '0 2rem', maxWidth: 1200, margin: '0 auto 3rem' }}>
```

- [ ] **Step 6: Add className to trending grid**

Find the trending destinations row (the one rendering `TRENDING.map(...)`). Add `className="explore-trending-grid"`:
```jsx
<div className="explore-trending-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, padding: '0 2rem', maxWidth: 1200, margin: '0 auto 3rem' }}>
```

- [ ] **Step 7: Verify build**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 8: Visual check at 375px**

At 375px verify:
- Nav links (Home, Pricing) are hidden
- Continent tabs scroll horizontally without wrapping
- Country cards show in single column
- Hero has 1rem horizontal padding

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/ExplorePage.jsx
git commit -m "style: explore page — scrollable continent tabs, mobile grids, remove font import"
```

---

## Task 6: Pricing page — shared nav + mobile grids

**Files:**
- Modify: `frontend/src/pages/Pricing.jsx`
- Modify: `frontend/src/pages/Pricing.css`

- [ ] **Step 1: Import Pricing.css in Pricing.jsx**

At the top of `Pricing.jsx`, add:
```jsx
import './Pricing.css';
```

- [ ] **Step 2: Update nav to shared pattern in Pricing.jsx**

Find the current nav (line ~117):
```jsx
<nav style={s.nav}>
  <button style={s.backBtn} onClick={() => navigate('/')}>
    <div style={s.logoMark}>W</div>
    WanderZenAI
  </button>
</nav>
```
Replace with:
```jsx
<nav className="pricing-nav" style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--desktop-pad)', background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 100 }}>
  <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0a0f1e', boxShadow: '0 0 12px rgba(0,212,170,0.3)' }}>W</div>
    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
  </a>
  <button onClick={() => navigate('/plan')} style={{ padding: '6px 14px', borderRadius: 8, background: '#00d4aa', color: '#0a0f1e', border: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
    Plan trip →
  </button>
</nav>
```

- [ ] **Step 3: Add classNames to pricing cards grid and FAQ grid**

Find the plans grid div (line ~164):
```jsx
<div style={s.grid}>
```
Replace with:
```jsx
<div style={s.grid} className="pricing-cards-grid">
```

Find the FAQ grid div (line ~203):
```jsx
<div style={s.faqGrid}>
```
Replace with:
```jsx
<div style={s.faqGrid} className="pricing-faq-grid">
```

- [ ] **Step 4: Add mobile rules to Pricing.css**

The current `Pricing.css` has a `@media (max-width: 640px)` block with `.pricing-grid` and `.pricing-faq-grid` — but those class names don't match what Pricing.jsx actually renders. Replace the entire `Pricing.css` content with:

```css
/* Pricing page responsive overrides */

.pricing-nav { padding: 0 var(--desktop-pad, 2.5rem) !important; }

.pricing-cards-grid { align-items: start; }

@media (max-width: 640px) {
  .pricing-nav { padding: 0 var(--mobile-pad, 1rem) !important; }
  .pricing-cards-grid { grid-template-columns: 1fr !important; }
  .pricing-faq-grid { grid-template-columns: 1fr !important; }
}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Visual check at 375px**

At 375px verify:
- Nav shows logo left + "Plan trip →" right, no overflow
- Pricing cards stack in single column
- FAQ items stack in single column
- Card inner content doesn't overflow at 375px

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Pricing.jsx frontend/src/pages/Pricing.css
git commit -m "style: pricing — shared nav pattern, single-column mobile grids"
```

---

## Task 7: PlanTrip — shared nav + mobile progress bar

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`
- Modify: `frontend/src/pages/PlanTrip.css`

- [ ] **Step 1: Remove font @import from sharedStyles in PlanTrip.jsx**

Find `sharedStyles` (line ~271):
```jsx
const sharedStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,700;1,9..144,400&display=swap');
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
  select option { background: #111827; color: #fff; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
```
Replace with:
```jsx
const sharedStyles = `
  input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
  input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); }
  select option { background: #111827; color: #fff; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
```

- [ ] **Step 2: Replace nav in VenueSelection step (step === 1 branch)**

Find the nav inside the `step === 1` early return (line ~284):
```jsx
<nav style={s.nav}>
  <button style={s.backBtn} onClick={() => navigate('/')}>
    <div style={s.logoMark}>W</div>
    WanderZenAI
  </button>
</nav>
```
Replace with:
```jsx
<nav style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--desktop-pad, 2.5rem)', background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="plantrip-nav">
  <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0a0f1e' }}>W</div>
    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
  </a>
  <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>✕ Exit</button>
</nav>
```

- [ ] **Step 3: Replace nav in main return branch (line ~317)**

Find the second nav (line ~317), same `s.nav` pattern. Replace with identical nav markup from Step 2:
```jsx
<nav style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--desktop-pad, 2.5rem)', background: 'rgba(10,15,30,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="plantrip-nav">
  <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
    <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#0a0f1e' }}>W</div>
    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>WanderZenAI</span>
  </a>
  <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>✕ Exit</button>
</nav>
```

- [ ] **Step 4: Add mobile rules to PlanTrip.css**

The current `PlanTrip.css` ends with a `@media (max-width: 640px)` block. Append these rules to that block:

```css
@media (max-width: 640px) {
  .pt-card { padding: 1.5rem; }
  .pt-currency-grid { grid-template-columns: repeat(2, 1fr); }
  .pt-pace-grid { grid-template-columns: 1fr; }
  .pt-choice-grid { grid-template-columns: 1fr; }
  /* Mobile nav padding */
  .plantrip-nav { padding: 0 var(--mobile-pad, 1rem) !important; }
  /* Hide step labels in progress bar, show only segments */
  .plantrip-progress__seg { /* segments already defined — no change needed */ }
}
```

- [ ] **Step 5: Verify build**

```bash
cd frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Visual check at 375px**

At 375px verify:
- Nav shows logo left + "✕ Exit" right on both the VenueSelection step and the main form
- Nav does not overflow or clip
- Form card padding is 1.5rem on mobile (feels spacious, not cramped)
- Progress bar segments are visible and not overlapping

- [ ] **Step 7: Final full-site check at 375px**

Open each page in DevTools at 375px and confirm:
- `/` (Landing): aurora hero, full-width CTAs, 2×2 stats, 2-col photo strip, single-col testimonials
- `/dashboard` (Dashboard): stacked stats, single-col grids, full-width CTA button
- `/explore` (Explore): scrollable continent tabs, single-col country cards
- `/pricing` (Pricing): single-col plan cards, single-col FAQ
- `/plan` (PlanTrip): shared nav, form fields not overflowing

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/PlanTrip.jsx frontend/src/pages/PlanTrip.css
git commit -m "style: plantrip — shared nav pattern, mobile padding, remove font import"
```

---

## Done

All 7 tasks complete. The full verification checklist is Step 7 of Task 7. Every page now uses:
- Consistent `640px` / `768px` breakpoints
- `16px` horizontal padding on mobile
- `52px` nav height with glass morphism, consistent across all pages
- CSS media queries only — no JS mobile detection remaining
