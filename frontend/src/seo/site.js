/** Site-wide SEO constants (plain ESM: the prerender script imports this too). */
export const SITE_URL = 'https://www.wanderzenai.com';
export const SITE_NAME = 'WanderZenAI';
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;
export const DEFAULT_TITLE = 'WanderZenAI — AI-Powered Slow Travel Itineraries';
export const DEFAULT_DESCRIPTION = 'Plan a slow trip with AI: fewer stops, longer stays, hidden cafés, village homestays and morning trails. Free to start.';

/** Absolute canonical URL for a path: no query, no trailing slash (except the home page). */
export function canonicalUrl(path = '/') {
  const clean = String(path).split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return `${SITE_URL}${clean === '/' ? '/' : clean}`;
}

/** Trim to a search-snippet-sized description at a word boundary. */
export function clip(text = '', max = 158) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s,;:.—-]+$/, '')}…`;
}
