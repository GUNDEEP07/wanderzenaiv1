/**
 * Where to send someone after sign-in / sign-up (?next=…).
 * Only same-site paths are allowed, so ?next= can't be used to bounce people to another
 * site after they sign in (open redirect): "/plan" yes; "//evil.com", "https://…",
 * "/\\evil.com" and "javascript:" no.
 * @param {string|null|undefined} raw
 * @param {string} [fallback]
 * @returns {string}
 */
export function safeNext(raw, fallback = '/dashboard') {
  if (typeof raw !== 'string' || raw.length > 200) return fallback;
  if (!/^\/[A-Za-z0-9]/.test(raw)) return fallback; // must start "/x": rules out "//", "/\\", "javascript:"
  if (/[\\\s]/.test(raw)) return fallback;
  return raw;
}

/** "?next=/plan" for a link, or "" when there's nothing safe to carry. */
export function nextQuery(raw) {
  const n = safeNext(raw, '');
  return n ? `next=${encodeURIComponent(n)}` : '';
}
