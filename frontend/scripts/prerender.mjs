#!/usr/bin/env node
/**
 * Prerender the public pages to static HTML (SEO, Nov 2026).
 *
 * Opens each public address in headless Chromium against the built app and saves the finished
 * page as <dist>/<path>/index.html, so search engines and first visits get real content instead
 * of an empty app shell. The saved page still loads the app, which takes over invisibly
 * (src/seo/ready.js). Also writes:
 *   _shell.html  the untouched app shell (CloudFront serves it for app pages: /plan, /dashboard…)
 *   404.html     the not-found page (CloudFront serves it with a 404 status)
 *   blog/<uuid>/index.html  a permanent redirect from each old blog address to its readable one
 *   sitemap.xml  every indexable page; prerender-manifest.json  what was written
 *
 * Usage: node scripts/prerender.mjs --dist dist [--remote https://www.wanderzenai.com]
 *   VITE_API_URL (or PRERENDER_API_URL) — the API the pages call (blog list, photos…)
 *   --remote — fetch files that aren't in --dist from the live site (the scheduled refresh
 *              only downloads the shell, not every asset)
 *   PRERENDER_CHROMIUM — optional Chromium path (local runs)
 * API answers are fetched outside the page (see render) so CORS never blocks a page here.
 */
import http from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { blogPath, blogSlug } from '../src/utils/blogSlug.js';
import { SITE_URL } from '../src/seo/site.js';
import { fetchPublishedPosts } from './blog-posts.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt; };
const DIST = path.resolve(arg('dist', path.join(here, '../dist')));
const REMOTE = arg('remote', '');
const API = (process.env.PRERENDER_API_URL || process.env.VITE_API_URL || '').replace(/\/$/, '');
const PORT = 5173;
const ORIGIN = `http://localhost:${PORT}`;
const CONCURRENCY = 3;

const STATIC_ROUTES = ['/', '/guides', '/blog', '/explore', '/pricing', '/contact', '/feedback', '/privacy', '/terms'];
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp', '.txt': 'text/plain', '.xml': 'application/xml', '.html': 'text/html' };
const log = (...a) => console.log('[prerender]', ...a);
const warnings = [];
const warn = (m) => { warnings.push(m); console.warn('[prerender] WARN', m); };

async function exists(f) { try { return (await stat(f)).isFile(); } catch { return false; } }

function startServer(shell) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, ORIGIN);
    const file = path.join(DIST, decodeURIComponent(url.pathname));
    const isFile = path.extname(url.pathname) !== '';
    if (!file.startsWith(DIST)) { res.writeHead(400).end(); return; }
    if (!isFile) { res.writeHead(200, { 'content-type': 'text/html' }).end(shell); return; }
    if (await exists(file)) {
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file));
      return;
    }
    if (REMOTE) {
      try {
        const r = await fetch(`${REMOTE}${url.pathname}`);
        if (r.ok) { res.writeHead(200, { 'content-type': r.headers.get('content-type') || 'application/octet-stream' }).end(Buffer.from(await r.arrayBuffer())); return; }
      } catch { /* fall through */ }
    }
    res.writeHead(404).end();
  });
  return new Promise((resolve) => server.listen(PORT, '127.0.0.1', () => resolve(server)));
}

/** Render one address and return the finished HTML (or null). */
async function render(browser, route, { handOver = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-AU' });
  const page = await context.newPage();
  // No analytics, ads or service worker in the saved copy.
  await page.route(/googletagmanager|google-analytics|doubleclick/, (r) => r.abort());
  // The API only allows the live site's origin for some routes (blog), so its answers are
  // fetched outside the page and handed in with an origin this page accepts.
  if (API) {
    await page.route((url) => url.href.startsWith(API), async (r) => {
      if (r.request().method() === 'OPTIONS') {
        await r.fulfill({ status: 204, headers: { 'access-control-allow-origin': ORIGIN, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
        return;
      }
      try {
        const res = await r.fetch({ headers: { ...r.request().headers(), origin: SITE_URL } });
        await r.fulfill({ response: res, headers: { ...res.headers(), 'access-control-allow-origin': ORIGIN } });
      } catch { await r.abort(); }
    });
  }
  await page.addInitScript(() => {
    if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {});
  });
  try {
    await page.goto(`${ORIGIN}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.__WZ_READY__ === true, null, { timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Scroll through once: reveal-on-scroll sections and lazy photos fill in.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    const html = await page.evaluate((keepCopy) => {
      document.querySelectorAll('[data-prerender-skip], iframe, script[src*="googletagmanager"]:not([async])').forEach((el) => el.remove());
      // Marked pages keep this copy on screen until the app has drawn the same page.
      if (keepCopy) document.documentElement.setAttribute('data-prerendered', 'true');
      return `<!DOCTYPE html>\n${document.documentElement.outerHTML}`;
    }, handOver);
    const title = await page.title();
    const canonical = await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.href || '');
    const robots = await page.evaluate(() => document.querySelector('meta[name="robots"]')?.content || '');
    const h1 = await page.evaluate(() => document.querySelector('#root h1, h1')?.textContent?.trim() || '');
    return { html, title, canonical, robots, h1 };
  } catch (err) {
    warn(`${route}: ${err.message.split('\n')[0]}`);
    return null;
  } finally {
    await context.close();
  }
}

async function writePage(route, html) {
  const file = route === '/' ? path.join(DIST, 'index.html') : path.join(DIST, route, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
  return path.relative(DIST, file);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function redirectStub(to) {
  const url = `${SITE_URL}${to}`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="${esc(url)}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${esc(to)}"><script>location.replace(${JSON.stringify(to)} + location.search)</script></head><body><a href="${esc(to)}">This story has moved</a></body></html>`;
}

function sitemap(entries) {
  const urls = entries.map((e) => `  <url><loc>${esc(`${SITE_URL}${e.path === '/' ? '/' : e.path}`)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ''}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

async function main() {
  // The shell is the built index.html — unless an earlier run already replaced it.
  const shellFile = (await exists(path.join(DIST, '_shell.html'))) ? path.join(DIST, '_shell.html') : path.join(DIST, 'index.html');
  const shell = await readFile(shellFile, 'utf8');
  if (shell.includes('data-prerendered')) throw new Error(`${shellFile} is a prerendered page, not the app shell`);
  await writeFile(path.join(DIST, '_shell.html'), shell);

  const guides = JSON.parse(await readFile(path.join(here, '../src/data/guides-index.json'), 'utf8'));
  const posts = API ? await fetchPublishedPosts(API, { origin: ORIGIN, warn }) : (warn('no API URL: blog posts not prerendered'), null);
  const routes = [
    ...STATIC_ROUTES.map((p) => ({ path: p })),
    ...guides.map((g) => ({ path: `/guides/${g.slug}` })),
    ...(posts || []).map((p) => ({ path: blogPath(p), lastmod: (p.updated_at || p.published_at || p.created_at || '').slice(0, 10) || undefined, post: p })),
  ];
  log(`${routes.length} pages (${posts ? posts.length : 'no'} blog posts) from ${DIST}${REMOTE ? ` + ${REMOTE}` : ''}`);

  const server = await startServer(shell);
  const browser = await chromium.launch({ executablePath: process.env.PRERENDER_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const written = [];
  const failed = [];
  try {
    const queue = [...routes];
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const out = await render(browser, r.path);
        const want = `${SITE_URL}${r.path === '/' ? '/' : r.path}`;
        const problems = [];
        if (!out) problems.push('did not render');
        else {
          if (out.canonical !== want) problems.push(`canonical ${out.canonical || '(none)'} ≠ ${want}`);
          if (/noindex/.test(out.robots)) problems.push('noindex');
          if (!out.h1) problems.push('no <h1>');
        }
        if (problems.length) {
          // A bad copy is worse than none: the shell (200, the app renders it) stays in its place.
          warn(`${r.path}: ${problems.join('; ')} — serving the app shell instead`);
          await writePage(r.path, shell);
          failed.push(r.path);
        } else {
          written.push({ path: r.path, file: await writePage(r.path, out.html), title: out.title, lastmod: r.lastmod });
          log(`✓ ${r.path}  "${out.title}"`);
        }
      }
    }));

    // 404.html also serves stories published since the last build: not marked, so the app
    // replaces "Page not found" straight away instead of keeping it up while the story loads.
    const nf = await render(browser, '/__wz_not_found__', { handOver: false });
    await writeFile(path.join(DIST, '404.html'), nf?.html || shell);
    if (!nf) failed.push('/404');
  } finally {
    await browser.close();
    server.close();
  }

  const redirects = [];
  for (const p of posts || []) {
    const file = path.join(DIST, 'blog', p.id, 'index.html');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, redirectStub(blogPath(p)));
    redirects.push(path.relative(DIST, file));
  }

  const indexable = written.concat(failed.filter((f) => f !== '/404').map((p) => ({ path: p }))).sort((a, b) => routes.findIndex((r) => r.path === a.path) - routes.findIndex((r) => r.path === b.path));
  await writeFile(path.join(DIST, 'sitemap.xml'), sitemap(indexable.map((e) => ({ path: e.path, lastmod: routes.find((r) => r.path === e.path)?.lastmod }))));
  const manifest = {
    generatedAt: new Date().toISOString(),
    pages: indexable.map((e) => e.path),
    files: [...written.map((w) => w.file), ...failed.filter((f) => f !== '/404').map((p) => (p === '/' ? 'index.html' : `${p.slice(1)}/index.html`)), ...redirects, '404.html', '_shell.html'],
    blog: (posts || []).map((p) => ({ id: p.id, slug: blogSlug(p), updated: p.updated_at || p.published_at || null })),
    blogListed: !!posts,
    failed,
    warnings,
  };
  await writeFile(path.join(DIST, 'prerender-manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`);
  log(`done: ${written.length} pages, ${redirects.length} redirects, ${failed.length} fell back to the shell`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = ['## Prerender', `${written.length} pages saved, ${redirects.length} blog redirects, ${failed.length} fell back to the shell.`, ...warnings.map((w) => `- ⚠️ ${w}`)];
    await writeFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
  }
  // Too many failures means something is broken (API down, app crash): stop the deploy.
  if (failed.length > Math.max(2, routes.length * 0.25)) { console.error(`[prerender] ${failed.length} of ${routes.length} pages failed`); process.exit(1); }
}

main().catch((err) => { console.error('[prerender] failed:', err); process.exit(1); });
