# VenueSelection Responsive Two-Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign VenueSelection into a responsive two-panel layout — desktop shows AI insights + selectable suggestions on the left and the activity grid on the right; mobile stacks a compact insights strip, horizontal AI pick chips, then the grid — with both AI suggestions and the emoji grid sharing a single `selectedActivities` state.

**Architecture:** VenueSelection owns all state. DestinationInsightsPanel becomes a presentational component that receives `selectedActivities`/`onActivityToggle` and fires `onInsightsLoaded(thingsToDo)` so VenueSelection can render mobile chips. CSS media queries at 768px switch between the two layouts with no JS involved.

**Tech Stack:** React 18, Jest + React Testing Library, vanilla CSS (identity-obj-proxy in tests)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `frontend/src/components/plantrip/styles/venueselection-redesign.css` | **Modify** | Add responsive split, insights strip, AI card, AI chip classes |
| `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx` | **Rewrite** | Compact badges + selectable AI suggestion cards; fires `onInsightsLoaded` |
| `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx` | **Create** | Tests for badges, selectable cards, `onInsightsLoaded` callback |
| `frontend/src/components/plantrip/VenueSelection.jsx` | **Rewrite** | Two-panel layout, `aiSuggestions` state, mobile chip row, fix `selectedVenues` key bug |

---

## Task 1: CSS — Responsive layout and new component classes

**Files:**
- Modify: `frontend/src/components/plantrip/styles/venueselection-redesign.css`

- [ ] **Step 1: Append responsive and new-component CSS to venueselection-redesign.css**

Append the following block to the END of the existing file (do not touch existing rules):

```css
/* ─── Responsive Two-Panel Layout ────────────────────────────────── */

.venue-split {
  display: flex;
  gap: 16px;
  flex-direction: column;
}

@media (min-width: 768px) {
  .venue-split {
    flex-direction: row;
    align-items: flex-start;
  }
  .venue-panel-left {
    width: 40%;
    flex-shrink: 0;
    position: sticky;
    top: 16px;
    max-height: calc(100vh - 200px);
    overflow-y: auto;
  }
  .venue-panel-right {
    flex: 1;
    min-width: 0;
  }
  .ai-chip-row { display: none; }
}

@media (max-width: 767px) {
  .venue-panel-left { width: 100%; }
  .venue-panel-right { width: 100%; }
  .ai-suggestion-list { display: none; }
}

/* ─── Destination switcher tabs ───────────────────────────────────── */

.venue-dest-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.venue-dest-tab {
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.venue-dest-tab--active {
  border-color: #00d4aa;
  background: rgba(0, 212, 170, 0.15);
  color: #00d4aa;
}

/* ─── Insights strip ──────────────────────────────────────────────── */

.insights-strip {
  background: rgba(0, 212, 170, 0.06);
  border: 1px solid rgba(0, 212, 170, 0.2);
  border-radius: 12px;
  padding: 14px 16px;
}

.insights-strip--error {
  background: rgba(255, 107, 107, 0.06);
  border-color: rgba(255, 107, 107, 0.2);
}

.insights-strip__error-text {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.insights-strip__header {
  font-size: 12px;
  font-weight: 700;
  color: #00d4aa;
  margin-bottom: 8px;
  letter-spacing: 0.03em;
}

.insights-strip__badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.insights-badge {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.insights-badge--weather {
  background: rgba(0, 212, 170, 0.1);
  border-color: rgba(0, 212, 170, 0.25);
  color: #00d4aa;
}

.insights-badge--crowd {
  background: rgba(255, 217, 61, 0.1);
  border-color: rgba(255, 217, 61, 0.25);
  color: #ffd93d;
}

.insights-badge--months {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.6);
}

/* ─── AI suggestion cards (desktop left panel) ────────────────────── */

.ai-suggestions {
  margin-top: 14px;
}

.ai-suggestions__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.ai-suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-suggestion-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all 0.2s;
  width: 100%;
}

.ai-suggestion-card:hover {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.2);
}

.ai-suggestion-card--selected {
  background: rgba(0, 212, 170, 0.1);
  border-color: rgba(0, 212, 170, 0.35);
}

.ai-suggestion-card__emoji {
  font-size: 20px;
  flex-shrink: 0;
}

.ai-suggestion-card__info {
  flex: 1;
  min-width: 0;
}

.ai-suggestion-card__name {
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 2px;
}

.ai-suggestion-card__reason {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-suggestion-card__check {
  font-size: 11px;
  background: #00d4aa;
  color: #0a0f1e;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

/* ─── AI chip row (mobile only, hidden on desktop) ────────────────── */

.ai-chip-row {
  margin-bottom: 12px;
}

.ai-chip-row__label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 6px;
  text-transform: uppercase;
}

.ai-chip-row__chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.ai-chip-row__chips::-webkit-scrollbar { display: none; }

.ai-chip {
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}

.ai-chip--selected {
  border-color: rgba(0, 212, 170, 0.5);
  background: rgba(0, 212, 170, 0.12);
  color: #00d4aa;
}

/* ─── Browse all divider ──────────────────────────────────────────── */

.venue-browse-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  padding: 10px 0 6px;
  text-transform: uppercase;
  position: relative;
}

.venue-browse-label::before,
.venue-browse-label::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 30%;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
}

.venue-browse-label::before { left: 0; }
.venue-browse-label::after { right: 0; }
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/plantrip/styles/venueselection-redesign.css
git commit -m "style: add responsive two-panel layout and AI suggestion CSS classes"
```

---

## Task 2: Rewrite DestinationInsightsPanel

**Files:**
- Rewrite: `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`
- Create: `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx`

- [ ] **Step 1: Create the test file**

Create `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DestinationInsightsPanel } from './DestinationInsightsPanel';
import { fetchDestinationInsights } from '../../../api/destinationInsights';

jest.mock('../../../api/destinationInsights');

const MOCK_INSIGHTS = {
  bestMonths: ['May', 'June'],
  weather: 'Warm and sunny (20-25°C), occasional showers',
  crowdLevel: 'Moderate',
  thingsToDo: [
    { name: 'Alps Hiking', emoji: '🥾', category: 'Adventure', reason: 'Perfect trail weather — ideal for outdoor exploration' },
    { name: 'Beer Festival', emoji: '🍺', category: 'Culture', reason: 'Early June season — festive atmosphere for social travel' },
  ],
};

const PROPS = {
  destination: { name: 'Munich' },
  travelStyles: ['Adventure'],
  startDate: '2026-05-31',
  endDate: '2026-06-05',
  selectedActivities: [],
  onActivityToggle: jest.fn(),
  onInsightsLoaded: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchDestinationInsights.mockResolvedValue(MOCK_INSIGHTS);
});

test('renders nothing when destination is missing', () => {
  const { container } = render(<DestinationInsightsPanel {...PROPS} destination={null} />);
  expect(container.firstChild).toBeNull();
});

test('renders compact badges after insights load', async () => {
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() => expect(screen.getByText(/Moderate/)).toBeInTheDocument());
  expect(screen.getByText(/Warm and sunny/)).toBeInTheDocument();
  expect(screen.getByText(/May & June/)).toBeInTheDocument();
});

test('renders AI suggestion cards', async () => {
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  expect(screen.getByText('Beer Festival')).toBeInTheDocument();
});

test('clicking a suggestion card calls onActivityToggle with its name', async () => {
  const onActivityToggle = jest.fn();
  render(<DestinationInsightsPanel {...PROPS} onActivityToggle={onActivityToggle} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Alps Hiking').closest('button'));
  expect(onActivityToggle).toHaveBeenCalledWith('Alps Hiking');
});

test('selected activity shows --selected class on its card', async () => {
  render(<DestinationInsightsPanel {...PROPS} selectedActivities={['Alps Hiking']} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  const card = screen.getByText('Alps Hiking').closest('button');
  expect(card.className).toContain('ai-suggestion-card--selected');
});

test('calls onInsightsLoaded with thingsToDo when insights arrive', async () => {
  const onInsightsLoaded = jest.fn();
  render(<DestinationInsightsPanel {...PROPS} onInsightsLoaded={onInsightsLoaded} />);
  await waitFor(() =>
    expect(onInsightsLoaded).toHaveBeenCalledWith(MOCK_INSIGHTS.thingsToDo)
  );
});

test('shows error message when fetch fails', async () => {
  fetchDestinationInsights.mockRejectedValue(new Error('network'));
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() =>
    expect(screen.getByText('Could not load destination insights')).toBeInTheDocument()
  );
});
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd frontend && npm test -- --testPathPattern=DestinationInsightsPanel --no-coverage 2>&1 | tail -20
```

Expected: multiple FAIL lines (component doesn't have these classes/callbacks yet).

- [ ] **Step 3: Rewrite DestinationInsightsPanel.jsx**

Replace the full contents of `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { fetchDestinationInsights } from '../../../api/destinationInsights';

export function DestinationInsightsPanel({
  destination,
  travelStyles,
  startDate,
  endDate,
  selectedActivities = [],
  onActivityToggle,
  onInsightsLoaded,
}) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const destName = typeof destination === 'object' ? destination?.name : destination;

  useEffect(() => {
    if (!destination || !startDate || !endDate) return;
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDestinationInsights(
          destName,
          travelStyles || [],
          startDate,
          endDate
        );
        if (cancelled) return;
        setInsights(result);
        if (result.thingsToDo) onInsightsLoaded?.(result.thingsToDo);
      } catch (err) {
        if (!cancelled) setError('Could not load destination insights');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [destination, travelStyles, startDate, endDate]);

  if (!destination) return null;

  if (loading) {
    return (
      <div className="insights-strip">
        <div className="insights-strip__header">✨ {destName} · {startDate} – {endDate}</div>
        <div className="insights-strip__badges">
          <span className="insights-badge">Loading insights…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-strip insights-strip--error">
        <span className="insights-strip__error-text">{error}</span>
      </div>
    );
  }

  if (!insights) return null;

  const bestMonthsText = insights.bestMonths?.slice(0, 2).join(' & ') || 'Year-round';
  const weatherShort = insights.weather
    ? insights.weather.split(/[,(]/)[0].trim()
    : null;

  return (
    <div className="insights-strip">
      <div className="insights-strip__header">✨ {destName} · {startDate} – {endDate}</div>
      <div className="insights-strip__badges">
        {weatherShort && (
          <span className="insights-badge insights-badge--weather">☀️ {weatherShort}</span>
        )}
        {insights.crowdLevel && (
          <span className="insights-badge insights-badge--crowd">👥 {insights.crowdLevel}</span>
        )}
        <span className="insights-badge insights-badge--months">🗓️ {bestMonthsText}</span>
      </div>

      {insights.thingsToDo?.length > 0 && (
        <div className="ai-suggestions">
          <div className="ai-suggestions__label">AI Picks — tap to add</div>
          <div className="ai-suggestion-list">
            {insights.thingsToDo.map((thing, idx) => {
              const isSelected = selectedActivities.includes(thing.name);
              const reasonShort = thing.reason
                ? thing.reason.split('—')[0].trim().slice(0, 55) +
                  (thing.reason.length > 55 ? '…' : '')
                : '';
              return (
                <button
                  key={idx}
                  className={`ai-suggestion-card${isSelected ? ' ai-suggestion-card--selected' : ''}`}
                  onClick={() => onActivityToggle?.(thing.name)}
                >
                  <span className="ai-suggestion-card__emoji">{thing.emoji}</span>
                  <div className="ai-suggestion-card__info">
                    <div className="ai-suggestion-card__name">{thing.name}</div>
                    <div className="ai-suggestion-card__reason">{reasonShort}</div>
                  </div>
                  {isSelected && <span className="ai-suggestion-card__check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd frontend && npm test -- --testPathPattern=DestinationInsightsPanel --no-coverage 2>&1 | tail -20
```

Expected: `Tests: 7 passed, 7 total`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx \
        frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.test.jsx
git commit -m "feat: rewrite DestinationInsightsPanel — compact badges, selectable AI cards, onInsightsLoaded callback"
```

---

## Task 3: Rewrite VenueSelection with two-panel layout

**Files:**
- Rewrite: `frontend/src/components/plantrip/VenueSelection.jsx`

- [ ] **Step 1: Create VenueSelection.test.jsx**

Create `frontend/src/components/plantrip/VenueSelection.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VenueSelection } from './VenueSelection';
import * as geolocation from '../../utils/geolocation';
import * as foursquare from '../../utils/foursquare';
import * as youtube from '../../utils/youtube';

jest.mock('../../utils/geolocation');
jest.mock('../../utils/foursquare');
jest.mock('../../utils/youtube');
jest.mock('./subcomponents/DestinationInsightsPanel', () => ({
  DestinationInsightsPanel: ({ onInsightsLoaded, onActivityToggle, selectedActivities }) => (
    <div data-testid="insights-panel">
      <button
        data-testid="ai-suggestion-btn"
        onClick={() => onActivityToggle('Alps Hiking')}
      >
        AI: Alps Hiking {selectedActivities.includes('Alps Hiking') ? '(selected)' : ''}
      </button>
      <button data-testid="load-suggestions" onClick={() =>
        onInsightsLoaded([{ name: 'Alps Hiking', emoji: '🥾', reason: 'Great trails' }])
      }>
        Load suggestions
      </button>
    </div>
  ),
}));

const DESTINATIONS = [{ name: 'Munich', lat: 48.1, lng: 11.5 }];

beforeEach(() => {
  jest.clearAllMocks();
  geolocation.getUserLocationFromIP.mockResolvedValue({ countryCode: 'DE', country: 'Germany', city: 'Munich', latitude: 48.1, longitude: 11.5 });
  foursquare.getActivitiesForTravelStyle.mockReturnValue(['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife']);
  foursquare.fetchVenuesForActivity.mockResolvedValue([]);
  youtube.fetchTrendingVideos.mockResolvedValue([]);
});

test('renders activity grid after geolocation resolves', async () => {
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      onSubmit={jest.fn()}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => expect(screen.getByText('Hiking')).toBeInTheDocument());
});

test('clicking AI suggestion adds activity to selectedActivities (shared state)', async () => {
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      onSubmit={jest.fn()}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => screen.getByTestId('insights-panel'));
  fireEvent.click(screen.getByTestId('ai-suggestion-btn'));
  await waitFor(() =>
    expect(screen.getByTestId('ai-suggestion-btn').textContent).toContain('(selected)')
  );
});

test('mobile chips appear after onInsightsLoaded fires', async () => {
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      onSubmit={jest.fn()}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => screen.getByTestId('load-suggestions'));
  fireEvent.click(screen.getByTestId('load-suggestions'));
  await waitFor(() =>
    expect(screen.getByText(/Alps Hiking/)).toBeInTheDocument()
  );
});

test('Skip calls onSkip', async () => {
  const onSkip = jest.fn();
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate=""
      endDate=""
      onSubmit={jest.fn()}
      onSkip={onSkip}
    />
  );
  await waitFor(() => screen.getByText('Skip'));
  fireEvent.click(screen.getByText('Skip'));
  expect(onSkip).toHaveBeenCalled();
});

test('Continue calls onSubmit with activities and venues', async () => {
  const onSubmit = jest.fn();
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      onSubmit={onSubmit}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => screen.getByText('Hiking'));
  fireEvent.click(screen.getByText('Hiking').closest('button'));
  fireEvent.click(screen.getByText('Continue →'));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ activities: expect.any(Object), venues: expect.any(Object) })
  );
});
```

- [ ] **Step 2: Run tests — expect to fail**

```bash
cd frontend && npm test -- --testPathPattern=VenueSelection.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL (VenueSelection doesn't have two-panel layout or `aiSuggestions` state yet).

- [ ] **Step 3: Rewrite VenueSelection.jsx**

Replace the full contents of `frontend/src/components/plantrip/VenueSelection.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { ActivityGrid } from './subcomponents/ActivityGrid';
import { ActivityTabs } from './subcomponents/ActivityTabs';
import { YouTubeCarousel } from './subcomponents/YouTubeCarousel';
import { VenuesList } from './subcomponents/VenuesList';
import { CustomInterestModal } from './subcomponents/CustomInterestModal';
import { DestinationInsightsPanel } from './subcomponents/DestinationInsightsPanel';
import { getUserLocationFromIP } from '../../utils/geolocation';
import { fetchTrendingVideos } from '../../utils/youtube';
import { fetchVenuesForActivity, getActivitiesForTravelStyle } from '../../utils/foursquare';
import './styles/venueselection-redesign.css';

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife'];

export function VenueSelection({ destinations, travelStyles, startDate, endDate, onSubmit, onSkip }) {
  const [selectedDestination, setSelectedDestination] = useState(0);
  const [selectedActivities, setSelectedActivities] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [youtubeVideos, setYoutubeVideos] = useState({});
  const [foursquareVenues, setFoursquareVenues] = useState({});
  const [selectedVenues, setSelectedVenues] = useState({});
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState({});
  const [venueLoading, setVenueLoading] = useState({});
  const [countryCode, setCountryCode] = useState('US');
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const destination = destinations?.[selectedDestination];
  const destKey = destination?.name || `destination_${selectedDestination}`;
  const currentActivities = selectedActivities[destKey] || [];

  const availableActivities = travelStyles?.length > 0
    ? getActivitiesForTravelStyle(travelStyles)
    : PRESET_ACTIVITIES;

  useEffect(() => {
    getUserLocationFromIP().then(loc => {
      setCountryCode(loc.countryCode);
      setLoading(false);
    });
  }, []);

  const fetchActivityContent = async (activity) => {
    if (!youtubeVideos[activity]) {
      setVideoLoading(prev => ({ ...prev, [activity]: true }));
      const videos = await fetchTrendingVideos(activity, destination, countryCode);
      setYoutubeVideos(prev => ({ ...prev, [activity]: videos }));
      setVideoLoading(prev => ({ ...prev, [activity]: false }));
    }
    if (!foursquareVenues[activity]) {
      setVenueLoading(prev => ({ ...prev, [activity]: true }));
      const venues = await fetchVenuesForActivity(activity, destination);
      setFoursquareVenues(prev => ({ ...prev, [activity]: venues }));
      setVenueLoading(prev => ({ ...prev, [activity]: false }));
    }
  };

  const handleActivityToggle = (activity) => {
    setSelectedActivities(prev => {
      const activities = prev[destKey] || [];
      let updated;
      if (activities.includes(activity)) {
        updated = activities.filter(a => a !== activity);
        if (activeTab === activity) setActiveTab(updated.length > 0 ? updated[0] : null);
      } else {
        updated = [...activities, activity];
        if (!activeTab) setActiveTab(activity);
        fetchActivityContent(activity);
      }
      return { ...prev, [destKey]: updated };
    });
  };

  const handleCustomActivitySubmit = (activityName) => {
    setSelectedActivities(prev => {
      const activities = prev[destKey] || [];
      if (activities.includes(activityName)) return prev;
      setActiveTab(activityName);
      setShowCustomModal(false);
      fetchActivityContent(activityName);
      return { ...prev, [destKey]: [...activities, activityName] };
    });
  };

  const handleVenueToggle = (venueId) => {
    const venueKey = `${destKey}/${activeTab}`;
    setSelectedVenues(prev => {
      const existing = prev[venueKey] || new Set();
      const updated = new Set(existing);
      if (updated.has(venueId)) updated.delete(venueId);
      else updated.add(venueId);
      return { ...prev, [venueKey]: updated };
    });
  };

  const handleContinue = () => {
    const venueData = {};
    Object.entries(selectedVenues).forEach(([key, venues]) => {
      venueData[key] = Array.from(venues);
    });
    onSubmit({ activities: selectedActivities, venues: venueData });
  };

  if (loading) {
    return (
      <div className="venue-selection-redesign venue-selection-loading">
        <div>Detecting your location…</div>
      </div>
    );
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <>
      <div className="venue-selection-redesign">
        <div className="venue-selection-header">
          <div className="step-label">STEP 2 OF 6</div>
          <h2>What gets you excited?</h2>
          <p>Pick your passions to discover amazing spots</p>
        </div>

        {destinations?.length > 1 && (
          <div className="venue-dest-tabs">
            {destinations.map((dest, idx) => (
              <button
                key={idx}
                className={`venue-dest-tab${selectedDestination === idx ? ' venue-dest-tab--active' : ''}`}
                onClick={() => { setSelectedDestination(idx); setActiveTab(null); }}
              >
                {dest.name}
              </button>
            ))}
          </div>
        )}

        <div className="venue-split">
          <div className="venue-panel-left">
            {destination && startDate && endDate && (
              <DestinationInsightsPanel
                destination={destination}
                travelStyles={travelStyles}
                startDate={startDate}
                endDate={endDate}
                selectedActivities={currentActivities}
                onActivityToggle={handleActivityToggle}
                onInsightsLoaded={setAiSuggestions}
              />
            )}
          </div>

          <div className="venue-panel-right">
            {aiSuggestions.length > 0 && (
              <div className="ai-chip-row">
                <div className="ai-chip-row__label">AI Picks — tap to add</div>
                <div className="ai-chip-row__chips">
                  {aiSuggestions.map((thing, idx) => (
                    <button
                      key={idx}
                      className={`ai-chip${currentActivities.includes(thing.name) ? ' ai-chip--selected' : ''}`}
                      onClick={() => handleActivityToggle(thing.name)}
                    >
                      {thing.emoji} {thing.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="venue-browse-label">Or Browse All</div>

            <ActivityGrid
              availableActivities={availableActivities}
              selectedActivities={currentActivities}
              onActivityToggle={handleActivityToggle}
              onOpenCustomModal={() => setShowCustomModal(true)}
            />

            {currentActivities.length > 0 && (
              <ActivityTabs
                selectedActivities={currentActivities}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            )}

            {activeTab && (
              <>
                <YouTubeCarousel
                  activity={activeTab}
                  destination={destination}
                  countryCode={countryCode}
                  videos={youtubeVideos[activeTab] || []}
                  loading={videoLoading[activeTab] || false}
                  isMobile={isMobile}
                />
                <VenuesList
                  activity={activeTab}
                  venues={foursquareVenues[activeTab] || []}
                  selectedVenues={selectedVenues[`${destKey}/${activeTab}`] || new Set()}
                  onVenueToggle={handleVenueToggle}
                  loading={venueLoading[activeTab] || false}
                  destination={destination}
                />
              </>
            )}
          </div>
        </div>

        <div className="venue-selection-footer">
          <button className="btn-skip" onClick={onSkip}>Skip</button>
          <button
            className="btn-continue"
            onClick={handleContinue}
            disabled={Object.values(selectedActivities).every(arr => arr.length === 0)}
          >
            Continue →
          </button>
        </div>
      </div>

      <CustomInterestModal
        destination={destination}
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSubmit={handleCustomActivitySubmit}
        loading={false}
      />
    </>
  );
}
```

- [ ] **Step 4: Run all tests — expect green**

```bash
cd frontend && npm test -- --no-coverage 2>&1 | tail -30
```

Expected: all test suites pass. If `VenueSelection.test` fails, check that the mock path in the test matches the actual import path in the component.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/plantrip/VenueSelection.jsx \
        frontend/src/components/plantrip/VenueSelection.test.jsx
git commit -m "feat: two-panel VenueSelection — shared AI+grid state, mobile chip row, fix selectedVenues key"
```

---

## Task 4: Remove debug logs and verify build

**Files:**
- Modify: `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx` (remove 2 console.logs)

- [ ] **Step 1: Remove console.log statements from ActivityGrid.jsx**

In `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx`, delete these two lines (currently at lines 134–135):

```js
console.log('[ActivityGrid] availableActivities:', availableActivities);
console.log('[ActivityGrid] mapped activities:', activities);
```

- [ ] **Step 2: Verify production build has no errors**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ built in ...ms` with no errors.

- [ ] **Step 3: Run full test suite one final time**

```bash
cd frontend && npm test -- --no-coverage 2>&1 | tail -15
```

Expected: all suites green.

- [ ] **Step 4: Commit and push**

```bash
git add frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx
git commit -m "chore: remove debug console.logs from ActivityGrid"
git push origin main
```
