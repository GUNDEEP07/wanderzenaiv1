/**
 * Places for the planner's "Plan your days" step, from GET /recommendations/venues.
 *
 * The backend filters by `activity` and returns categories named "Restaurants", "Cafes",
 * "Markets"… The old client matched singular names ("Restaurant") and so never showed a
 * result; here every category the backend returns for the activity is used.
 */
const API_URL = import.meta.env.VITE_API_URL;

/** Chips in "Browse by category": Foursquare-backed ones use `activity`; the rest ask the
 * (rate-limited) AI search with `query`, and their results are marked as AI ideas. */
export const PLACE_CATEGORIES = [
  { key: 'food', label: 'Food & drink', activity: 'food' },
  { key: 'cafes', label: 'Cafés', activity: 'cafes' },
  { key: 'markets', label: 'Markets', activity: 'markets' },
  { key: 'culture', label: 'Temples & culture', activity: 'culture' },
  { key: 'nature', label: 'Parks & nature', activity: 'nature' },
  { key: 'hiking', label: 'Walks & hikes', activity: 'hiking' },
  { key: 'views', label: 'Views', activity: 'views' },
  { key: 'beaches', label: 'Beaches', query: 'quiet beaches' },
  { key: 'classes', label: 'Classes', query: 'cooking classes and craft workshops' },
  { key: 'wellness', label: 'Wellness', query: 'spa, massage and yoga' },
  { key: 'nightlife', label: 'Nightlife', activity: 'nightlife' },
];

/** One place, whatever the backend sent. */
export function normalizePlace(v, fallbackCategory, source) {
  const name = String(v?.name || '').trim();
  if (!name) return null;
  const src = v.source || source || 'foursquare';
  return {
    id: v.fsq_id || v.id || `${src}:${name.toLowerCase()}`,
    name,
    category: v.category || fallbackCategory || null,
    address: v.address && v.address !== 'Address not available' ? v.address : null,
    lat: typeof v.lat === 'number' ? v.lat : null,
    lng: typeof v.lng === 'number' ? v.lng : null,
    description: v.description || null,
    source: src === 'ai' ? 'ai' : 'foursquare',
  };
}

/** Flattens `{ categories: [{ category, venues, source }] }`, de-duplicated by id. */
export function placesFromResponse(data) {
  const seen = new Set();
  const out = [];
  for (const cat of data?.categories || []) {
    for (const v of cat.venues || []) {
      const p = normalizePlace(v, cat.category, cat.source);
      if (p && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
    }
  }
  return out;
}

async function getVenues(stop, params) {
  if (!stop?.lat || !stop?.lng) return [];
  const q = new URLSearchParams({ destination: stop.name || '', lat: String(stop.lat), lng: String(stop.lng), ...params });
  const res = await fetch(`${API_URL}/recommendations/venues?${q}`);
  if (res.status === 429) throw Object.assign(new Error('Too many searches — try again in a minute.'), { code: 'RATE_LIMIT' });
  if (!res.ok) throw new Error('Could not load places right now.');
  return placesFromResponse(await res.json());
}

/** Places for a category chip at a stop ({ name, lat, lng }). */
export function fetchCategoryPlaces(stop, category) {
  return category.activity
    ? getVenues(stop, { activity: category.activity })
    : getVenues(stop, { query: category.query });
}

/** Free-text search ("banh mi", "rooftop bar") at a stop. */
export function searchPlaces(stop, query) {
  const q = String(query || '').trim().slice(0, 200);
  return q ? getVenues(stop, { query: q }) : Promise.resolve([]);
}
