# Explore Page Dynamic Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Explore page dynamic with Unsplash photos (placeholder key), live destination insights on country expand, personalisation for logged-in users, and a seasonal context banner.

**Architecture:** Two file changes — a new `destinationPhotos.js` utility centralises all photo lookups, and `ExplorePage.jsx` gains 5 enhancements using existing API endpoints (`/destination-insights`, `/recommendations/personalised`, `/recommendations`). No new backend endpoints needed.

**Tech Stack:** React 18, Vite, existing Unsplash source URLs (placeholder), `/destination-insights` Lambda (existing), `/recommendations/personalised` (existing)

---

## File Map

| File | Action |
|---|---|
| `frontend/src/utils/destinationPhotos.js` | **Create** — photo utility with known map + fallback |
| `frontend/src/pages/ExplorePage.jsx` | Modify — 5 changes: fix trending, seasonal banner, personalisation, country insights badges, place photo cards |

---

## Task 1: Create destinationPhotos.js utility

**Files:**
- Create: `frontend/src/utils/destinationPhotos.js`

- [ ] **Step 1: Create the file**

Create `frontend/src/utils/destinationPhotos.js` with this exact content:

```js
// Unsplash photo utility
// Set VITE_UNSPLASH_ACCESS_KEY in .env.local when API key is available
// TODO: implement async API version using:
//   GET https://api.unsplash.com/search/photos?query={keyword}&per_page=1
//   Header: Authorization: Client-ID {VITE_UNSPLASH_ACCESS_KEY}
// Until then: uses known photo IDs map + source.unsplash.com fallback

const BASE = 'https://images.unsplash.com';
const SOURCE = 'https://source.unsplash.com';

const KNOWN_PHOTOS = {
  kyoto:      'photo-1493976040374-85c8e12f0c0e',
  tokyo:      'photo-1540959733332-eab4deabeeaf',
  bali:       'photo-1537996194471-e657df975ab4',
  paris:      'photo-1499856871958-5b9627545d1a',
  rome:       'photo-1552832230-c0197dd311b5',
  barcelona:  'photo-1539037116277-4db20889f2d4',
  amsterdam:  'photo-1534351590666-13e3e96b5017',
  london:     'photo-1513635269975-59663e0ac1ad',
  bangkok:    'photo-1563492065599-3520f775eeed',
  singapore:  'photo-1525625293386-3f8f99389edd',
  dubai:      'photo-1512453979798-5ea266f8880c',
  oaxaca:     'photo-1518638150340-f706e86654de',
  vietnam:    'photo-1528360983277-13d401cdc186',
  shimla:     'photo-1605649461784-bbb68578a55e',
  goa:        'photo-1512343879784-a960bf40e7f2',
  manali:     'photo-1626516011116-33bba50ec8ce',
  morocco:    'photo-1539020140153-e479b8c22e70',
  portugal:   'photo-1555881400-74d7acaacd8b',
  greece:     'photo-1533105079780-92b9be482077',
  nepal:      'photo-1544735716-392fe2489ffa',
  peru:       'photo-1526392060635-9d6019884377',
  japan:      'photo-1528360983277-13d401cdc186',
  india:      'photo-1524492412937-b28074a5d7da',
  indonesia:  'photo-1537996194471-e657df975ab4',
  thailand:   'photo-1528181304800-259b08848526',
  italy:      'photo-1516483638261-f4dbaf036963',
  spain:      'photo-1539037116277-4db20889f2d4',
  france:     'photo-1499856871958-5b9627545d1a',
  georgia:    'photo-1601974984960-4e1d498e3b2f',
  jordan:     'photo-1548199973-03cce0bbc87b',
  oman:       'photo-1578662996442-48f60103fc96',
  chile:      'photo-1501854140801-50d01698950b',
  colombia:   'photo-1576019280693-5a56c25d8dc6',
  mexico:     'photo-1518638150340-f706e86654de',
  iceland:    'photo-1504893524553-b855bce32c67',
  norway:     'photo-1501854140801-50d01698950b',
  albania:    'photo-1598300058816-b7cef6d4c90c',
  slovenia:   'photo-1587974928442-77dc3e0dba72',
  croatia:    'photo-1555990793-da11153b2473',
  'new york': 'photo-1485738422979-f5c462d49f74',
};

const SIZES = { card: [320, 180], hero: [800, 500], thumb: [200, 130] };

export function getDestinationPhoto(destination = '', keyword = '', size = 'card') {
  const [w, h] = SIZES[size] || SIZES.card;
  const name = (destination.split(',')[0].trim() || keyword.split(' ')[0] || '').toLowerCase();

  for (const [key, id] of Object.entries(KNOWN_PHOTOS)) {
    if (name.includes(key) || key.includes(name)) {
      return `${BASE}/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
    }
  }

  const q = encodeURIComponent(keyword || name || 'travel landscape');
  return `${SOURCE}/${w}x${h}/?${q}&auto=format`;
}

export function getFallbackPhoto(size = 'card') {
  const [w, h] = SIZES[size] || SIZES.card;
  return `${BASE}/photo-1469854523086-cc02fe5d8800?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 3: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/utils/destinationPhotos.js && git commit -m "feat: destinationPhotos utility — Unsplash photo lookup with known map + source fallback"
```

---

## Task 2: Update ExplorePage.jsx — all 5 improvements

**Files:**
- Modify: `frontend/src/pages/ExplorePage.jsx`

**READ THE FILE FIRST** — it is ~350 lines. Confirm exact line numbers before editing.

---

- [ ] **Step 1: Add imports**

At the top of `ExplorePage.jsx`, after the existing imports, add:

```jsx
import { useAuth } from '../context/AuthContext';
import { getDestinationPhoto, getFallbackPhoto } from '../utils/destinationPhotos';
```

---

- [ ] **Step 2: Add state + effects for personalisation and country insights**

In the component body, find the existing state declarations. After `const [apiCountries, setApiCountries] = useState({});` add:

```jsx
const { currentUser, getIdToken } = useAuth();
const [personalRecs, setPersonalRecs] = useState([]);
const [countryInsights, setCountryInsights] = useState(null);
```

After the existing `useEffect` blocks, add two new effects:

```jsx
// Personalised recommendations for logged-in users
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

// Live destination insights when a country is expanded
useEffect(() => {
  if (!activeCountry) { setCountryInsights(null); return; }
  const start = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];
  const end   = new Date(Date.now() + 67 * 86400000).toISOString().split('T')[0];
  fetch(`${API_URL}/destination-insights?destination=${encodeURIComponent(activeCountry)}&startDate=${start}&endDate=${end}`)
    .then(r => r.json())
    .then(d => { if (d.insights) setCountryInsights(d.insights); })
    .catch(() => {});
}, [activeCountry]);
```

---

- [ ] **Step 3: Add MONTH_PICKS constant**

After the existing `TRENDING` constant (search for `const TRENDING = [`), add:

```jsx
const MONTH_PICKS = {
  0:  { label: 'January',   picks: ['Morocco', 'Thailand', 'New Zealand'],    tip: 'Escape winter — North Africa and Southeast Asia are at their best' },
  1:  { label: 'February',  picks: ['Japan', 'Jordan', 'Colombia'],           tip: 'Cherry blossom season begins in Japan' },
  2:  { label: 'March',     picks: ['Portugal', 'Vietnam', 'Peru'],           tip: 'Shoulder season gold — before the crowds arrive' },
  3:  { label: 'April',     picks: ['Japan', 'Italy', 'Nepal'],               tip: 'Ideal hiking weather in Nepal and Tuscany' },
  4:  { label: 'May',       picks: ['Greece', 'Georgia', 'Ireland'],          tip: 'Peak wildflower season before summer crowds' },
  5:  { label: 'June',      picks: ['Iceland', 'Norway', 'Albania'],          tip: 'Endless daylight in Scandinavia, the Balkans opening up' },
  6:  { label: 'July',      picks: ['Chile', 'Morocco', 'Oman'],              tip: 'Southern hemisphere winter is perfect for Patagonia' },
  7:  { label: 'August',    picks: ['Croatia', 'Slovenia', 'Colombia'],       tip: 'The Balkans are quieter than Italy this month' },
  8:  { label: 'September', picks: ['Bali', 'Nepal', 'Portugal'],             tip: 'Dry season returns to Southeast Asia — best month for Bali' },
  9:  { label: 'October',   picks: ['Japan', 'Vietnam', 'Ethiopia'],          tip: 'Autumn foliage in Japan, cool season in Vietnam' },
  10: { label: 'November',  picks: ['India', 'Tanzania', 'Peru'],             tip: 'Post-monsoon magic in India and East Africa' },
  11: { label: 'December',  picks: ['New Zealand', 'Colombia', 'Thailand'],   tip: 'Southern summer — New Zealand is at its absolute best' },
};
```

---

- [ ] **Step 4: Fix trending card — remove Amadeus dead code + add photo fallback**

Find the trending cards rendering (search for `amadeus_score`). It currently has:

```jsx
{(apiTrending.length ? apiTrending.map(t => ({ dest: t.destination + ', ' + t.country, img: t.image_url, trend: t.amadeus_score > 80 ? `Score ${t.amadeus_score}/100` : 'Recommended' })) : TRENDING).map(t => (
```

Replace with:

```jsx
{(apiTrending.length ? apiTrending.map(t => ({ dest: t.destination + (t.country ? `, ${t.country}` : ''), img: t.image_url || getDestinationPhoto(t.destination || '', '', 'card'), trend: t.count ? `${t.count} travelers` : 'Trending' })) : TRENDING).map(t => (
```

Also in the `<img src=...>` inside the card, change to add a fallback:
```jsx
src={t.img || getDestinationPhoto(t.dest, '', 'card')}
```
And add `onError` to the image:
```jsx
onError={e => { e.target.src = getFallbackPhoto('card'); }}
```

---

- [ ] **Step 5: Add seasonal banner**

Find the return statement's first section — the hero div. After the hero section closing `</div>` (the one containing the `<h1>` and description paragraph) and BEFORE the trending section `<div style={{ padding: '0 2rem 4rem'...`, insert:

```jsx
{/* Seasonal context banner */}
{(() => {
  const month = MONTH_PICKS[new Date().getMonth()];
  return (
    <div style={{ background: 'rgba(0,212,170,0.04)', borderTop: `1px solid ${border}`, borderBottom: `1px solid ${border}`, padding: '12px 2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: teal, flexShrink: 0 }}>
          🗓 {month.label} picks
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', flex: 1, minWidth: 200 }}>
          {month.tip}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

- [ ] **Step 6: Add personalisation strip**

After the seasonal banner (and BEFORE the trending section), add the personalisation strip:

```jsx
{/* Personalised recommendations for logged-in users */}
{personalRecs.length > 0 && (
  <div style={{ padding: '3rem 2rem', borderBottom: `1px solid ${border}` }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: teal, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 24, height: 1, background: teal, display: 'inline-block' }} />
        ✦ Picked for you
      </div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 'clamp(1.25rem,2.5vw,1.75rem)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', marginBottom: '1.25rem', lineHeight: 1.1 }}>
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
                src={getDestinationPhoto(rec.destination || '', '', 'card')}
                alt={rec.destination}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { e.target.src = getFallbackPhoto('card'); }}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,15,30,0.9), transparent 60%)' }} />
              <div style={{ position: 'absolute', bottom: 8, left: 12, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                {rec.destination?.split(',')[0]}
              </div>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: 8 }}>{rec.reason}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: teal }}>Plan this →</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

---

- [ ] **Step 7: Enhance expanded country panel with insights + photo cards**

Find the `{country && (...)}` expanded country block. Inside it, make these changes:

**7a.** After the header div (the one containing "Top places in {country.name}" and "Plan {country.name} trip" button), add the insight badges:

```jsx
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
      <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', fontSize: 11, fontWeight: 700, color: teal }}>
        🗓 Best: {countryInsights.bestMonths.slice(0, 2).join(' & ')}
      </span>
    )}
  </div>
)}
```

**7b.** Replace the existing places chip grid (the `<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))'...>` with photo cards:

Find and replace the entire places grid block with:

```jsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: countryInsights?.thingsToDo?.length ? 16 : 0 }}>
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

**7c.** After the places grid, add AI things-to-do from insights:

```jsx
{countryInsights?.thingsToDo?.length > 0 && (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
      AI curated experiences
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {countryInsights.thingsToDo.slice(0, 3).map((thing, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${border}`, borderRadius: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={getDestinationPhoto(thing.name || '', thing.unsplashKeyword || '', 'thumb')}
              alt={thing.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.src = getFallbackPhoto('thumb'); }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{thing.emoji} {thing.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thing.reason}</div>
          </div>
          {thing.openingHours && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', flexShrink: 0, paddingTop: 2 }}>🕐 {thing.openingHours.split(',')[0]}</div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

- [ ] **Step 8: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 9: Commit and push**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/ExplorePage.jsx && git commit -m "feat: Explore page — Unsplash photos, seasonal banner, personalisation, live country insights" && git push origin main
```

---

## Done

2 commits. The Explore page now:
- Shows photo cards for each place in the expanded country panel (Unsplash, curated + fallback)
- Loads live destination insights (weather, crowd level, best months, AI picks) when a country is expanded
- Shows a "For you" personalisation section for logged-in users
- Displays a seasonal context banner with current-month destination picks
- Trending cards use real traveler counts instead of dead Amadeus score code
