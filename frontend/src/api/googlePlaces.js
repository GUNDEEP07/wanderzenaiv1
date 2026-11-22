const API_URL = import.meta.env.VITE_API_URL;

/**
 * Google Places must-see ideas for a route stop (GET /places/ideas — live; Google's terms forbid
 * storing their content, so this is kept in memory for this visit only).
 * Resolves to [{ placeId, name, typeLabel, rating, reviews, mapsUri, address, photo, free }];
 * rejects when Google is unavailable so the caller can fall back to other ideas.
 */
const cache = new Map();
export function _clearGoogleIdeas() { cache.clear(); }

export function fetchGoogleIdeas(stop) {
  const params = new URLSearchParams({ name: stop.name || '' });
  if (stop.country) params.set('country', stop.country);
  if (Number.isFinite(stop.lat) && Number.isFinite(stop.lng)) {
    params.set('lat', stop.lat.toFixed(4));
    params.set('lng', stop.lng.toFixed(4));
  }
  const key = params.toString();
  if (!cache.has(key)) {
    const p = fetch(`${API_URL}/places/ideas?${key}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Google ideas ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.ideas)) throw new Error('bad ideas');
        return data.ideas;
      })
      .catch((e) => { cache.delete(key); throw e; });
    cache.set(key, p);
  }
  return cache.get(key);
}

/** <img src> for a Google photo (our API redirects to a short-lived Google URL). */
export function googlePhotoSrc(photoName, width = 480) {
  return `${API_URL}/places/photo?${new URLSearchParams({ name: photoName, w: String(width) })}`;
}

/** "★ 4.8 (1,236)" */
export function ratingText(rating, reviews) {
  if (typeof rating !== 'number') return '';
  return `★ ${rating.toFixed(1)}${reviews ? ` (${reviews.toLocaleString('en-AU')})` : ''}`;
}
