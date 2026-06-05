# Explore Page — Dynamic Insights + Unsplash Photos

**Date:** 2026-06-05
**Status:** Approved, ready for implementation

---

## Overview

Make the Explore page dynamic and insight-driven by: fixing dead Amadeus trending code, adding Unsplash photo support (placeholder key), showing live destination insights when a country is expanded, adding a personalisation strip for logged-in users, and adding a seasonal context banner.

---

## Change 1: `getDestinationPhoto` utility

**File:** `frontend/src/utils/destinationPhotos.js` (new)

Centralises all destination photo lookups across the app. Currently photos are scattered — hardcoded Unsplash photo IDs in `Dashboard.jsx` (`getDestinationPhotoUrl`), country-level images in `ExplorePage.jsx` COUNTRIES object, `source.unsplash.com` in `AccommodationSection.jsx`.

```js
// Unsplash Access Key — replace with real key when provided
// Set VITE_UNSPLASH_ACCESS_KEY in .env.local
// When key is present, uses official /search/photos API for better reliability
// Without key, falls back to source.unsplash.com keyword search (functional but deprecated)
const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY || '';

// Known destinations → reliable Unsplash photo IDs (curated, no API call needed)
const KNOWN_PHOTOS = {
  'kyoto':      'photo-1493976040374-85c8e12f0c0e',
  'tokyo':      'photo-1540959733332-eab4deabeeaf',
  'bali':       'photo-1537996194471-e657df975ab4',
  'paris':      'photo-1499856871958-5b9627545d1a',
  'rome':       'photo-1552832230-c0197dd311b5',
  'barcelona':  'photo-1539037116277-4db20889f2d4',
  'amsterdam':  'photo-1534351590666-13e3e96b5017',
  'london':     'photo-1513635269975-59663e0ac1ad',
  'bangkok':    'photo-1563492065599-3520f775eeed',
  'singapore':  'photo-1525625293386-3f8f99389edd',
  'dubai':      'photo-1512453979798-5ea266f8880c',
  'new york':   'photo-1485738422979-f5c462d49f74',
  'oaxaca':     'photo-1518638150340-f706e86654de',
  'vietnam':    'photo-1528360983277-13d401cdc186',
  'shimla':     'photo-1605649461784-bbb68578a55e',
  'goa':        'photo-1512343879784-a960bf40e7f2',
  'manali':     'photo-1626516011116-33bba50ec8ce',
  'morocco':    'photo-1539020140153-e479b8c22e70',
  'portugal':   'photo-1555881400-74d7acaacd8b',
  'greece':     'photo-1533105079780-92b9be482077',
  'nepal':      'photo-1544735716-392fe2489ffa',
  'peru':       'photo-1526392060635-9d6019884377',
  'japan':      'photo-1528360983277-13d401cdc186',
  'india':      'photo-1524492412937-b28074a5d7da',
  'indonesia':  'photo-1537996194471-e657df975ab4',
  'thailand':   'photo-1528181304800-259b08848526',
  'italy':      'photo-1516483638261-f4dbaf036963',
  'spain':      'photo-1539037116277-4db20889f2d4',
  'france':     'photo-1499856871958-5b9627545d1a',
  'georgia':    'photo-1601974984960-4e1d498e3b2f',
  'jordan':     'photo-1548199973-03cce0bbc87b',
  'oman':       'photo-1578662996442-48f60103fc96',
  'chile':      'photo-1501854140801-50d01698950b',
  'colombia':   'photo-1576019280693-5a56c25d8dc6',
  'mexico':     'photo-1518638150340-f706e86654de',
  'iceland':    'photo-1504893524553-b855bce32c67',
  'norway':     'photo-1501854140801-50d01698950b',
  'albania':    'photo-1598300058816-b7cef6d4c90c',
  'slovenia':   'photo-1587974928442-77dc3e0dba72',
  'croatia':    'photo-1555990793-da11153b2473',
};

const BASE = 'https://images.unsplash.com';
const SOURCE = 'https://source.unsplash.com';

/**
 * Returns a photo URL for a destination.
 * - Checks KNOWN_PHOTOS map first (no API call, instant)
 * - Falls back to source.unsplash.com keyword search
 * - When VITE_UNSPLASH_ACCESS_KEY is set, uses official API (better reliability)
 *
 * @param {string} destination  e.g. "Bali, Indonesia" or "Kyoto"
 * @param {string} [keyword]    optional override search keyword e.g. "kyoto temple"
 * @param {string} [size]       "card" (320×180) | "hero" (800×500) | "thumb" (200×130)
 */
export function getDestinationPhoto(destination = '', keyword = '', size = 'card') {
  const sizes = { card: '320x180', hero: '800x500', thumb: '200x130' };
  const dim = sizes[size] || sizes.card;
  const [w, h] = dim.split('x');

  // Normalise: take first segment before comma, lowercase
  const name = (destination.split(',')[0].trim() || keyword.split(' ')[0]).toLowerCase();

  // Check known photos map
  for (const [key, id] of Object.entries(KNOWN_PHOTOS)) {
    if (name.includes(key) || key.includes(name)) {
      return `${BASE}/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
    }
  }

  // Unsplash official API (when key is configured)
  // TODO: implement async version once VITE_UNSPLASH_ACCESS_KEY is provided
  // Endpoint: GET https://api.unsplash.com/search/photos?query={keyword}&per_page=1
  // Header: Authorization: Client-ID {UNSPLASH_KEY}
  // Returns: results[0].urls.regular

  // Fallback: source.unsplash.com keyword search
  const q = encodeURIComponent(keyword || name || 'travel landscape');
  return `${SOURCE}/${dim}/?${q}&auto=format`;
}

/**
 * Returns a generic travel fallback photo.
 */
export function getFallbackPhoto(size = 'card') {
  const sizes = { card: '320x180', hero: '800x500', thumb: '200x130' };
  const dim = sizes[size] || sizes.card;
  const [w, h] = dim.split('x');
  return `${BASE}/photo-1469854523086-cc02fe5d8800?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
}
```

---

## Change 2: Fix trending section — remove Amadeus dead code

**File:** `frontend/src/pages/ExplorePage.jsx`

Current: `t.amadeus_score > 80 ? \`Score ${t.amadeus_score}/100\` : 'Recommended'` — Amadeus was removed.

Replace the trending card rendering to use `getDestinationPhoto` for images and sensible labels:

```js
// Replace the trending card photo src:
src={t.img || getDestinationPhoto(t.dest, '', 'card')}

// Replace the trend label logic:
const trendLabel = t.count ? `${t.count} travelers` : t.trend || 'Recommended';
```

Also import `getDestinationPhoto` at the top of ExplorePage.jsx.

---

## Change 3: Expanded country panel — live insights + place photos

**File:** `frontend/src/pages/ExplorePage.jsx`

When `country` is expanded (the `{country && (...)}` block), replace the plain chip list with a richer panel:

### 3a. Load insights on expand

Add state: `const [countryInsights, setCountryInsights] = useState(null);`

Add effect watching `activeCountry`:
```js
useEffect(() => {
  if (!activeCountry) return;
  setCountryInsights(null);
  const country = countries.find(c => c.name === activeCountry);
  if (!country) return;
  // Use default dates: 60 days from now
  const start = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  const end   = new Date(Date.now() + 67 * 86400000).toISOString().split('T')[0];
  fetch(`${API_URL}/destination-insights?destination=${encodeURIComponent(country.name)}&startDate=${start}&endDate=${end}`)
    .then(r => r.json())
    .then(d => { if (d.insights) setCountryInsights(d.insights); })
    .catch(() => {});
}, [activeCountry]);
```

### 3b. Insight badges in the expanded panel header

```jsx
{/* Weather + crowd badges */}
{countryInsights && (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
    {countryInsights.weather && (
      <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>
        ☀️ {countryInsights.weather.split(/[,(]/)[0].trim()}
      </span>
    )}
    {countryInsights.crowdLevel && (
      <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(255,217,61,0.08)', border: '1px solid rgba(255,217,61,0.2)', fontSize: 11, fontWeight: 700, color: '#ffd93d' }}>
        👥 {countryInsights.crowdLevel} crowds
      </span>
    )}
    {countryInsights.bestMonths?.slice(0, 2).length > 0 && (
      <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', fontSize: 11, fontWeight: 700, color: '#00d4aa' }}>
        🗓 Best: {countryInsights.bestMonths.slice(0, 2).join(' & ')}
      </span>
    )}
  </div>
)}
```

### 3c. Replace plain chip list with photo cards for places

Replace the `country.places.map(...)` chip grid with a photo card grid:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 16 }}>
  {country.places.map((place) => (
    <div
      key={place}
      onClick={() => startPlan(`${place}, ${country.name}`)}
      style={{ borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${border}`, transition: 'all 0.2s', position: 'relative', aspectRatio: '4/3' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = teal; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'none'; }}
    >
      <img
        src={getDestinationPhoto(`${place}, ${country.name}`, place.toLowerCase(), 'thumb')}
        alt={place}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={e => { e.target.src = getFallbackPhoto('thumb'); }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.9) 0%, rgba(10,15,30,0.1) 60%, transparent 100%)' }} />
      <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{place}</div>
        <div style={{ fontSize: 10, color: teal, marginTop: 2 }}>Plan this →</div>
      </div>
    </div>
  ))}
</div>
```

### 3d. AI things-to-do section (from insights)

Below the places grid, if insights are loaded, show up to 3 `thingsToDo` items:

```jsx
{countryInsights?.thingsToDo?.length > 0 && (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
      Curated experiences
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {countryInsights.thingsToDo.slice(0, 3).map((thing, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}`, borderRadius: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={getDestinationPhoto(thing.name, thing.unsplashKeyword || thing.name, 'thumb')}
              alt={thing.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.src = getFallbackPhoto('thumb'); }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{thing.emoji} {thing.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thing.reason}</div>
          </div>
          {thing.openingHours && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>🕐 {thing.openingHours.split(',')[0]}</div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

## Change 4: Seasonal context banner

**File:** `frontend/src/pages/ExplorePage.jsx`

Add a thin contextual banner between the hero and trending sections. Client-side, month-based lookup — no API call needed.

```js
const MONTH_PICKS = {
  0:  { label: 'January',   picks: ['Morocco', 'Thailand', 'New Zealand'],    tip: 'Escape winter — North Africa + Southeast Asia are at their best' },
  1:  { label: 'February',  picks: ['Japan', 'Jordan', 'Colombia'],           tip: 'Cherry blossom season begins in Japan' },
  2:  { label: 'March',     picks: ['Portugal', 'Vietnam', 'Peru'],           tip: 'Shoulder season gold — before the crowds arrive' },
  3:  { label: 'April',     picks: ['Japan', 'Italy', 'Nepal'],               tip: 'Ideal hiking weather in Nepal and Tuscany' },
  4:  { label: 'May',       picks: ['Greece', 'Georgia', 'Ireland'],          tip: 'Peak wildflower season before summer crowds' },
  5:  { label: 'June',      picks: ['Iceland', 'Norway', 'Albania'],          tip: 'Endless daylight in Scandinavia and the Balkans opening up' },
  6:  { label: 'July',      picks: ['Chile', 'Morocco', 'Oman'],              tip: 'Southern hemisphere winter is perfect for Patagonia' },
  7:  { label: 'August',    picks: ['Croatia', 'Slovenia', 'Colombia'],       tip: 'Mediterranean peak — the Balkans are quieter than Italy' },
  8:  { label: 'September', picks: ['Bali', 'Nepal', 'Portugal'],             tip: 'Dry season returns to Southeast Asia — best month for Bali' },
  9:  { label: 'October',   picks: ['Japan', 'Vietnam', 'Ethiopia'],         tip: 'Autumn foliage in Japan, cool season in Vietnam' },
  10: { label: 'November',  picks: ['India', 'Tanzania', 'Peru'],             tip: 'Post-monsoon magic in India and East Africa' },
  11: { label: 'December',  picks: ['New Zealand', 'Colombia', 'Thailand'],   tip: 'Southern summer — New Zealand is at its absolute best' },
};
```

Banner JSX (add between hero div and trending section):
```jsx
{(() => {
  const month = MONTH_PICKS[new Date().getMonth()];
  return (
    <div style={{ background: 'rgba(0,212,170,0.04)', borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '12px 2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: teal, flexShrink: 0 }}>
          🗓 {month.label} picks
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', flex: 1 }}>
          {month.tip}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {month.picks.map(p => (
            <button key={p} type="button" onClick={() => startPlan(p)}
              style={{ padding: '5px 12px', borderRadius: 20, background: tealGlow, border: `1px solid ${tealBorder}`, fontSize: 12, fontWeight: 700, color: teal, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
})()}
```

---

## Change 5: Personalisation strip for logged-in users

**File:** `frontend/src/pages/ExplorePage.jsx`

Add `useAuth` import and fetch `/recommendations/personalised` for logged-in users. Show a "For you" section between the seasonal banner and the trending section.

```jsx
// Add at top of component:
const { currentUser, getIdToken } = useAuth();
const [personalRecs, setPersonalRecs] = useState([]);

// Add useEffect:
useEffect(() => {
  if (!currentUser) return;
  (async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${API_URL}/recommendations/personalised`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.recommendations?.length) setPersonalRecs(d.recommendations.slice(0, 4));
    } catch { /* graceful */ }
  })();
}, [currentUser]);
```

Render section (if `personalRecs.length > 0`):
```jsx
{personalRecs.length > 0 && (
  <div style={{ padding: '3rem 2rem', borderBottom: `1px solid ${border}` }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 24, height: 1, background: teal, display: 'inline-block' }} />
        ✦ Picked for you
      </div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.25rem,2.5vw,1.75rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: '1.25rem' }}>
        Based on your travel history
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {personalRecs.map((rec, i) => (
          <div
            key={i}
            onClick={() => startPlan(rec.destination)}
            style={{ borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: `1px solid ${border}`, background: navy3, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = tealBorder; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = 'none'; }}
          >
            <div style={{ height: 120, position: 'relative', overflow: 'hidden' }}>
              <img
                src={getDestinationPhoto(rec.destination, '', 'card')}
                alt={rec.destination}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.src = getFallbackPhoto('card'); }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.9), transparent 60%)' }} />
              <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {rec.destination?.split(',')[0]}
              </div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{rec.reason}</div>
              <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: teal }}>Plan this →</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

---

## Files changed

| File | Action |
|---|---|
| `frontend/src/utils/destinationPhotos.js` | **Create** |
| `frontend/src/pages/ExplorePage.jsx` | Modify — all 5 changes above |

## Out of scope

- Official Unsplash API integration (placeholder only — key to be provided separately)
- Search bar with AI (separate sprint)
- New backend endpoints (all data comes from existing APIs)
