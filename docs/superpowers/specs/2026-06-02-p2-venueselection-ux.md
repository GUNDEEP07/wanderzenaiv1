# P2: VenueSelection UX — Deselect, Card Expand, Remove Duplicate Chips

**Date:** 2026-06-02
**Status:** Approved, ready for implementation
**Scope:** ActivityTabs.jsx, DestinationInsightsPanel.jsx, VenueSelection.jsx

---

## Fix 1: Deselect activities from ActivityTabs (centre screen)

**File:** `frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx`

**Problem:** ActivityTabs renders selected activities as tabs but has no remove button. Users must go back to the ActivityGrid or left panel to deselect.

**Changes:**
1. Add `onActivityToggle` prop to `ActivityTabs`
2. Render a `×` button inside each tab that calls `onActivityToggle(activity)`

New tab render (replace the existing `<button>` JSX inside the map):

```jsx
<button
  key={activity}
  style={{
    ...s.tab(isActive),
    ...(isHovered && !isActive && s.tabHover),
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }}
  onClick={() => onTabChange(activity)}
  onMouseEnter={() => setHoveredTab(activity)}
  onMouseLeave={() => setHoveredTab(null)}
>
  <span>{ACTIVITY_EMOJIS[activity] || '📍'}</span>
  {activity}
  <span
    onClick={(e) => { e.stopPropagation(); onActivityToggle(activity); }}
    style={{
      marginLeft: 2, fontSize: 10, opacity: 0.5, cursor: 'pointer',
      lineHeight: 1, padding: '1px 3px', borderRadius: 3,
      background: 'rgba(255,255,255,0.08)',
    }}
    title={`Remove ${activity}`}
  >
    ×
  </span>
</button>
```

**VenueSelection.jsx:** Pass the new prop when rendering `ActivityTabs`:

Find:
```jsx
<ActivityTabs
  selectedActivities={currentActivities}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

Replace with:
```jsx
<ActivityTabs
  selectedActivities={currentActivities}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  onActivityToggle={handleActivityToggle}
/>
```

---

## Fix 2: Click anywhere on left-panel card to expand

**File:** `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`

**Problem:** Cards in the left panel only expand when clicking the `▾` chevron. The card header is not clickable.

**Change:** Add `onClick` to the `item-card__header` div (not the outer wrapper, to avoid conflicts with the day-picker expanded area). This makes the header row — name, emoji, reason text — clickable to expand/collapse.

Find the `item-card__header` div:
```jsx
<div className="item-card__header">
  <div className="item-card__icon">{thing.emoji}</div>
  <div className="item-card__text">
```

Replace the outer `<div className="item-card__header">` opening tag with:
```jsx
<div className="item-card__header" onClick={(e) => handleChevronClick(e, thing.name)} style={{ cursor: 'pointer' }}>
```

The `handleChevronClick` already calls `e.stopPropagation()` — the `+` button and chevron inside the header will still handle their own clicks without conflict since they call `e.stopPropagation()` too.

---

## Fix 3: Remove duplicate AI Picks chips from right panel

**File:** `frontend/src/components/plantrip/VenueSelection.jsx`

**Problem:** The "AI Picks — tap to add" horizontal scroll chips at the top of the right panel duplicate the same suggestions already shown as full cards in the left panel. The chips lack day pickers and context, causing user confusion.

**Changes:**

### 3a. Remove aiSuggestions state

Find and delete:
```jsx
const [aiSuggestions, setAiSuggestions] = useState([]);
```

### 3b. Remove the AI Picks chips block from the right panel

Find and delete the entire block (the one starting with `{aiSuggestions.length > 0 && (`):

```jsx
{aiSuggestions.length > 0 && (
  <div className="venue-picks-scroll">
    <div className="venue-picks-label">
      <span className="venue-picks-label__text">AI Picks — tap to add</span>
      <div className="venue-picks-label__line"></div>
    </div>
    <div className="venue-chips">
      {aiSuggestions.map((thing, idx) => (
        <button
          key={idx}
          className={`venue-chip--teal${currentActivities.includes(thing.name) ? ' venue-chip--selected' : ''}`}
          onClick={() => handleActivityToggle(thing.name)}
        >
          {thing.emoji} {thing.name}
        </button>
      ))}
    </div>
  </div>
)}
```

### 3c. Remove onInsightsLoaded prop from DestinationInsightsPanel usage

Find:
```jsx
<DestinationInsightsPanel
  destination={destination}
  travelStyles={travelStyles}
  startDate={startDate}
  endDate={endDate}
  selectedActivities={currentActivities}
  onActivityToggle={handleActivityToggle}
  onInsightsLoaded={setAiSuggestions}
  onDayAssign={handleDayAssign}
  days={days}
/>
```

Replace with:
```jsx
<DestinationInsightsPanel
  destination={destination}
  travelStyles={travelStyles}
  startDate={startDate}
  endDate={endDate}
  selectedActivities={currentActivities}
  onActivityToggle={handleActivityToggle}
  onDayAssign={handleDayAssign}
  days={days}
/>
```

---

## Fix 4: Venue images + Google Maps links in left-panel cards

**File:** `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`

The `insights.thingsToDo` data already contains `unsplashKeyword` (e.g. `"tegallalang rice terraces bali"`) and `name` + destination context. We can add images and map links to each expanded card without any new API keys.

### 4a. Venue image using unsplashKeyword

Add an image at the top of the expanded detail block (inside the `{(isOpen || isAdded) && (...)}` block, before the category colour bar):

```jsx
{thing.unsplashKeyword && (
  <img
    src={`https://source.unsplash.com/320x200/?${encodeURIComponent(thing.unsplashKeyword)}`}
    alt={thing.name}
    loading="lazy"
    style={{
      width: '100%', height: 120, objectFit: 'cover',
      borderRadius: 8, marginBottom: 10, display: 'block',
    }}
    onError={e => { e.target.style.display = 'none'; }}
  />
)}
```

Note: `source.unsplash.com` redirects to a relevant photo based on the keyword. The `onError` handler hides the image if Unsplash fails (graceful degradation).

### 4b. Google Maps link

Add a "View on map →" link at the bottom of the expanded detail block, after the category tag and before the day picker. Use a Google Maps search URL — no API key needed:

```jsx
<a
  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(thing.name + ' ' + destName)}`}
  target="_blank"
  rel="noopener noreferrer"
  onClick={e => e.stopPropagation()}
  style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    fontSize: 11, color: '#60a5fa', textDecoration: 'none',
    marginBottom: 10,
  }}
>
  📍 View on Google Maps →
</a>
```

---

## Out of scope

- Day assignment hint overlay (day picker already inline in left panel cards after Fix 2)
