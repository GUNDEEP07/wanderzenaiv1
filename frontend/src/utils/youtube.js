// YouTube videos come from our backend (GET /videos/search): the API key stays on the
// server and results are cached there per destination + activity, so the ~100 searches a
// day YouTube allows go a long way. No key in the browser any more.
const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * @param {string} activity e.g. "Hiking"
 * @param {string|{name: string}} destination name or destination object
 * @param {string} [countryCode] ISO 3166-1 alpha-2, optional
 * @param {number} [maxResults=8]
 * @returns {Promise<Array<{ id, title, creator, thumbnailUrl }>>} [] when unavailable
 */
export async function fetchTrendingVideos(activity, destination, countryCode, maxResults = 8) {
  const destName = typeof destination === 'string' ? destination : destination?.name || '';
  if (!API_URL || !activity || !destName) return [];

  const params = new URLSearchParams({ activity, destination: destName });
  if (countryCode && /^[A-Za-z]{2}$/.test(countryCode)) params.set('region', countryCode);

  const res = await fetch(`${API_URL}/videos/search?${params}`);
  // 429 (our rate limit) is worth a retry by the caller; anything else just means no videos.
  if (res.status === 429) throw new Error('Video search rate limited');
  if (!res.ok) return [];
  const { videos } = await res.json();
  return Array.isArray(videos) ? videos.slice(0, maxResults) : [];
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
