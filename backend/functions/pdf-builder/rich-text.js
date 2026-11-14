'use strict';

/**
 * Turns Claude's itinerary text into safe HTML for the PDF.
 *
 * The generator sometimes writes markdown links ("[View on map](https://maps.google.com/?q=Marble%20Mountain%20(Ngũ…)%2C…)")
 * and bare URLs. Map URLs often contain parentheses, so a simple `[^)]+` regex cuts them short
 * and the rest of the encoded URL ends up printed as text. This scanner matches balanced parentheses.
 *
 * mode 'inline': a Google Maps link becomes a small "map" pill after the place name; another
 *   http(s) link keeps its label as the link text; bare URLs and other schemes are dropped.
 * mode 'strip':  links and bare URLs are dropped, keeping only a label that isn't "View on map".
 * Everything else is HTML-escaped.
 */

const escapeHtml = (str) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const GENERIC_LABEL = /^\s*(📍\s*)?(view|open|see)?\s*(on|in)?\s*(google\s*)?maps?\s*(→)?\s*$/i;

/** Reads a URL that starts at text[i], stopping at the ')' that closes the markdown link. */
function readLinkTarget(text, i) {
  let depth = 0;
  let j = i;
  for (; j < text.length; j++) {
    const ch = text[j];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) return { url: text.slice(i, j), end: j + 1 };
      depth--;
    } else if (/\s/.test(ch)) break;
  }
  // No closing paren (truncated output): treat what we read as the URL.
  return { url: text.slice(i, j), end: j };
}

/** Splits text into [{type:'text', value}] and [{type:'link', label, url}] parts. */
function tokenize(text) {
  const parts = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      const close = text.indexOf('](', i + 1);
      const nested = text.indexOf('[', i + 1);
      if (close !== -1 && (nested === -1 || nested > close) && close - i < 200) {
        const label = text.slice(i + 1, close);
        const { url, end } = readLinkTarget(text, close + 2);
        if (/^https?:\/\//i.test(url)) {
          if (buf) parts.push({ type: 'text', value: buf });
          buf = '';
          parts.push({ type: 'link', label, url });
          i = end;
          continue;
        }
      }
    }
    const bare = /^https?:\/\/[^\s<>"]+/i.exec(text.slice(i, i + 2048));
    if (bare && (i === 0 || /[\s(]/.test(text[i - 1]))) {
      if (buf) parts.push({ type: 'text', value: buf });
      buf = '';
      parts.push({ type: 'link', label: '', url: bare[0].replace(/[).,;:!?]+$/, '') });
      i += bare[0].replace(/[).,;:!?]+$/, '').length;
      continue;
    }
    buf += text[i];
    i++;
  }
  if (buf) parts.push({ type: 'text', value: buf });
  return parts;
}

const safeHref = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch (_) {
    return null;
  }
};

const isMapUrl = (href) => {
  const u = new URL(href);
  return /(^|\.)maps\.google\.[a-z.]+$/i.test(u.hostname) || (/(^|\.)google\.[a-z.]+$/i.test(u.hostname) && u.pathname.startsWith('/maps')) || u.hostname === 'maps.app.goo.gl';
};

/** Tidies spacing left behind after a link is removed ("Beach , where" → "Beach, where"). */
const tidy = (s) => s.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/\(\s*\)/g, '').trim();

function richText(text, { mode = 'inline' } = {}) {
  if (text == null || text === '') return '';
  const parts = tokenize(String(text));
  if (mode === 'strip') {
    return escapeHtml(tidy(parts.map(p => (p.type === 'text' ? p.value : GENERIC_LABEL.test(p.label) ? '' : p.label)).join('')));
  }
  let out = '';
  let plain = '';
  const flush = () => { out += escapeHtml(plain); plain = ''; };
  for (const p of parts) {
    if (p.type === 'text') { plain += p.value; continue; }
    const href = safeHref(p.url);
    const label = GENERIC_LABEL.test(p.label) ? '' : p.label.trim();
    if (!p.label) continue; // bare URL: drop it
    if (href && !isMapUrl(href) && label) {
      flush();
      out += `<a href="${escapeHtml(href)}" class="text-link">${escapeHtml(label)}</a>`;
      continue;
    }
    if (label) plain += label;
    plain = plain.replace(/\s+$/, '');
    flush();
    if (href && isMapUrl(href)) out += ` <a href="${escapeHtml(href)}" class="map-pin">map</a>`;
  }
  plain = plain.replace(/^[ \t]+(?=[,.;:!?])/, '');
  flush();
  return tidy(out);
}

/** Plain text with links removed (for places where a link pill would clutter, e.g. the summary). */
const plainText = (text) => richText(text, { mode: 'strip' });

module.exports = { richText, plainText, escapeHtml, _internal: { tokenize, readLinkTarget } };
