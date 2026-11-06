'use strict';

/**
 * GET /videos/search?activity=…&destination=…&region=… — YouTube search through our backend.
 *
 * Why (Notion A6):
 *   - search.list has a quota of its own — about 100 searches a day per project — and
 *     the browser made one per Step 3 activity tab, so ~20 users a day used it up;
 *   - the API key was meant to ship in the public bundle (prod builds didn't even have it,
 *     so videos never showed).
 * Results are cached per (destination, activity) in Postgres for 7 days (misses 1 day;
 * YouTube's developer policies cap stored API data at 30 days), so repeat tabs cost nothing.
 */

const YT_SEARCH = 'https://www.googleapis.com/youtube/v3/search';
const HIT_TTL = '7 days';
const MISS_TTL = '1 day';
const MAX_RESULTS = 8;

const ENSURE_CACHE_SQL = `
  CREATE TABLE IF NOT EXISTS video_cache (
    query_key  VARCHAR(200) PRIMARY KEY,
    videos     JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );`;
let ensurePromise = null;
const ensureCacheTable = (db) => {
  if (!ensurePromise) ensurePromise = db.query(ENSURE_CACHE_SQL).catch((e) => { ensurePromise = null; throw e; });
  return ensurePromise;
};

const clean = (raw, max) => {
  const s = String(raw || '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s'&,-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return s.length >= 2 && s.length <= max ? s : '';
};

/** @returns {{ activity: string, destination: string, region: string|null } | null} */
function normaliseVideoQuery({ activity, destination, region } = {}) {
  const a = clean(activity, 60);
  const d = clean(String(destination || '').split(',')[0], 80); // "Kyoto, Japan" → "kyoto"
  if (!a || !d) return null;
  const r = /^[A-Za-z]{2}$/.test(String(region || '')) ? String(region).toUpperCase() : null;
  return { activity: a, destination: d, region: r };
}

/** YouTube search result → the fields the carousel shows. Titles arrive HTML-escaped. */
const unescape = (s) => String(s || '').replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
function toVideo(item) {
  const id = item?.id?.videoId;
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
  const sn = item.snippet || {};
  return {
    id,
    title: unescape(sn.title).slice(0, 200),
    creator: unescape(sn.channelTitle).slice(0, 100),
    thumbnailUrl: sn.thumbnails?.medium?.url || sn.thumbnails?.default?.url || null,
    publishedAt: sn.publishedAt || null,
  };
}

/**
 * @param {{ activity, destination, region }} q from normaliseVideoQuery
 * @param {object} deps { db, apiKey, fetchImpl, log }
 * @returns {Promise<{ videos: object[], cached: boolean }>}
 */
async function searchVideos(q, { db, apiKey, fetchImpl = fetch, log = console }) {
  const key = `${q.destination}|${q.activity}|${q.region || ''}`;
  await ensureCacheTable(db);
  const cached = await db.query('SELECT videos FROM video_cache WHERE query_key = $1 AND expires_at > NOW()', [key]);
  if (cached.rows.length) return { videos: cached.rows[0].videos, cached: true };
  if (!apiKey) return { videos: [], cached: false };

  const params = new URLSearchParams({
    part: 'snippet',
    q: `${q.destination} ${q.activity}`,
    type: 'video',
    maxResults: String(MAX_RESULTS),
    order: 'relevance',
    videoEmbeddable: 'true',
    safeSearch: 'strict',
    relevanceLanguage: 'en',
    key: apiKey,
  });
  if (q.region) params.set('regionCode', q.region);

  const res = await fetchImpl(`${YT_SEARCH}?${params}`, { signal: AbortSignal.timeout(5000) });
  if (res.status === 403 || res.status === 429) {
    // Daily quota used up (or key restricted): don't cache, it recovers at midnight Pacific.
    log.warn?.('YouTube quota or key problem', { status: res.status });
    return { videos: [], cached: false };
  }
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  const data = await res.json();
  const videos = (data.items || []).map(toVideo).filter(Boolean);

  await db.query(
    `INSERT INTO video_cache (query_key, videos, expires_at) VALUES ($1, $2, NOW() + $3::interval)
     ON CONFLICT (query_key) DO UPDATE SET videos = EXCLUDED.videos, expires_at = EXCLUDED.expires_at`,
    [key, JSON.stringify(videos), videos.length ? HIT_TTL : MISS_TTL]
  );
  return { videos, cached: false };
}

module.exports = { searchVideos, normaliseVideoQuery, toVideo, ENSURE_CACHE_SQL };
