import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE_NAME, DEFAULT_IMAGE, DEFAULT_DESCRIPTION, canonicalUrl, clip } from './site';
import { markPageReady } from './ready';

/**
 * Per-page head tags without a library: title, description, canonical, robots, Open Graph,
 * Twitter and optional JSON-LD. Updates the tags already in index.html in place (never
 * duplicates them). The prerender script captures the result into the saved HTML.
 *
 * @param {{ title: string, description?: string, path?: string, image?: string,
 *           type?: 'website'|'article', noindex?: boolean, jsonLd?: object|object[],
 *           ready?: boolean, publishedTime?: string, modifiedTime?: string }} props
 *   path — canonical path; defaults to the current address. ready — false while the
 *   page's own data is loading (keeps the prerendered copy on screen until it is true).
 */
export default function Seo({
  title, description = DEFAULT_DESCRIPTION, path, image = DEFAULT_IMAGE, type = 'website',
  noindex = false, jsonLd = null, ready = true, publishedTime, modifiedTime,
}) {
  const { pathname } = useLocation();
  const url = canonicalUrl(path || pathname);
  const fullTitle = !title ? SITE_NAME : title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const desc = clip(description);
  const ld = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    document.title = fullTitle;
    setMeta('name', 'description', desc);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    setLink('canonical', noindex ? null : url);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:image', image);
    setMeta('property', 'article:published_time', type === 'article' ? publishedTime : null);
    setMeta('property', 'article:modified_time', type === 'article' ? modifiedTime : null);
    setMeta('name', 'twitter:url', url);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', image);
    setJsonLd(ld);
  }, [fullTitle, desc, url, image, type, noindex, ld, publishedTime, modifiedTime]);

  useEffect(() => { if (ready) markPageReady(); }, [ready]);
  return null;
}

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (content == null || content === '') { el?.remove(); return; }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(json) {
  let el = document.head.querySelector('script[data-seo-jsonld]');
  if (!json) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.setAttribute('data-seo-jsonld', '');
    document.head.appendChild(el);
  }
  // "</" can't close the script early.
  el.textContent = json.replace(/</g, '\\u003c');
}
