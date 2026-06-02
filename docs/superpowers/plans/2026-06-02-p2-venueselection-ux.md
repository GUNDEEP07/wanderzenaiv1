# P2: VenueSelection UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four VenueSelection UX issues: add × deselect to activity tabs, make left-panel cards expand on header click, remove duplicate AI chips from the right panel, and add venue images + Google Maps links to each expanded card.

**Architecture:** Three independent file changes — ActivityTabs.jsx gains a new `onActivityToggle` prop and renders a × button per tab; DestinationInsightsPanel.jsx gets a clickable card header, Unsplash image, and Google Maps link in the expanded view; VenueSelection.jsx removes the duplicate `aiSuggestions` state and the AI Picks chips block. No new components or routes.

**Tech Stack:** React 18, Vite, Unsplash source URL (no API key), Google Maps search URL (no API key)

---

## File Map

| File | Action | What changes |
|---|---|---|
| `frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx` | Modify | Add `onActivityToggle` prop; render × button on each tab |
| `frontend/src/components/plantrip/VenueSelection.jsx` | Modify | Pass `onActivityToggle` to ActivityTabs; remove `aiSuggestions` state, chips block, `onInsightsLoaded` |
| `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx` | Modify | Clickable card header; Unsplash image + Google Maps link in expanded view |

---

## Task 1: ActivityTabs — × deselect button + VenueSelection prop pass

**Files:**
- Modify: `frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx`
- Modify: `frontend/src/components/plantrip/VenueSelection.jsx`

- [ ] **Step 1: Add onActivityToggle prop to ActivityTabs and render × per tab**

Open `frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx`.

Find the function signature:
```jsx
export function ActivityTabs({ selectedActivities, activeTab, onTabChange }) {
```

Replace with:
```jsx
export function ActivityTabs({ selectedActivities, activeTab, onTabChange, onActivityToggle }) {
```

Find the `<button>` returned inside the `.map()`:
```jsx
          <button
            key={activity}
            style={{
              ...s.tab(isActive),
              ...(isHovered && !isActive && s.tabHover),
            }}
            onClick={() => onTabChange(activity)}
            onMouseEnter={() => setHoveredTab(activity)}
            onMouseLeave={() => setHoveredTab(null)}
          >
            <span style={{ marginRight: '6px' }}>{ACTIVITY_EMOJIS[activity] || '📍'}</span>
            {activity}
          </button>
```

Replace with:
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
              onClick={(e) => { e.stopPropagation(); onActivityToggle?.(activity); }}
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

- [ ] **Step 2: Pass onActivityToggle to ActivityTabs in VenueSelection.jsx**

Open `frontend/src/components/plantrip/VenueSelection.jsx`.

Find (around line 327):
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

- [ ] **Step 3: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 4: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx frontend/src/components/plantrip/VenueSelection.jsx && git commit -m "feat: add × deselect button to ActivityTabs"
```

---

## Task 2: DestinationInsightsPanel — clickable header + Unsplash image + Google Maps link

**Files:**
- Modify: `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`

- [ ] **Step 1: Make card header clickable to expand/collapse**

Find the `item-card__header` div (around line 143):
```jsx
                  <div className="item-card__header">
                    <div className="item-card__icon">{thing.emoji}</div>
```

Replace the opening tag only:
```jsx
                  <div className="item-card__header" onClick={(e) => handleChevronClick(e, thing.name)} style={{ cursor: 'pointer' }}>
                    <div className="item-card__icon">{thing.emoji}</div>
```

- [ ] **Step 2: Add Unsplash image at the top of the expanded detail block**

Find the expanded detail block opening (around line 168):
```jsx
                  {(isOpen || isAdded) && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px 12px 12px' }}>

                      {/* Category colour bar */}
                      <div style={{
```

Add the image block between the outer `<div>` and the colour bar:
```jsx
                  {(isOpen || isAdded) && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '10px 12px 12px 12px' }}>

                      {/* Venue photo */}
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

                      {/* Category colour bar */}
                      <div style={{
```

- [ ] **Step 3: Add Google Maps link after the category tag block**

Find the category tag block (around line 220):
```jsx
                      {/* Category tag */}
                      {thing.category && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span className="item-tag">{thing.category}</span>
                        </div>
                      )}

                      {/* Day picker or confirmation */}
```

Insert the Maps link between the category tag block and the day picker:
```jsx
                      {/* Category tag */}
                      {thing.category && (
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                          <span className="item-tag">{thing.category}</span>
                        </div>
                      )}

                      {/* Google Maps link */}
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

                      {/* Day picker or confirmation */}
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 5: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx && git commit -m "feat: clickable card header; venue photo from Unsplash; Google Maps link"
```

---

## Task 3: VenueSelection — remove duplicate AI Picks chips

**Files:**
- Modify: `frontend/src/components/plantrip/VenueSelection.jsx`

- [ ] **Step 1: Remove aiSuggestions state**

Find and delete this line (around line 34):
```jsx
  const [aiSuggestions, setAiSuggestions] = useState([]);
```

- [ ] **Step 2: Remove the AI Picks chips block from the right panel**

Find and delete the entire block starting with `{aiSuggestions.length > 0 && (` (around line 233). The block to delete is:

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

- [ ] **Step 3: Remove onInsightsLoaded from DestinationInsightsPanel usage**

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

- [ ] **Step 4: Verify no aiSuggestions references remain**

```bash
grep -n "aiSuggestions\|onInsightsLoaded" /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend/src/components/plantrip/VenueSelection.jsx
```
Expected: no output.

- [ ] **Step 5: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/components/plantrip/VenueSelection.jsx && git commit -m "fix: remove duplicate AI Picks chips from right panel — left panel cards are the single source"
```

---

## Done

3 commits. The VenueSelection screen now:
- Lets users deselect activities by clicking × on any ActivityTab
- Expands left-panel cards by clicking anywhere on the header row
- Shows a venue photo (Unsplash) and a Google Maps link in each expanded card
- Has no duplicated AI suggestions — one place, left panel, with day pickers
