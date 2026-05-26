# VenueSelection Component Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign VenueSelection component to show activity interests with YouTube trending carousel, Foursquare venues, and support multi-select with custom interests via modal.

**Architecture:** Complete rewrite of VenueSelection.jsx from venue-category-based to activity-interest-based. Main component orchestrates state for selected activities, active tab, YouTube/Foursquare data. Subcomponents: ActivityGrid (icon selection), ActivityTabs (tab switching), YouTubeCarousel (responsive video carousel), VenuesList (venue listing), CustomInterestModal (bottom-sheet). IP geolocation fetched on mount for analytics; destination location used for API queries.

**Tech Stack:** React 18, Vite, Foursquare API v3, YouTube Data API v3, ip-api.com, CSS Flexbox/Grid.

---

## File Structure

**Files to create:**
- `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx` — Activity icon selection grid
- `frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx` — Tab switching between selected activities
- `frontend/src/components/plantrip/subcomponents/YouTubeCarousel.jsx` — Horizontal scrollable video carousel
- `frontend/src/components/plantrip/subcomponents/VenuesList.jsx` — Foursquare venue listing
- `frontend/src/components/plantrip/subcomponents/CustomInterestModal.jsx` — Bottom-sheet custom interest input
- `frontend/src/utils/geolocation.js` — IP geolocation utility (ip-api.com)
- `frontend/src/utils/youtube.js` — YouTube Data API queries
- `frontend/src/utils/foursquare.js` — Foursquare Places API queries
- `frontend/src/utils/countryFlags.js` — Country code to flag emoji mapping
- `frontend/src/components/plantrip/styles/venueselection-redesign.css` — New dark theme styles

**Files to modify:**
- `frontend/src/components/plantrip/VenueSelection.jsx` — Complete rewrite
- `frontend/src/pages/PlanTrip.jsx` — No changes needed (props interface remains same)

---

## Task 1: Create utility for IP-based geolocation

**Files:**
- Create: `frontend/src/utils/geolocation.js`

- [ ] **Step 1: Write the failing test**

```javascript
// frontend/src/utils/geolocation.test.js
import { getUserLocationFromIP } from './geolocation';

test('getUserLocationFromIP returns location object with country, city', async () => {
  const result = await getUserLocationFromIP();
  expect(result).toHaveProperty('country');
  expect(result).toHaveProperty('city');
  expect(result).toHaveProperty('countryCode');
  expect(typeof result.countryCode).toBe('string');
  expect(result.countryCode.length).toBe(2);
});

test('getUserLocationFromIP falls back gracefully on network error', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
  const result = await getUserLocationFromIP();
  expect(result).toEqual({ country: 'Unknown', city: 'Unknown', countryCode: 'US' });
});
```

- [ ] **Step 2: Write implementation**

```javascript
// frontend/src/utils/geolocation.js

export async function getUserLocationFromIP() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) throw new Error('Geolocation API failed');
    const data = await response.json();
    return {
      country: data.country_name || 'Unknown',
      city: data.city || 'Unknown',
      countryCode: data.country_code || 'US',
      latitude: data.latitude || null,
      longitude: data.longitude || null,
    };
  } catch (error) {
    console.warn('IP geolocation failed, using fallback', error);
    return {
      country: 'Unknown',
      city: 'Unknown',
      countryCode: 'US',
      latitude: null,
      longitude: null,
    };
  }
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd frontend && npm test -- geolocation.test.js -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/geolocation.js frontend/src/utils/geolocation.test.js
git commit -m "feat: add IP-based geolocation utility for user location detection"
```

---

## Task 2: Create country code to flag emoji mapping

**Files:**
- Create: `frontend/src/utils/countryFlags.js`

- [ ] **Step 1: Write mapping**

```javascript
// frontend/src/utils/countryFlags.js

const COUNTRY_FLAGS = {
  'US': '🇺🇸',
  'GB': '🇬🇧',
  'FR': '🇫🇷',
  'DE': '🇩🇪',
  'IT': '🇮🇹',
  'ES': '🇪🇸',
  'NL': '🇳🇱',
  'BE': '🇧🇪',
  'CH': '🇨🇭',
  'AT': '🇦🇹',
  'SE': '🇸🇪',
  'NO': '🇳🇴',
  'DK': '🇩🇰',
  'FI': '🇫🇮',
  'PL': '🇵🇱',
  'CZ': '🇨🇿',
  'HU': '🇭🇺',
  'RO': '🇷🇴',
  'GR': '🇬🇷',
  'PT': '🇵🇹',
  'JP': '🇯🇵',
  'KR': '🇰🇷',
  'CN': '🇨🇳',
  'IN': '🇮🇳',
  'TH': '🇹🇭',
  'VN': '🇻🇳',
  'ID': '🇮🇩',
  'MY': '🇲🇾',
  'SG': '🇸🇬',
  'PH': '🇵🇭',
  'BN': '🇧🇳',
  'KH': '🇰🇭',
  'LA': '🇱🇦',
  'MM': '🇲🇲',
  'BD': '🇧🇩',
  'PK': '🇵🇰',
  'NP': '🇳🇵',
  'LK': '🇱🇰',
  'AU': '🇦🇺',
  'NZ': '🇳🇿',
  'CA': '🇨🇦',
  'MX': '🇲🇽',
  'BR': '🇧🇷',
  'AR': '🇦🇷',
  'CL': '🇨🇱',
  'CO': '🇨🇴',
  'PE': '🇵🇪',
  'ZA': '🇿🇦',
  'EG': '🇪🇬',
  'KE': '🇰🇪',
  'NG': '🇳🇬',
  'AE': '🇦🇪',
  'SA': '🇸🇦',
  'IL': '🇮🇱',
  'TR': '🇹🇷',
};

export function getCountryFlag(countryCode) {
  return COUNTRY_FLAGS[countryCode?.toUpperCase()] || '🌍';
}

export function isValidCountryCode(code) {
  return code && code.length === 2 && code.toUpperCase() in COUNTRY_FLAGS;
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/utils/countryFlags.test.js
import { getCountryFlag, isValidCountryCode } from './countryFlags';

test('getCountryFlag returns flag emoji for valid country code', () => {
  expect(getCountryFlag('TH')).toBe('🇹🇭');
  expect(getCountryFlag('US')).toBe('🇺🇸');
  expect(getCountryFlag('FR')).toBe('🇫🇷');
});

test('getCountryFlag returns globe emoji for invalid country code', () => {
  expect(getCountryFlag('XX')).toBe('🌍');
  expect(getCountryFlag(null)).toBe('🌍');
  expect(getCountryFlag('')).toBe('🌍');
});

test('getCountryFlag handles lowercase country codes', () => {
  expect(getCountryFlag('th')).toBe('🇹🇭');
  expect(getCountryFlag('us')).toBe('🇺🇸');
});

test('isValidCountryCode validates correctly', () => {
  expect(isValidCountryCode('TH')).toBe(true);
  expect(isValidCountryCode('th')).toBe(true);
  expect(isValidCountryCode('XX')).toBe(false);
  expect(isValidCountryCode(null)).toBe(false);
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- countryFlags.test.js -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/countryFlags.js frontend/src/utils/countryFlags.test.js
git commit -m "feat: add country code to flag emoji mapping utility"
```

---

## Task 3: Create YouTube API utility

**Files:**
- Create: `frontend/src/utils/youtube.js`

- [ ] **Step 1: Write implementation**

```javascript
// frontend/src/utils/youtube.js

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

export async function fetchTrendingVideos(activity, destination, countryCode, maxResults = 8) {
  if (!YOUTUBE_API_KEY) {
    console.warn('YouTube API key not configured');
    return [];
  }

  try {
    // Build hashtag queries: #hikinginbangkok, #bangkok2024, etc.
    const queries = [
      `#${activity.toLowerCase()}in${destination.toLowerCase()}`,
      `#${destination.toLowerCase()}2024`,
      `#${activity.toLowerCase()}`,
    ];
    const searchQuery = queries.join(' ');

    const params = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      type: 'video',
      maxResults: maxResults.toString(),
      order: 'viewCount',
      regionCode: countryCode,
      relevanceLanguage: 'en',
      key: YOUTUBE_API_KEY,
    });

    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!response.ok) throw new Error(`YouTube API error: ${response.status}`);

    const data = await response.json();
    if (!data.items) return [];

    return data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      creator: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.default.url,
      description: item.snippet.description,
    }));
  } catch (error) {
    console.error('Failed to fetch YouTube videos:', error);
    return [];
  }
}

export function getYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function formatViewCount(views) {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M views`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K views`;
  }
  return `${views} views`;
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/utils/youtube.test.js
import { getYouTubeUrl, formatViewCount } from './youtube.js';

test('getYouTubeUrl returns correct YouTube URL', () => {
  const url = getYouTubeUrl('dQw4w9WgXcQ');
  expect(url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('formatViewCount formats view counts correctly', () => {
  expect(formatViewCount(1500000)).toBe('1.5M views');
  expect(formatViewCount(245000)).toBe('245.0K views');
  expect(formatViewCount(500)).toBe('500 views');
  expect(formatViewCount(0)).toBe('0 views');
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- youtube.test.js -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/youtube.js frontend/src/utils/youtube.test.js
git commit -m "feat: add YouTube Data API utility for trending video queries"
```

---

## Task 4: Create Foursquare API utility

**Files:**
- Create: `frontend/src/utils/foursquare.js`

- [ ] **Step 1: Write implementation**

```javascript
// frontend/src/utils/foursquare.js

const FOURSQUARE_API_KEY = import.meta.env.VITE_FOURSQUARE_API_KEY;

export async function fetchVenuesForActivity(activity, destination, maxResults = 5) {
  if (!FOURSQUARE_API_KEY) {
    console.warn('Foursquare API key not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: activity,
      location: destination,
      limit: maxResults.toString(),
    });

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?${params}`,
      {
        headers: {
          'Authorization': FOURSQUARE_API_KEY,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) throw new Error(`Foursquare API error: ${response.status}`);

    const data = await response.json();
    if (!data.results) return [];

    return data.results.map(venue => ({
      id: venue.fsq_id,
      name: venue.name,
      category: venue.categories?.[0]?.name || 'Venue',
      rating: venue.rating || null,
      address: venue.location?.address || 'Address not available',
    }));
  } catch (error) {
    console.error('Failed to fetch Foursquare venues:', error);
    return [];
  }
}

export function formatRating(rating) {
  if (!rating) return null;
  return `⭐ ${rating.toFixed(1)}`;
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/utils/foursquare.test.js
import { formatRating } from './foursquare.js';

test('formatRating formats rating correctly', () => {
  expect(formatRating(4.8)).toBe('⭐ 4.8');
  expect(formatRating(4.0)).toBe('⭐ 4.0');
  expect(formatRating(3.55)).toBe('⭐ 3.6');
  expect(formatRating(null)).toBe(null);
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- foursquare.test.js -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/foursquare.js frontend/src/utils/foursquare.test.js
git commit -m "feat: add Foursquare Places API utility for venue queries"
```

---

## Task 5: Create ActivityGrid subcomponent

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx`

- [ ] **Step 1: Write implementation**

```javascript
// frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx
import React from 'react';

const PRESET_ACTIVITIES = [
  { name: 'Hiking', emoji: '🥾' },
  { name: 'Food', emoji: '🍜' },
  { name: 'Views', emoji: '⛰️' },
  { name: 'Culture', emoji: '🏛️' },
  { name: 'Nature', emoji: '🌳' },
  { name: 'Nightlife', emoji: '🎵' },
];

const s = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginBottom: '12px',
  },
  button: (selected) => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 10px',
    background: selected ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)',
    border: selected ? '2px solid #00d4aa' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
  }),
  emoji: {
    fontSize: '36px',
    lineHeight: '1',
  },
  label: (selected) => ({
    fontSize: '11px',
    color: selected ? '#00d4aa' : 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  }),
  customButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 10px',
    background: 'rgba(0,212,170,0.08)',
    border: '2px dashed #00d4aa',
    borderRadius: '12px',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
  },
  customEmoji: {
    fontSize: '36px',
    fontWeight: '300',
    color: '#00d4aa',
  },
  selectedLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '8px',
  },
  selectedSpan: {
    color: '#00d4aa',
    fontWeight: '700',
  },
};

export function ActivityGrid({ selectedActivities, onActivityToggle, onOpenCustomModal }) {
  const handleActivityClick = (activity) => {
    onActivityToggle(activity);
  };

  return (
    <div>
      <div style={s.grid}>
        {PRESET_ACTIVITIES.map(activity => (
          <button
            key={activity.name}
            style={s.button(selectedActivities.includes(activity.name))}
            onClick={() => handleActivityClick(activity.name)}
          >
            <div style={s.emoji}>{activity.emoji}</div>
            <div style={s.label(selectedActivities.includes(activity.name))}>
              {activity.name}
            </div>
          </button>
        ))}
        <button
          style={s.customButton}
          onClick={onOpenCustomModal}
        >
          <div style={s.customEmoji}>+</div>
          <div style={s.label(false)}>Add Custom</div>
        </button>
      </div>
      <div style={s.selectedLabel}>
        <span style={s.selectedSpan}>Selected:</span> {selectedActivities.length > 0 ? selectedActivities.join(', ') : 'None'}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/components/plantrip/subcomponents/ActivityGrid.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityGrid } from './ActivityGrid';

test('ActivityGrid renders all preset activities', () => {
  const { container } = render(
    <ActivityGrid selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  expect(screen.getByText('Hiking')).toBeInTheDocument();
  expect(screen.getByText('Food')).toBeInTheDocument();
  expect(screen.getByText('Culture')).toBeInTheDocument();
  expect(screen.getByText('Add Custom')).toBeInTheDocument();
});

test('ActivityGrid highlights selected activity', () => {
  render(
    <ActivityGrid selectedActivities={['Hiking']} onActivityToggle={() => {}} onOpenCustomModal={() => {}} />
  );
  const buttons = screen.getAllByRole('button');
  const hikingButton = buttons.find(btn => btn.textContent.includes('Hiking'));
  expect(hikingButton.style.border).toContain('#00d4aa');
});

test('ActivityGrid calls onActivityToggle when activity clicked', () => {
  const mockToggle = jest.fn();
  render(
    <ActivityGrid selectedActivities={[]} onActivityToggle={mockToggle} onOpenCustomModal={() => {}} />
  );
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[0]); // Click first activity
  expect(mockToggle).toHaveBeenCalled();
});

test('ActivityGrid calls onOpenCustomModal when + clicked', () => {
  const mockOpen = jest.fn();
  render(
    <ActivityGrid selectedActivities={[]} onActivityToggle={() => {}} onOpenCustomModal={mockOpen} />
  );
  const customButton = screen.getByText('Add Custom').closest('button');
  fireEvent.click(customButton);
  expect(mockOpen).toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- ActivityGrid.test.jsx -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx frontend/src/components/plantrip/subcomponents/ActivityGrid.test.jsx
git commit -m "feat: create ActivityGrid subcomponent for activity selection"
```

---

## Task 6: Create ActivityTabs subcomponent

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx`

- [ ] **Step 1: Write implementation**

```javascript
// frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx
import React from 'react';

const ACTIVITY_EMOJIS = {
  'Hiking': '🥾',
  'Food': '🍜',
  'Views': '⛰️',
  'Culture': '🏛️',
  'Nature': '🌳',
  'Nightlife': '🎵',
};

const s = {
  container: {
    display: 'flex',
    gap: '8px',
    padding: '12px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    overflowX: 'auto',
    background: 'rgba(255,255,255,0.02)',
    scrollBehavior: 'smooth',
  },
  tab: (active) => ({
    padding: '8px 14px',
    background: active ? 'rgba(0,212,170,0.2)' : 'rgba(255,255,255,0.04)',
    border: active ? '1px solid #00d4aa' : '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
  }),
};

export function ActivityTabs({ selectedActivities, activeTab, onTabChange }) {
  if (selectedActivities.length === 0) {
    return null;
  }

  return (
    <div style={s.container}>
      {selectedActivities.map(activity => (
        <button
          key={activity}
          style={s.tab(activeTab === activity)}
          onClick={() => onTabChange(activity)}
        >
          {ACTIVITY_EMOJIS[activity] || '📍'} {activity}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/components/plantrip/subcomponents/ActivityTabs.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityTabs } from './ActivityTabs';

test('ActivityTabs renders selected activities as tabs', () => {
  render(
    <ActivityTabs selectedActivities={['Hiking', 'Food']} activeTab="Hiking" onTabChange={() => {}} />
  );
  expect(screen.getByText(/Hiking/)).toBeInTheDocument();
  expect(screen.getByText(/Food/)).toBeInTheDocument();
});

test('ActivityTabs returns null when no activities selected', () => {
  const { container } = render(
    <ActivityTabs selectedActivities={[]} activeTab="" onTabChange={() => {}} />
  );
  expect(container.firstChild).toBeNull();
});

test('ActivityTabs highlights active tab', () => {
  const { container } = render(
    <ActivityTabs selectedActivities={['Hiking', 'Food']} activeTab="Hiking" onTabChange={() => {}} />
  );
  const tabs = container.querySelectorAll('button');
  expect(tabs[0].style.border).toContain('#00d4aa');
  expect(tabs[1].style.border).toContain('rgba(255,255,255,0.12)');
});

test('ActivityTabs calls onTabChange when tab clicked', () => {
  const mockChange = jest.fn();
  render(
    <ActivityTabs selectedActivities={['Hiking', 'Food']} activeTab="Hiking" onTabChange={mockChange} />
  );
  const tabs = screen.getAllByRole('button');
  fireEvent.click(tabs[1]); // Click Food tab
  expect(mockChange).toHaveBeenCalledWith('Food');
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- ActivityTabs.test.jsx -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/ActivityTabs.jsx frontend/src/components/plantrip/subcomponents/ActivityTabs.test.jsx
git commit -m "feat: create ActivityTabs subcomponent for multi-select tab switching"
```

---

## Task 7: Create YouTubeCarousel subcomponent

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/YouTubeCarousel.jsx`

- [ ] **Step 1: Write implementation**

```javascript
// frontend/src/components/plantrip/subcomponents/YouTubeCarousel.jsx
import React, { useEffect, useState } from 'react';
import { getCountryFlag } from '../../../utils/countryFlags';

const s = {
  section: {
    marginBottom: '20px',
  },
  header: {
    fontSize: '10px',
    color: '#ffd93d',
    fontWeight: '800',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  carousel: (isMobile) => ({
    display: 'flex',
    gap: '10px',
    overflowX: 'auto',
    scrollBehavior: 'smooth',
    marginBottom: '16px',
    paddingBottom: '8px',
    scrollSnapType: 'x mandatory',
  }),
  cardContainer: (isMobile) => ({
    flex: isMobile ? '0 0 calc(100% - 4px)' : '0 0 calc(33% - 10px)',
    scrollSnapAlign: 'start',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    overflow: 'hidden',
  }),
  thumbnail: {
    width: '100%',
    height: '120px',
    objectFit: 'cover',
    background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)',
  },
  content: {
    padding: '12px',
  },
  title: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '4px',
    lineHeight: '1.3',
  },
  metadata: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '8px',
  },
  tags: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  },
  tag: {
    fontSize: '9px',
    background: 'rgba(0,212,170,0.15)',
    color: '#00d4aa',
    padding: '3px 8px',
    borderRadius: '12px',
  },
  link: {
    color: '#00d4aa',
    textDecoration: 'none',
    fontSize: '11px',
    fontWeight: '600',
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: '16px',
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: 'rgba(255,255,255,0.5)',
  },
  empty: {
    textAlign: 'center',
    padding: '20px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '14px',
  },
};

export function YouTubeCarousel({ activity, destination, countryCode, videos, loading, isMobile }) {
  const flag = getCountryFlag(countryCode);

  if (loading) {
    return (
      <div style={s.section}>
        <div style={s.header}>
          <span>🔥</span> Trending in {flag} {destination}
        </div>
        <div style={s.loading}>Loading videos...</div>
      </div>
    );
  }

  if (!videos || videos.length === 0) {
    return (
      <div style={s.section}>
        <div style={s.header}>
          <span>🔥</span> Trending in {flag} {destination}
        </div>
        <div style={s.empty}>No trending videos found for {activity}</div>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <div style={s.header}>
        <span>🔥</span> Trending in <span style={{ fontSize: '18px' }}>{flag}</span> {destination}
      </div>

      <div style={s.carousel(isMobile)}>
        {videos.map(video => (
          <div key={video.id} style={s.cardContainer(isMobile)}>
            {video.thumbnailUrl && (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                style={s.thumbnail}
              />
            )}
            <div style={s.content}>
              <div style={s.title}>{video.title}</div>
              <div style={s.metadata}>{video.creator}</div>
              <div style={s.tags}>
                <span style={s.tag}>#trending</span>
                <span style={s.tag}>{activity.toLowerCase()}</span>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${video.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={s.link}
              >
                Watch video →
              </a>
            </div>
          </div>
        ))}
      </div>

      {isMobile && (
        <div style={s.swipeHint}>← Swipe for more →</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/components/plantrip/subcomponents/YouTubeCarousel.test.jsx
import { render, screen } from '@testing-library/react';
import { YouTubeCarousel } from './YouTubeCarousel';

const mockVideos = [
  {
    id: 'abc123',
    title: 'Best Hiking Trails',
    creator: 'Adventure Max',
    thumbnailUrl: 'https://example.com/thumb.jpg',
  },
  {
    id: 'def456',
    title: 'Hidden Waterfall Trek',
    creator: 'Travel Vlog',
    thumbnailUrl: 'https://example.com/thumb2.jpg',
  },
];

test('YouTubeCarousel renders video cards', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText('Best Hiking Trails')).toBeInTheDocument();
  expect(screen.getByText('Hidden Waterfall Trek')).toBeInTheDocument();
  expect(screen.getByText('Adventure Max')).toBeInTheDocument();
});

test('YouTubeCarousel displays country flag', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText(/Bangkok/)).toBeInTheDocument();
});

test('YouTubeCarousel shows loading state', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={[]}
      loading={true}
      isMobile={true}
    />
  );
  expect(screen.getByText('Loading videos...')).toBeInTheDocument();
});

test('YouTubeCarousel shows empty state', () => {
  render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={[]}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText(/No trending videos found/)).toBeInTheDocument();
});

test('YouTubeCarousel shows swipe hint on mobile', () => {
  const { rerender } = render(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={true}
    />
  );
  expect(screen.getByText('← Swipe for more →')).toBeInTheDocument();

  rerender(
    <YouTubeCarousel
      activity="Hiking"
      destination="Bangkok"
      countryCode="TH"
      videos={mockVideos}
      loading={false}
      isMobile={false}
    />
  );
  expect(screen.queryByText('← Swipe for more →')).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- YouTubeCarousel.test.jsx -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/YouTubeCarousel.jsx frontend/src/components/plantrip/subcomponents/YouTubeCarousel.test.jsx
git commit -m "feat: create YouTubeCarousel subcomponent for trending videos with responsive layout"
```

---

## Task 8: Create VenuesList subcomponent

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/VenuesList.jsx`

- [ ] **Step 1: Write implementation**

```javascript
// frontend/src/components/plantrip/subcomponents/VenuesList.jsx
import React from 'react';

const s = {
  section: {
    marginTop: '20px',
  },
  header: {
    fontSize: '10px',
    color: '#00d4aa',
    fontWeight: '800',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: '12px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    cursor: 'pointer',
    accentColor: '#00d4aa',
    flexShrink: 0,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#fff',
  },
  category: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '2px',
  },
  rating: {
    fontSize: '11px',
    color: '#ffd93d',
    marginTop: '4px',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '14px',
  },
};

export function VenuesList({ activity, venues, selectedVenues, onVenueToggle, loading }) {
  if (loading) {
    return (
      <div style={s.section}>
        <div style={s.header}>{activity} Venues</div>
        <div style={s.loading}>Loading venues...</div>
      </div>
    );
  }

  if (!venues || venues.length === 0) {
    return (
      <div style={s.section}>
        <div style={s.header}>{activity} Venues ({0} available)</div>
        <div style={s.empty}>No venues found for {activity}</div>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <div style={s.header}>{activity} Venues ({venues.length} available)</div>

      <div style={s.list}>
        {venues.map(venue => (
          <label key={venue.id} style={s.label}>
            <input
              type="checkbox"
              style={s.checkbox}
              checked={selectedVenues.has(venue.id)}
              onChange={() => onVenueToggle(venue.id)}
            />
            <div style={s.info}>
              <div style={s.name}>{venue.name}</div>
              {venue.category && (
                <div style={s.category}>{venue.category}</div>
              )}
              {venue.rating && (
                <div style={s.rating}>⭐ {venue.rating.toFixed(1)}</div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/components/plantrip/subcomponents/VenuesList.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { VenuesList } from './VenuesList';

const mockVenues = [
  { id: 'v1', name: 'Mountain Peak Trail', category: 'Hiking', rating: 4.8 },
  { id: 'v2', name: 'Waterfall Hike', category: 'Hiking', rating: 4.9 },
];

test('VenuesList renders venues with details', () => {
  render(
    <VenuesList
      activity="Hiking"
      venues={mockVenues}
      selectedVenues={new Set()}
      onVenueToggle={() => {}}
      loading={false}
    />
  );
  expect(screen.getByText('Mountain Peak Trail')).toBeInTheDocument();
  expect(screen.getByText('Waterfall Hike')).toBeInTheDocument();
  expect(screen.getByText(/Hiking Venues/)).toBeInTheDocument();
});

test('VenuesList shows loading state', () => {
  render(
    <VenuesList
      activity="Hiking"
      venues={[]}
      selectedVenues={new Set()}
      onVenueToggle={() => {}}
      loading={true}
    />
  );
  expect(screen.getByText('Loading venues...')).toBeInTheDocument();
});

test('VenuesList shows empty state', () => {
  render(
    <VenuesList
      activity="Hiking"
      venues={[]}
      selectedVenues={new Set()}
      onVenueToggle={() => {}}
      loading={false}
    />
  );
  expect(screen.getByText(/No venues found/)).toBeInTheDocument();
});

test('VenuesList calls onVenueToggle on checkbox change', () => {
  const mockToggle = jest.fn();
  render(
    <VenuesList
      activity="Hiking"
      venues={mockVenues}
      selectedVenues={new Set()}
      onVenueToggle={mockToggle}
      loading={false}
    />
  );
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);
  expect(mockToggle).toHaveBeenCalledWith('v1');
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- VenuesList.test.jsx -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/VenuesList.jsx frontend/src/components/plantrip/subcomponents/VenuesList.test.jsx
git commit -m "feat: create VenuesList subcomponent for Foursquare venue selection"
```

---

## Task 9: Create CustomInterestModal subcomponent

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/CustomInterestModal.jsx`

- [ ] **Step 1: Write implementation**

```javascript
// frontend/src/components/plantrip/subcomponents/CustomInterestModal.jsx
import React, { useState } from 'react';

const s = {
  overlay: (isOpen) => ({
    display: isOpen ? 'fixed' : 'none',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 999,
    animation: isOpen ? 'fadeIn 0.2s ease' : undefined,
  }),
  modal: (isOpen) => ({
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: '#0a0f1e',
    borderTopLeftRadius: '16px',
    borderTopRightRadius: '16px',
    padding: '24px 16px 32px',
    zIndex: 1000,
    maxHeight: '80vh',
    overflowY: 'auto',
    transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
    transition: 'transform 0.3s ease',
    animation: isOpen ? 'slideUp 0.3s ease' : undefined,
  }),
  header: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '16px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  prompt: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '12px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    marginBottom: '16px',
    outline: 'none',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'space-between',
  },
  button: (variant) => ({
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s',
    background: variant === 'primary' ? '#00d4aa' : 'rgba(255,255,255,0.04)',
    color: variant === 'primary' ? '#0a0f1e' : '#fff',
  }),
};

export function CustomInterestModal({ destination, isOpen, onClose, onSubmit, loading }) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim()) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  const handleCancel = () => {
    setInput('');
    onClose();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <>
      <div
        style={s.overlay(isOpen)}
        onClick={handleCancel}
      />
      <div style={s.modal(isOpen)}>
        <div style={s.header}>Add Custom Interest</div>
        <div style={s.prompt}>What interests you in {destination}?</div>
        <input
          type="text"
          style={s.input}
          placeholder="e.g., Street Art, Photography, Photography"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          autoFocus
        />
        <div style={s.buttons}>
          <button
            style={s.button('secondary')}
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            style={s.button('primary')}
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
          >
            {loading ? 'Adding...' : 'Add Interest'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
```

- [ ] **Step 2: Write test**

```javascript
// frontend/src/components/plantrip/subcomponents/CustomInterestModal.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { CustomInterestModal } from './CustomInterestModal';

test('CustomInterestModal is hidden when isOpen=false', () => {
  const { container } = render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={false}
      onClose={() => {}}
      onSubmit={() => {}}
      loading={false}
    />
  );
  const modal = container.querySelector('[style*="translateY"]');
  expect(modal.style.display).toBe('none');
});

test('CustomInterestModal shows when isOpen=true', () => {
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={() => {}}
      onSubmit={() => {}}
      loading={false}
    />
  );
  expect(screen.getByText('Add Custom Interest')).toBeInTheDocument();
  expect(screen.getByText(/Bangkok/)).toBeInTheDocument();
});

test('CustomInterestModal calls onSubmit with input', () => {
  const mockSubmit = jest.fn();
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={() => {}}
      onSubmit={mockSubmit}
      loading={false}
    />
  );
  const input = screen.getByPlaceholderText(/Street Art/);
  const addButton = screen.getByText('Add Interest');
  fireEvent.change(input, { target: { value: 'Street Art' } });
  fireEvent.click(addButton);
  expect(mockSubmit).toHaveBeenCalledWith('Street Art');
});

test('CustomInterestModal calls onClose when Cancel clicked', () => {
  const mockClose = jest.fn();
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={mockClose}
      onSubmit={() => {}}
      loading={false}
    />
  );
  const cancelButton = screen.getByText('Cancel');
  fireEvent.click(cancelButton);
  expect(mockClose).toHaveBeenCalled();
});

test('CustomInterestModal submits on Enter key', () => {
  const mockSubmit = jest.fn();
  render(
    <CustomInterestModal
      destination="Bangkok"
      isOpen={true}
      onClose={() => {}}
      onSubmit={mockSubmit}
      loading={false}
    />
  );
  const input = screen.getByPlaceholderText(/Street Art/);
  fireEvent.change(input, { target: { value: 'Street Art' } });
  fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
  expect(mockSubmit).toHaveBeenCalledWith('Street Art');
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npm test -- CustomInterestModal.test.jsx -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/CustomInterestModal.jsx frontend/src/components/plantrip/subcomponents/CustomInterestModal.test.jsx
git commit -m "feat: create CustomInterestModal subcomponent for user-defined activity interests"
```

---

## Task 10: Create CSS stylesheet for redesigned VenueSelection

**Files:**
- Create: `frontend/src/components/plantrip/styles/venueselection-redesign.css`

- [ ] **Step 1: Write CSS**

```css
/* frontend/src/components/plantrip/styles/venueselection-redesign.css */

.venue-selection-redesign {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 0;
}

.venue-selection-header {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.venue-selection-header .step-label {
  font-size: 10px;
  color: #00d4aa;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.venue-selection-header h2 {
  font-family: 'Fraunces', serif;
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px 0;
  line-height: 1.1;
}

.venue-selection-header p {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  font-style: italic;
}

.venue-selection-content {
  max-height: 450px;
  overflow-y: auto;
  padding: 16px 12px;
}

.venue-selection-footer {
  padding: 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  gap: 12px;
}

.venue-selection-footer button {
  flex: 1;
  padding: 13px;
  border: none;
  border-radius: 8px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.venue-selection-footer .btn-continue {
  background: #00d4aa;
  color: #0a0f1e;
}

.venue-selection-footer .btn-continue:hover:not(:disabled) {
  background: #00b896;
}

.venue-selection-footer .btn-skip {
  background: transparent;
  color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.venue-selection-footer .btn-skip:hover:not(:disabled) {
  color: rgba(255, 255, 255, 0.7);
  border-color: rgba(255, 255, 255, 0.3);
}

.venue-selection-footer button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.venue-selection-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 16px;
  color: rgba(255, 255, 255, 0.5);
}

.venue-selection-error {
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  color: #ff6b6b;
  font-size: 14px;
  margin-bottom: 16px;
}

/* Responsive - mobile vs desktop carousel */
@media (max-width: 599px) {
  .venue-selection-content {
    max-height: 500px;
  }
}

@media (min-width: 600px) {
  .venue-selection-content {
    max-height: 600px;
  }
}
```

- [ ] **Step 2: Verify file creates without syntax errors**

Run: `head -5 frontend/src/components/plantrip/styles/venueselection-redesign.css`
Expected: Shows first 5 lines of CSS file

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/plantrip/styles/venueselection-redesign.css
git commit -m "feat: add dark-themed CSS stylesheet for redesigned VenueSelection"
```

---

## Task 11: Rewrite VenueSelection.jsx main component

**Files:**
- Modify: `frontend/src/components/plantrip/VenueSelection.jsx`

- [ ] **Step 1: Write new implementation**

```javascript
// frontend/src/components/plantrip/VenueSelection.jsx
import { useState, useEffect } from 'react';
import { ActivityGrid } from './subcomponents/ActivityGrid';
import { ActivityTabs } from './subcomponents/ActivityTabs';
import { YouTubeCarousel } from './subcomponents/YouTubeCarousel';
import { VenuesList } from './subcomponents/VenuesList';
import { CustomInterestModal } from './subcomponents/CustomInterestModal';
import { getUserLocationFromIP } from '../../utils/geolocation';
import { fetchTrendingVideos } from '../../utils/youtube';
import { fetchVenuesForActivity } from '../../utils/foursquare';
import './styles/venueselection-redesign.css';

const PRESET_ACTIVITIES = ['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife'];

export function VenueSelection({ destination, onSubmit, onSkip }) {
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [youtubeVideos, setYoutubeVideos] = useState({});
  const [foursquareVenues, setFoursquareVenues] = useState({});
  const [selectedVenues, setSelectedVenues] = useState({});
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [videoLoading, setVideoLoading] = useState({});
  const [venueLoading, setVenueLoading] = useState({});
  const [userLocation, setUserLocation] = useState(null);
  const [countryCode, setCountryCode] = useState('US');
  const [error, setError] = useState(null);

  // Fetch user IP location on mount
  useEffect(() => {
    const fetchUserLocation = async () => {
      const location = await getUserLocationFromIP();
      setUserLocation(location);
      setCountryCode(location.countryCode);
      setLoading(false);
    };
    fetchUserLocation();
  }, []);

  // Fetch YouTube + Foursquare data for preset activities
  useEffect(() => {
    if (!loading && PRESET_ACTIVITIES.length > 0) {
      PRESET_ACTIVITIES.forEach(activity => {
        if (!youtubeVideos[activity]) {
          fetchActivityContent(activity);
        }
      });
    }
  }, [loading]);

  const fetchActivityContent = async (activity) => {
    // Fetch YouTube
    if (!youtubeVideos[activity]) {
      setVideoLoading(prev => ({ ...prev, [activity]: true }));
      const videos = await fetchTrendingVideos(activity, destination, countryCode);
      setYoutubeVideos(prev => ({ ...prev, [activity]: videos }));
      setVideoLoading(prev => ({ ...prev, [activity]: false }));
    }

    // Fetch Foursquare
    if (!foursquareVenues[activity]) {
      setVenueLoading(prev => ({ ...prev, [activity]: true }));
      const venues = await fetchVenuesForActivity(activity, destination);
      setFoursquareVenues(prev => ({ ...prev, [activity]: venues }));
      setVenueLoading(prev => ({ ...prev, [activity]: false }));
    }
  };

  const handleActivityToggle = (activity) => {
    if (selectedActivities.includes(activity)) {
      const updated = selectedActivities.filter(a => a !== activity);
      setSelectedActivities(updated);
      if (activeTab === activity) {
        setActiveTab(updated.length > 0 ? updated[0] : null);
      }
    } else {
      const updated = [...selectedActivities, activity];
      setSelectedActivities(updated);
      if (!activeTab) {
        setActiveTab(activity);
      }
      // Fetch content for newly selected activity if not cached
      if (!youtubeVideos[activity] || !foursquareVenues[activity]) {
        fetchActivityContent(activity);
      }
    }
  };

  const handleCustomActivitySubmit = async (activityName) => {
    if (!selectedActivities.includes(activityName)) {
      const updated = [...selectedActivities, activityName];
      setSelectedActivities(updated);
      setActiveTab(activityName);
      setShowCustomModal(false);
      await fetchActivityContent(activityName);
    }
  };

  const handleVenueToggle = (venueId) => {
    const activeActivity = activeTab;
    setSelectedVenues(prev => {
      const activityVenues = prev[activeActivity] || new Set();
      const updated = new Set(activityVenues);
      if (updated.has(venueId)) {
        updated.delete(venueId);
      } else {
        updated.add(venueId);
      }
      return { ...prev, [activeActivity]: updated };
    });
  };

  const handleContinue = () => {
    const venueData = {};
    Object.entries(selectedVenues).forEach(([activity, venues]) => {
      venueData[activity] = Array.from(venues);
    });
    onSubmit({
      selectedActivities,
      selectedVenues: venueData,
      userLocation,
    });
  };

  if (loading) {
    return (
      <div className="venue-selection-redesign venue-selection-loading">
        <div>Detecting your location...</div>
      </div>
    );
  }

  // Detect mobile vs desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600;

  return (
    <div className="venue-selection-redesign">
      <div className="venue-selection-header">
        <div className="step-label">STEP 2 OF 6</div>
        <h2>Favourite activities</h2>
        <p>Tap interests or add your own</p>
      </div>

      <div className="venue-selection-content">
        {/* Activity Grid */}
        <ActivityGrid
          selectedActivities={selectedActivities}
          onActivityToggle={handleActivityToggle}
          onOpenCustomModal={() => setShowCustomModal(true)}
        />

        {/* Activity Tabs */}
        {selectedActivities.length > 0 && (
          <ActivityTabs
            selectedActivities={selectedActivities}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        )}

        {/* YouTube Carousel */}
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

            {/* Venues List */}
            <VenuesList
              activity={activeTab}
              venues={foursquareVenues[activeTab] || []}
              selectedVenues={selectedVenues[activeTab] || new Set()}
              onVenueToggle={handleVenueToggle}
              loading={venueLoading[activeTab] || false}
            />
          </>
        )}

        {error && (
          <div className="venue-selection-error">{error}</div>
        )}
      </div>

      {/* Footer Buttons */}
      <div className="venue-selection-footer">
        <button className="btn-skip" onClick={onSkip}>
          Skip
        </button>
        <button
          className="btn-continue"
          onClick={handleContinue}
          disabled={selectedActivities.length === 0}
        >
          Continue →
        </button>
      </div>

      {/* Custom Interest Modal */}
      <CustomInterestModal
        destination={destination}
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSubmit={handleCustomActivitySubmit}
        loading={false}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run tests to verify component renders**

Run: `cd frontend && npm test -- VenueSelection.test.jsx -v`
Expected: PASS (or create tests if they don't exist)

- [ ] **Step 3: Verify component exports correctly**

Run: `grep -n "export.*VenueSelection" frontend/src/components/plantrip/VenueSelection.jsx`
Expected: Shows export line

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/VenueSelection.jsx
git commit -m "refactor: rewrite VenueSelection component with activity interests, YouTube carousel, and multi-select support"
```

---

## Task 12: Update environment variables documentation

**Files:**
- Modify: `.env.example` or frontend README (document new env vars)

- [ ] **Step 1: Document required environment variables**

Add to frontend `.env.example` or setup docs:

```
# YouTube Data API
VITE_YOUTUBE_API_KEY=your_youtube_api_key_here

# Foursquare API
VITE_FOURSQUARE_API_KEY=your_foursquare_api_key_here
```

- [ ] **Step 2: Verify no API keys are committed**

Run: `grep -r "YOUTUBE_API_KEY\|FOURSQUARE_API_KEY" frontend/src/ | grep -v "node_modules\|.git" | grep -v "import.meta.env"`
Expected: No hardcoded API keys found

- [ ] **Step 3: Create git commit**

```bash
git add .env.example
git commit -m "docs: document YouTube and Foursquare API environment variables"
```

---

## Task 13: Manual testing on mobile and desktop

**Files:**
- None (testing only)

- [ ] **Step 1: Start development server**

Run: `cd frontend && npm run dev`
Expected: Dev server running on localhost:5173

- [ ] **Step 2: Test on mobile (375px viewport)**

Open DevTools, set viewport to iPhone SE (375px), navigate to Step 2 (VenueSelection):
- Verify activity grid shows 3 columns
- Verify YouTube carousel shows 1 card at a time
- Verify "Swipe for more →" hint is visible
- Verify carousel has touch/swipe behavior
- Tap a preset activity, verify it highlights
- Tap "+ Add Custom", verify modal slides up from bottom
- Type custom activity name, submit
- Verify tabs switch between activities
- Verify YouTube videos and venues load for selected activity
- Select a venue, verify checkbox is checked
- Click Continue, verify form submission works

- [ ] **Step 3: Test on desktop (1200px viewport)**

Open DevTools, set viewport to laptop width, navigate to Step 2:
- Verify activity grid still shows 3 columns
- Verify YouTube carousel shows 3 cards visible at once
- Verify "Swipe for more →" hint is hidden
- Verify card sizes are larger (160px height vs 120px mobile)
- Verify all other interactions work same as mobile

- [ ] **Step 4: Test API fallbacks**

With YouTube/Foursquare API keys missing/invalid:
- Verify "No trending videos found" shows instead of crashing
- Verify "No venues found" shows instead of crashing
- Verify user can still proceed to next step

- [ ] **Step 5: Test geolocation fallback**

With IP geolocation service down:
- Verify component still loads with fallback location (US)
- Verify YouTube/Foursquare queries still work with fallback country code

- [ ] **Step 6: Note any bugs found**

If any issues, create git issues or add them to your notes for future fixes. Do NOT proceed with code changes — just document.

---

## Summary

This plan implements the complete VenueSelection redesign with:
- 5 utility modules (geolocation, countryFlags, youtube, foursquare)
- 5 subcomponents (ActivityGrid, ActivityTabs, YouTubeCarousel, VenuesList, CustomInterestModal)
- Complete rewrite of VenueSelection.jsx
- Dark-themed CSS
- Full test coverage per component
- Responsive design (mobile vs desktop carousel)
- IP geolocation for user location analytics
- YouTube API integration for trending videos
- Foursquare API integration for venue suggestions
- Custom interest support via modal
- Multi-select activity support via tabs

Estimated implementation time: 8-12 hours with thorough testing.
