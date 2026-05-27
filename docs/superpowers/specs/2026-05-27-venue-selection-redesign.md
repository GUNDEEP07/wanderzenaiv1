# VenueSelection Redesign — Responsive Two-Panel Layout

**Date:** 2026-05-27  
**Status:** Approved

---

## Problem

The current VenueSelection page dumps all content in a single scrollable column: destination insights (weather, crowd level, best months, 5 "things to do" cards with full prose), then the activity emoji grid, then venues. This is visually cluttered, the AI-suggested activities are not selectable, and the layout ignores screen size.

---

## Solution

Responsive two-panel layout where AI suggestions and the activity grid share a single selection state.

- **Desktop (≥768px):** Side-by-side split — left panel (40%) shows compact insights badges + selectable AI-suggested activities; right panel (60%) shows the activity emoji grid + Foursquare venues for the active activity.
- **Mobile (<768px):** Stacked vertical — compact insights strip at the top, AI picks as a horizontally scrollable chip row, then an "OR BROWSE ALL" divider, then the activity grid + venues below.

---

## Layout Spec

### Desktop left panel (40%)

1. **Header row** — destination name + date range
2. **Insight badges** — three compact pills: weather (temp + condition), crowd level, best months. No prose.
3. **AI suggestions list** — the `thingsToDo` array from the insights API, rendered as selectable cards. Each card shows: emoji, activity name, one-line reason. Selected state matches the teal border/background used elsewhere. Tapping a card adds the activity to `selectedActivities` (same state as the emoji grid).

### Desktop right panel (60%)

1. **"OR BROWSE ALL ACTIVITIES" label**
2. **ActivityGrid** — existing 3-col emoji grid, unchanged behaviour
3. **ActivityTabs + VenuesList** — appear below the grid when an activity is active, same as today

### Mobile layout (stacked)

1. **Step header** — same as today
2. **Compact insights strip** — teal-bordered card, destination + date, three inline badges (same as desktop left panel header). No expand/collapse needed — it's already compact.
3. **AI picks chip row** — horizontal scroll, one chip per `thingsToDo` item (emoji + name). Selected chip gets teal border. Same shared state.
4. **"OR BROWSE ALL" divider** — thin rule with label
5. **ActivityGrid** — 3-col, same as today
6. **ActivityTabs + VenuesList** — below grid, same as today

---

## State & Data Flow

### Unified selection state

`selectedActivities` in `VenueSelection` is the single source of truth. Both the AI suggestion cards/chips and the `ActivityGrid` read from and write to the same state key (`destKey → string[]`). There is no separate "AI-selected" vs "grid-selected" distinction.

### AI suggestion → activity mapping

`thingsToDo` items from the insights API have a `name` and `category` field. When a user selects an AI suggestion, the `name` string is added to `selectedActivities` exactly as if they tapped an emoji button. If the name matches a Foursquare-queryable category, a venue fetch fires automatically (same `fetchActivityContent` logic).

### Insights data surface

Only these fields from the insights response are displayed:
- `weather` → weather badge
- `crowdLevel` → crowd badge  
- `bestMonths[0]` + `bestMonths[1]` → best months badge
- `thingsToDo[]` → AI suggestion cards/chips

Hidden (removed from UI): `whyThisMonth`, `seasonalHighlights`, `travelTip`. These are still returned by the API and cached — just not rendered.

---

## Components Changed

| File | Change |
|---|---|
| `VenueSelection.jsx` | Full layout restructure — responsive split via CSS class, pass `onActivityToggle` + `selectedActivities` to both panels |
| `DestinationInsightsPanel.jsx` | Rewrite render: compact badges + selectable `thingsToDo` cards. Accept `selectedActivities` + `onActivityToggle` props. Remove all prose cards. |
| `venueselection-redesign.css` | Add `.venue-split` (flex row on desktop, column on mobile), `.venue-panel-left`, `.venue-panel-right`, `.ai-suggestion-card`, `.ai-chip-row`, `.insights-strip` |
| `ActivityGrid.jsx` | No logic changes — only remove the wrapper label "OR BROWSE ALL ACTIVITIES" since VenueSelection now renders it contextually |

No new files. No changes to `ActivityTabs`, `VenuesList`, `YouTubeCarousel`, or `CustomInterestModal`.

---

## Responsive Breakpoint

```css
/* Desktop: side by side */
@media (min-width: 768px) {
  .venue-split { display: flex; flex-direction: row; gap: 16px; }
  .venue-panel-left { width: 40%; }
  .venue-panel-right { flex: 1; }
}

/* Mobile: stacked */
@media (max-width: 767px) {
  .venue-split { display: flex; flex-direction: column; gap: 12px; }
}
```

---

## Edge Cases

- **No insights yet (loading):** Left panel (desktop) / strip (mobile) shows a skeleton/spinner. AI suggestions section is hidden. ActivityGrid is still fully usable.
- **Insights failed:** Left panel shows a minimal "Could not load insights" message in place of badges + suggestions. Right panel unaffected.
- **No `startDate` set:** `DestinationInsightsPanel` does not render (existing guard). Left panel (desktop) shows only the "Browse all" heading; no left panel rendered. Mobile shows no strip.
- **AI suggestion name has no Foursquare match:** Activity is added to `selectedActivities` but `fetchActivityContent` returns an empty venues array. VenuesList renders its empty state ("No venues found").

---

## Out of Scope

- YouTube carousel — kept as-is
- Multi-destination tab switcher — kept as-is
- CustomInterestModal — kept as-is
- Any changes to the insights Lambda or DB schema
