# WanderZenAI — Mobile-First Dark UI Redesign

**Date:** 2026-06-01  
**Status:** Approved, ready for implementation  
**Scope:** All frontend pages — mobile responsiveness + full dark aurora glass design system

---

## Goal

Mobile is the primary interface. Fix all broken and inconsistent mobile layouts across every page, and apply a unified dark aurora glass design language throughout. No hamburger menu. No JS-based mobile detection. CSS media queries only.

---

## Design Decisions

**Theme:** Full dark (Option A)  
- Background: `#0a0f1e` everywhere  
- Aurora ambient glows on hero sections (teal + purple radial gradients with blur)  
- Glass morphism nav: `backdrop-filter: blur(20px)`, semi-transparent background  
- Clean dark cards in content sections — no competing aurora effects below the fold  

**Philosophy:** "Aurora where they look. Clean where they act."  
- Landing hero and nav: dramatic aurora treatment  
- Dashboard, forms, explore cards, pricing: clean readable dark cards  

---

## Breakpoints

Consistent across every file — no exceptions:

| Name | Value | Behaviour |
|---|---|---|
| Mobile | `< 640px` | Single column, full-width buttons, 1rem horizontal padding |
| Tablet | `640px – 768px` | 2-column grids, 2rem padding |
| Desktop | `≥ 768px` | Nav links visible, 3-column grids, 2.5rem padding |

---

## Global Changes (`index.css`)

- CSS custom properties for padding tokens: `--mobile-pad: 1rem`, `--tablet-pad: 2rem`, `--desktop-pad: 2.5rem`
- Google Fonts already loaded here (done) — remove any remaining inline `@import` from page files
- ExplorePage.jsx has a remaining inline `@import` to remove

---

## Page-by-Page Spec

### Nav — Shared pattern, every page

```
[Logo mark + wordmark]          [Plan trip →]
```

- Height: 52px, sticky top
- `background: rgba(10,15,30,0.92)`, `backdrop-filter: blur(20px)`
- `border-bottom: 1px solid rgba(255,255,255,0.06)`
- Logo mark: 24×24, teal gradient, subtle glow shadow
- CTA button: teal, 7px border-radius, `font-weight: 800`
- Nav links (Explore, How it works, Pricing, Agencies): hidden below 768px, flex row above
- Dashboard variant: avatar + first name replaces CTA on right
- PlanTrip form variant: "✕ Exit" replaces CTA on right

### Landing Page (`Landing.jsx` + `Landing.css`)

**Hero (keep aurora):**
- Two ambient glows: teal top-left, purple top-right — `filter: blur(24px)`
- Eyebrow pill with pulsing dot animation
- h1: gradient text `linear-gradient(135deg, #fff 20%, rgba(0,212,170,0.7) 100%)`
- Primary CTA: full-width below 640px, `min-height: 52px`
- Ghost CTA: full-width below 640px, stacked below primary
- Hero padding: `padding: 5rem 1rem 3rem` on mobile (currently `8rem 2rem 4rem`)

**Stats strip:**
- Below 640px: 2×2 grid (not 4-column horizontal)

**Destination tags:**
- Already hidden below 480px ✓

**Photo strip:**
- Below 640px: 2-column grid (currently 6-column — unreadable at 375px)

**How it works / Steps:**
- Gap already fixed to 20px ✓
- Below 640px: single column ✓

**Features grid:**
- Gap already fixed to 20px ✓
- Below 640px: single column (minmax already handles this at 320px min)

**Testimonials:**
- `minmax(300px, 1fr)` → change to `minmax(260px, 1fr)` OR add explicit single column at 640px

**Pricing cards on landing:**
- Single column below 640px ✓ (auto-fit handles this)

**Section padding:**
- `.section { padding: 7rem 2rem }` → add `@media (max-width: 640px) { padding: 4rem 1rem }`

**Footer:**
- Already stacks on mobile ✓

### Dashboard (`Dashboard.jsx`)

- Remove all `isMobile` useState/useEffect/conditional style logic
- Replace with CSS classes + media queries in a `Dashboard.css` file (new)
- Hero section: single subtle teal ambient glow (not full aurora)
- Stats strip: keep 4-column, fix border logic with CSS (not JS conditionals)
- "Ready for next adventure" card: full-width button below 640px
- Recommendations grid: single column below 640px ✓ (already done via isMobile — just move to CSS)
- Trending grid: single column below 640px
- Travel DNA grid: single column below 640px (currently stays 3-col on mobile)
- Past trips grid: single column below 640px ✓ (already done via isMobile — move to CSS)
- Search/filter bar: stacks vertically below 640px

### Explore Page (`ExplorePage.jsx`)

- Remove inline `@import` Google Fonts
- Nav: apply shared nav pattern (currently has its own 2.5rem padding, no mobile collapse)
- Continent tabs: `overflow-x: auto`, `-webkit-overflow-scrolling: touch`, `white-space: nowrap`, `flex-shrink: 0` on each tab
- Country cards grid: `minmax(280px, 1fr)` → single column below 640px
- Trending row: single column below 640px
- Hero padding: 1rem horizontal on mobile

### Pricing Page (`Pricing.jsx`)

- Move all layout styles from inline `s` object → `Pricing.css` (file exists but unused)
- Nav: apply shared nav pattern (currently back-button only with 2.5rem padding)
- Pricing cards grid: already `minmax(300px, 1fr)` auto-fit — add explicit single column at 640px + reduce inner padding
- FAQ grid: `minmax(340px, 1fr)` → single column below 640px (currently overflows entirely)
- Inner content padding: 1.5rem on mobile (currently 2.5rem)

### Plan Trip Form (`PlanTrip.jsx` + `PlanTrip.css`)

- Nav: apply shared nav pattern
- Progress bar step labels: hide text labels below 640px, show only step dots + current step name
- Currency grid: already 2-col at 640px ✓
- Pace grid: already single col at 640px ✓
- Choice grids: already single col at 640px ✓
- Card padding: already 1.5rem at 640px ✓
- Main alignment: already max-width 680px centered ✓

### Login / Signup (`Login.jsx`, `Signup.jsx`)

- No layout changes needed — narrow centered form works on all widths ✓
- Background already unified to `#0a0f1e` ✓
- Font imports already removed ✓

---

## Implementation Order

1. **`index.css`** — add CSS custom property tokens
2. **`Landing.css`** — mobile hero, stats grid, photo strip, section padding, testimonials
3. **`Dashboard.css`** (new) — extract all mobile styles, remove isMobile JS
4. **`Dashboard.jsx`** — remove isMobile flag and all conditional inline style logic
5. **`ExplorePage.jsx`** — nav, continent tabs, cards, remove font import
6. **`Pricing.jsx` + `Pricing.css`** — move layout to CSS, nav, mobile grids
7. **`PlanTrip.jsx`** — nav, progress bar mobile treatment

---

## Out of Scope

- Login / Signup pages (already fine)
- ItineraryView page (not part of this sprint)
- Settings / Onboarding pages (not part of this sprint)
- Any new features — this is layout and styling only
