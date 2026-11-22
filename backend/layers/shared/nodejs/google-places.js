'use strict';

/**
 * Google Places API (New) client — chosen by Gundeep Nov 22 2026 ("Both": Google picks the
 * must-sees and checks every place in a finished trip).
 *
 * Google's terms (Places API policies): content may NOT be stored or cached; only the place ID is
 * exempt and may be kept indefinitely. So this module only ever returns live results for the
 * caller to use within the request, and callers persist `placeId` at most. Results shown without a
 * Google map need "Google Maps" attribution, and photos need their authors credited.
 *
 * Quality bar (chosen by Gundeep): food and paid places need ≥4.2★ from 30+ reviews; walks,
 * parks, viewpoints and other free sights only need to exist and be open.
 */

const BASE = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = 6000;

// Text Search (New) field masks. rating / userRatingCount / regularOpeningHours are Enterprise
// fields, so every call that applies the quality bar is billed as Text Search Enterprise.
const CHECK_FIELDS = [
  'places.id', 'places.displayName', 'places.businessStatus', 'places.rating', 'places.userRatingCount',
  'places.primaryType', 'places.primaryTypeDisplayName', 'places.types', 'places.googleMapsUri', 'places.location',
];
const IDEA_FIELDS = [...CHECK_FIELDS, 'places.photos', 'places.shortFormattedAddress'];

// Free sights: no rating bar (a lake with 14 reviews is still worth a walk).
const FREE_TYPES = new Set([
  'park', 'hiking_area', 'national_park', 'state_park', 'beach', 'garden', 'botanical_garden', 'natural_feature',
  'scenic_spot', 'observation_deck', 'lake', 'river', 'waterfall', 'island', 'mountain_peak', 'nature_preserve',
  'wildlife_refuge', 'picnic_ground', 'plaza', 'historical_landmark', 'historical_place', 'monument', 'church',
  'place_of_worship', 'hindu_temple', 'buddhist_temple', 'mosque', 'synagogue', 'shinto_shrine', 'town_square',
  'cultural_landmark', 'sculpture', 'dog_park', 'marina', 'woods', 'vineyard',
]);
const MIN_RATING = 4.2;
const MIN_REVIEWS = 30;

const PLACE_ID_RE = /^[A-Za-z0-9_-]{10,300}$/;
const PHOTO_NAME_RE = /^places\/[A-Za-z0-9_-]{10,300}\/photos\/[A-Za-z0-9_-]{10,600}$/;

function apiKey() {
  return process.env.GOOGLE_PLACES_API_KEY || '';
}
function enabled() {
  return !!apiKey();
}

/** One place from Text Search, in our shape (live use only — never store anything but placeId). */
function normalize(p) {
  if (!p || typeof p !== 'object' || !p.id) return null;
  const photo = Array.isArray(p.photos) && p.photos[0]
    ? {
      name: p.photos[0].name,
      authors: (p.photos[0].authorAttributions || []).slice(0, 2).map((a) => ({ name: a.displayName || '', uri: a.uri || null })),
    }
    : null;
  return {
    placeId: p.id,
    name: p.displayName?.text || '',
    status: p.businessStatus || null,
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviews: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
    primaryType: p.primaryType || null,
    typeLabel: p.primaryTypeDisplayName?.text || null,
    types: Array.isArray(p.types) ? p.types : [],
    mapsUri: p.googleMapsUri || null,
    address: p.shortFormattedAddress || null,
    location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
    photo,
  };
}

function isFreeSight(place) {
  const types = [place.primaryType, ...(place.types || [])].filter(Boolean);
  return types.some((t) => FREE_TYPES.has(t));
}

/** The quality bar. Closed places always fail. */
function passesBar(place) {
  if (!place) return false;
  if (place.status && place.status !== 'OPERATIONAL') return false;
  if (isFreeSight(place)) return true;
  return (place.rating || 0) >= MIN_RATING && (place.reviews || 0) >= MIN_REVIEWS;
}

/** Why a place fails, for logs and the generator's fix pass. */
function barReason(place) {
  if (!place) return 'not found on Google';
  if (place.status === 'CLOSED_PERMANENTLY') return 'permanently closed';
  if (place.status === 'CLOSED_TEMPORARILY') return 'temporarily closed';
  if (!isFreeSight(place) && !passesBar(place)) return `rated ${place.rating ?? 'n/a'} from ${place.reviews} reviews`;
  return null;
}

/**
 * Text Search (New). `bias`: { lat, lng, radiusM } prefers results near a stop.
 * Returns normalized places, [] when Google finds nothing; throws on HTTP/network errors.
 */
async function searchText(textQuery, { fields = CHECK_FIELDS, pageSize = 5, bias = null, fetchImpl = fetch } = {}) {
  const key = apiKey();
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY not set');
  const body = { textQuery: String(textQuery).slice(0, 200), pageSize: Math.max(1, Math.min(20, pageSize)) };
  if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
    body.locationBias = { circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: Math.min(50000, bias.radiusM || 30000) } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields.join(',') },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Google Places ${res.status}: ${t.slice(0, 160)}`);
    }
    const data = await res.json();
    return (data.places || []).map(normalize).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Does Google's top hit plausibly name the same place we asked about? */
function sameName(asked, got) {
  const a = norm(asked), g = norm(got);
  if (!a || !g) return false;
  if (a === g || g.includes(a) || a.includes(g)) return true;
  const aw = new Set(a.split(' ').filter((w) => w.length > 2));
  const gw = g.split(' ').filter((w) => w.length > 2);
  if (!aw.size || !gw.length) return false;
  const shared = gw.filter((w) => aw.has(w)).length;
  return shared / Math.min(aw.size, gw.length) >= 0.6;
}

/**
 * Check one named place in a town. Returns { place, ok, reason }:
 * place = Google's match (null when nothing plausible), ok = passes the bar.
 */
async function checkPlace(name, town, { bias = null, fetchImpl } = {}) {
  const hits = await searchText(`${name}, ${town}`, { fields: CHECK_FIELDS, pageSize: 3, bias, fetchImpl });
  const place = hits.find((h) => sameName(name, h.name)) || null;
  const reason = barReason(place);
  return { place, ok: !reason, reason };
}

const KM = (a, b) => {
  if (!a || !b) return 0;
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
};

/** Theme searches for a stop's must-see ideas (walks/views, cafés, gems). */
function ideaQueries(place) {
  return [
    `scenic walks and viewpoints near ${place}`,
    `local cafes and bakeries in ${place}`,
    `hidden gems and things to do in ${place}`,
  ];
}

/**
 * Must-see ideas for a stop: three theme searches near it, quality bar applied, at most ~40 km
 * away, de-duplicated, then interleaved so the list mixes walks, food and sights. Live only.
 */
async function ideasNear({ name, country, lat, lng }, { perQuery = 8, count = 6, maxKm = 40, fetchImpl } = {}) {
  const place = [name, country].filter(Boolean).join(', ');
  const center = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const lists = await Promise.all(ideaQueries(place).map((q) => searchText(q, {
    fields: IDEA_FIELDS, pageSize: perQuery, bias: center ? { ...center, radiusM: maxKm * 1000 } : null, fetchImpl,
  }).catch(() => [])));
  const seen = new Set();
  const clean = lists.map((list) => list.filter((p) => {
    if (seen.has(p.placeId) || !passesBar(p)) return false;
    if (center && p.location && KM(center, p.location) > maxKm) return false;
    if (/^(locality|administrative_area|country|political|lodging|hotel)/.test(p.primaryType || '')) return false;
    seen.add(p.placeId);
    return true;
  }).sort((a, b) => score(b) - score(a)));
  const out = [];
  for (let i = 0; out.length < count && i < perQuery; i += 1) {
    for (const list of clean) {
      if (list[i] && out.length < count) out.push(list[i]);
    }
  }
  return out;
}
const score = (p) => (p.rating || 4) * Math.log10(10 + (p.reviews || 0));

/** Short-lived photo URL for a photo resource name (Place Photos). Live only — never store it. */
async function photoUri(photoName, { maxWidthPx = 480, fetchImpl = fetch } = {}) {
  if (!PHOTO_NAME_RE.test(String(photoName || ''))) throw new Error('bad photo name');
  const key = apiKey();
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY not set');
  const w = Math.max(120, Math.min(1600, Number(maxWidthPx) || 480));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${BASE}/${photoName}/media?maxWidthPx=${w}&skipHttpRedirect=true`, {
      headers: { 'X-Goog-Api-Key': key }, signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Google photo ${res.status}`);
    const data = await res.json();
    if (!/^https:\/\/[a-z0-9.-]+\.(googleusercontent|ggpht|google)\.com\//.test(String(data.photoUri || ''))) throw new Error('unexpected photo url');
    return data.photoUri;
  } finally {
    clearTimeout(timer);
  }
}

/** Google Maps link for a place we keep only the ID of (the documented URL scheme). */
function mapsUrlFor(name, placeId) {
  const q = encodeURIComponent(String(name || 'place').slice(0, 120));
  return PLACE_ID_RE.test(String(placeId || ''))
    ? `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${placeId}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

module.exports = {
  enabled, searchText, checkPlace, ideasNear, photoUri, mapsUrlFor,
  passesBar, barReason, isFreeSight, sameName, normalize,
  PLACE_ID_RE, PHOTO_NAME_RE, MIN_RATING, MIN_REVIEWS, CHECK_FIELDS, IDEA_FIELDS,
};
