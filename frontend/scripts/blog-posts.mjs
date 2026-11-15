/**
 * Every published blog post from the public API (GET /blog, 10 per page), for the prerender
 * and the scheduled refresh. Returns null when the list can't be read at all, so callers can
 * tell "no posts" from "API down" (and never delete pages on an API outage).
 */
export async function fetchPublishedPosts(api, { origin, warn = () => {}, maxPages = 50 } = {}) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    let json = null;
    for (let attempt = 0; attempt < 2 && !json; attempt++) {
      try {
        const res = await fetch(`${api}/blog?page=${page}`, { headers: origin ? { Origin: origin } : {} });
        if (res.ok) json = await res.json();
      } catch { /* retry once */ }
    }
    if (!json) { warn(`blog list page ${page} unreadable`); return page === 1 ? null : all; }
    const rows = Array.isArray(json.data) ? json.data : [];
    all.push(...rows);
    if (rows.length < 10) break;
  }
  return all.filter((p) => p.id && p.title && (!p.status || p.status === 'published'));
}
