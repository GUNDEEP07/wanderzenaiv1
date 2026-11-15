/**
 * Readable blog addresses: /blog/vietnam-slowly-rice-fields-river-mornings-08a02053.
 * The trailing 8 hex characters are the start of the post id, so a title edit never breaks
 * an old link (any words + the same id still open the story; the page then corrects the
 * address). Plain ESM with no JSX: the prerender script imports it too.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_ID_RE = /(?:^|-)([0-9a-f]{8})$/i;

export function slugify(text = '') {
  return String(text)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-').slice(0, 10).join('-')
    .slice(0, 80).replace(/-+$/, '');
}

/** @param {{ id: string, title?: string }} post */
export function blogSlug(post) {
  const short = String(post?.id || '').slice(0, 8).toLowerCase();
  const words = slugify(post?.title);
  return words ? `${words}-${short}` : short;
}

export const blogPath = (post) => `/blog/${blogSlug(post)}`;

/**
 * What the API needs from an address segment: a full UUID (old links) or the 8-character
 * id prefix at the end of a slug. Null when it is neither.
 */
export function postKeyFromParam(param = '') {
  const p = String(param).trim();
  if (UUID_RE.test(p)) return p.toLowerCase();
  const m = p.match(SLUG_ID_RE);
  return m ? m[1].toLowerCase() : null;
}

export const isUuid = (s) => UUID_RE.test(String(s || ''));
