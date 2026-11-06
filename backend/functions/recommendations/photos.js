'use strict';

/**
 * GET /photos/search?query=… — Unsplash photo search through our backend.
 *
 * Why a proxy (Unsplash API Guidelines, help.unsplash.com/en/articles/2511245):
 *   - the Access Key must stay confidential — it was shipped in the frontend bundle;
 *   - the demo key allows 50 requests/hour for the whole app, so results are cached in
 *     Postgres (photo_cache, 30 days; misses 1 day) and most page views cost no API call.
 * What the response carries so the frontend can meet the other guidelines:
 *   - url: the hotlinked photo.urls.regular (never re-hosted);
 *   - photographer / photographerUrl / unsplashUrl: for the required credit, with
 *     ?utm_source=wanderzenai&utm_medium=referral on every link back to Unsplash.
 * Displaying a photo is not a "download", so links.download_location is not triggered.
 */

const UNSPLASH_API = 'https://api.unsplash.com';
const UTM = 'utm_source=wanderzenai&utm_medium=referral';
const HIT_TTL = '30 days';
const MISS_TTL = '1 day';
const MAX_QUERY = 80;

const ENSURE_CACHE_SQL = `
  CREATE TABLE IF NOT EXISTS photo_cache (
    query_key  VARCHAR(100) PRIMARY KEY,
    photo      JSONB,
    expires_at TIMESTAMPTZ NOT NULL
  );`;
let ensurePromise = null;
const ensureCacheTable = (db) => {
  if (!ensurePromise) ensurePromise = db.query(ENSURE_CACHE_SQL).catch((e) => { ensurePromise = null; throw e; });
  return ensurePromise;
};

/** Lowercased, single-spaced, letters/digits/space/'-/& only. '' when unusable. */
function normaliseQuery(raw) {
  const q = String(raw || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s'&-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return q.length >= 2 && q.length <= MAX_QUERY ? q : '';
}

const withUtm = (url) => (url ? `${url}${url.includes('?') ? '&' : '?'}${UTM}` : null);

/** Only what the frontend needs; links back to Unsplash carry the UTM parameters. */
function toPhoto(result) {
  if (!result?.urls?.regular) return null;
  return {
    url: result.urls.regular,
    alt: result.alt_description || null,
    photographer: result.user?.name || 'Unsplash photographer',
    photographerUrl: withUtm(result.user?.links?.html || null),
    photoUrl: withUtm(result.links?.html || null),
    unsplashUrl: `https://unsplash.com/?${UTM}`,
  };
}

/**
 * @param {object} deps { db, accessKey, fetchImpl, log }
 * @returns {Promise<{ photo: object|null, cached: boolean }>}
 */
async function searchPhoto(query, { db, accessKey, fetchImpl = fetch, log = console }) {
  await ensureCacheTable(db);
  const cached = await db.query(
    'SELECT photo FROM photo_cache WHERE query_key = $1 AND expires_at > NOW()', [query]
  );
  if (cached.rows.length) return { photo: cached.rows[0].photo, cached: true };
  if (!accessKey) return { photo: null, cached: false };

  let photo = null;
  const params = new URLSearchParams({ query, per_page: '1', orientation: 'landscape', content_filter: 'high' });
  const res = await fetchImpl(`${UNSPLASH_API}/search/photos?${params}`, {
    headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
    signal: AbortSignal.timeout(4000),
  });
  if (res.status === 403 || res.status === 429) {
    // Demo key over its hourly limit: don't cache, so it recovers next hour.
    log.warn?.('Unsplash rate limited', { status: res.status, remaining: res.headers?.get?.('x-ratelimit-remaining') });
    return { photo: null, cached: false };
  }
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);
  const data = await res.json();
  photo = toPhoto(data?.results?.[0]);

  await db.query(
    `INSERT INTO photo_cache (query_key, photo, expires_at) VALUES ($1, $2, NOW() + $3::interval)
     ON CONFLICT (query_key) DO UPDATE SET photo = EXCLUDED.photo, expires_at = EXCLUDED.expires_at`,
    [query, photo ? JSON.stringify(photo) : null, photo ? HIT_TTL : MISS_TTL]
  );
  return { photo, cached: false };
}

module.exports = { searchPhoto, normaliseQuery, toPhoto, withUtm, ENSURE_CACHE_SQL };
