// SEO release end-to-end check on the live site (Nov 15 2026, after #44/#45).
// Part A: raw HTTP, no JavaScript (what a crawler gets). Part B: real browser, phone + desktop.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
const API = 'https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod';
fs.mkdirSync('shots', { recursive: true });
const R = { http: [], browser: [], fails: [] };
const fail = (where, msg) => { R.fails.push(`${where}: ${msg}`); };
const get = async (path, opts = {}) => {
  const r = await fetch(BASE + path, { redirect: 'manual', ...opts });
  const text = /text|xml|json/.test(r.headers.get('content-type') || '') ? await r.text() : '';
  return { status: r.status, type: r.headers.get('content-type'), cache: r.headers.get('cache-control'), location: r.headers.get('location'), text };
};
const pick = (html, re) => (html.match(re) || [])[1] || '';

// ── A. HTTP ───────────────────────────────────────────────────────────────────
const sm = await get('/sitemap.xml');
const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
R.sitemap = { status: sm.status, type: sm.type, count: urls.length };
if (sm.status !== 200 || urls.length < 20) fail('sitemap', `${sm.status} ${urls.length} urls`);
for (const u of urls) {
  const path = new URL(u).pathname;
  const r = await get(path);
  const row = {
    path, status: r.status, cache: r.cache,
    title: pick(r.text, /<title>([^<]*)<\/title>/),
    canonical: pick(r.text, /<link rel="canonical" href="([^"]+)"/),
    robots: pick(r.text, /<meta name="robots" content="([^"]+)"/),
    desc: pick(r.text, /<meta name="description" content="([^"]+)"/).slice(0, 80),
    ogImage: pick(r.text, /<meta property="og:image" content="([^"]+)"/),
    h1: pick(r.text, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, '').slice(0, 80),
    words: r.text.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    ldjson: (r.text.match(/application\/ld\+json/g) || []).length,
  };
  R.http.push(row);
  if (r.status !== 200) fail(path, `status ${r.status}`);
  if (row.canonical !== u) fail(path, `canonical ${row.canonical}`);
  if (!row.h1) fail(path, 'no h1 in raw HTML');
  if (/noindex/.test(row.robots)) fail(path, 'noindex');
  if (row.words < 80 && path !== '/contact') fail(path, `only ${row.words} words in raw HTML`);
  if (!/no-cache/.test(r.cache || '')) fail(path, `html cache-control ${r.cache}`);
}
const titles = R.http.map(r => r.title); if (new Set(titles).size !== titles.length) fail('titles', 'duplicate titles');
const checks = [
  ['/no-such-page', r => r.status === 404 && /noindex/.test(r.text), '404 + noindex'],
  ['/guides/atlantis', r => r.status === 404, '404'],
  ['/blog/', r => r.status === 301 && r.location === '/blog', '301 → /blog'],
  ['/guides/vietnam/?ref=x', r => r.status === 301 && r.location === '/guides/vietnam?ref=x', '301 keeps query'],
  ['/blog/08a02053-e1b9-4a6d-a4c2-3440817ad6e6', r => r.status === 200 && /http-equiv="refresh"[^>]+\/blog\/vietnam-slowly/.test(r.text) && /rel="canonical"/.test(r.text), 'old link → redirect stub'],
  ['/plan', r => r.status === 200 && !/data-prerendered/.test(r.text) && /\/assets\/index-/.test(r.text), 'app shell'],
  ['/dashboard', r => r.status === 200 && !/data-prerendered/.test(r.text), 'app shell'],
  ['/itinerary/wz_x', r => r.status === 200 && !/data-prerendered/.test(r.text), 'app shell'],
  ['/robots.txt', r => r.status === 200 && /Sitemap: https:\/\/www\.wanderzenai\.com\/sitemap\.xml/.test(r.text) && /text\/plain/.test(r.type), 'robots'],
  ['/og-image.png', r => r.status === 200 && r.type === 'image/png', 'png'],
  ['/favicon.ico', r => r.status === 200 && /icon/.test(r.type), 'ico'],
  ['/apple-touch-icon.png', r => r.status === 200 && r.type === 'image/png', 'png'],
  ['/prerender-manifest.json', r => r.status === 200 && JSON.parse(r.text).failed.length === 0, 'manifest, nothing failed'],
  ['/sw.js', r => r.status === 200 && /no-cache/.test(r.cache || ''), 'sw no-cache'],
];
for (const [p, ok, what] of checks) {
  const r = await get(p);
  const pass = (() => { try { return ok(r); } catch { return false; } })();
  R.http.push({ path: p, status: r.status, type: r.type, cache: r.cache, location: r.location, check: what, pass });
  if (!pass) fail(p, `${what}: got ${r.status} ${r.type} ${r.location || ''}`);
}
const home = await get('/');
const asset = pick(home.text, /src="(\/assets\/index-[^"]+\.js)"/);
const a = await get(asset);
if (!/immutable/.test(a.cache || '')) fail('assets', `cache ${a.cache}`);
const api = await fetch(`${API}/blog/08a02053`); const aj = await api.json().catch(() => null);
if (api.status !== 200 || !aj?.data?.id?.startsWith('08a02053')) fail('API', `/blog/08a02053 → ${api.status}`);
const apex = await fetch('https://wanderzenai.com/').then(r => r.status).catch(e => `unreachable (${e.cause?.code || e.message})`);
R.apex = apex;

// ── B. Browser ────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const PAGES = ['/', '/guides', '/guides/vietnam', '/guides/new-zealand', '/blog', '/blog/vietnam-slowly-rice-fields-river-mornings-and-a-quiet-hoi-08a02053', '/explore', '/pricing', '/contact', '/privacy', '/plan', '/login', '/no-such-page'];
for (const [w, h, label] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
  for (const path of PAGES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    const row = { label, path };
    try {
      await page.goto(BASE + path, { waitUntil: 'commit', timeout: 45000 });
      const frames = []; const t0 = Date.now();
      while (Date.now() - t0 < 4000) {
        const f = await page.evaluate(() => {
          const vis = el => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false; } return el.getBoundingClientRect().height > 0; };
          return { h1: [...document.querySelectorAll('h1')].some(vis), copy: !!document.getElementById('prerendered-root'), spinner: !!document.querySelector('[style*="spin"]') && ![...document.querySelectorAll('h1')].some(vis) };
        }).catch(() => null);
        if (f) frames.push(f);
        await page.waitForTimeout(80);
      }
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      row.copyStillThere = await page.evaluate(() => !!document.getElementById('prerendered-root'));
      row.blankFrames = frames.filter(f => !f.h1).length;
      row.frames = frames.length;
      row.title = await page.title();
      row.url = new URL(page.url()).pathname;
      row.homeLink = await page.evaluate(() => [...document.querySelectorAll('a')].some(a => new URL(a.href, location.href).pathname === '/' && a.getBoundingClientRect().width > 0));
      row.guidesLink = await page.evaluate(() => [...document.querySelectorAll('a[href="/guides"]')].length > 0);
      row.brokenImages = await page.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0 && i.src).map(i => i.src.slice(0, 100)));
      row.errors = errors.filter(e => !/favicon|Failed to load resource: the server responded with a status of 404/.test(e) || path !== '/no-such-page');
      await page.screenshot({ path: `shots/${label}${path.replace(/\W+/g, '_').slice(0, 60) || '_home'}.png` });
      if (row.copyStillThere) fail(`${label} ${path}`, 'prerendered copy never handed over');
      if (path !== '/no-such-page' && path !== '/plan' && path !== '/login' && row.blankFrames > 2) fail(`${label} ${path}`, `${row.blankFrames}/${row.frames} frames without a visible h1`);
      if (row.brokenImages.length) fail(`${label} ${path}`, `broken images ${row.brokenImages.join(' ')}`);
      if (row.errors.length) fail(`${label} ${path}`, `console: ${row.errors.join(' | ')}`);
      if (!row.homeLink && path !== '/') fail(`${label} ${path}`, 'no visible link home');
      if (path === '/guides/vietnam') {
        row.mapCanvas = await page.evaluate(() => document.querySelectorAll('.maplibregl-canvas, canvas').length);
        if (!row.mapCanvas) fail(`${label} ${path}`, 'no route map');
        await page.getByRole('button', { name: 'Accept' }).click({ timeout: 1500 }).catch(() => {});
        await page.getByRole('link', { name: 'Plan this route' }).first().click();
        await page.waitForURL('**/plan', { timeout: 15000 });
        await page.waitForTimeout(2500);
        row.planAfterGuide = await page.evaluate(() => ({ url: location.pathname, text: document.body.innerText.slice(0, 600) }));
        const t = row.planAfterGuide.text;
        if (!/Vietnam/.test(t)) fail(`${label} guide→plan`, 'Vietnam not prefilled');
        await page.screenshot({ path: `shots/${label}_guide_to_plan.png` });
      }
      if (path === '/blog') {
        await page.getByRole('button', { name: 'Accept' }).click({ timeout: 1500 }).catch(() => {});
        const first = page.locator('a[href^="/blog/"]').first();
        row.firstStoryHref = await first.getAttribute('href');
        if (!/^\/blog\/[a-z0-9-]+-[0-9a-f]{8}$/.test(row.firstStoryHref || '')) fail(`${label} /blog`, `story link ${row.firstStoryHref}`);
      }
    } catch (e) { row.error = e.message.slice(0, 200); fail(`${label} ${path}`, row.error); }
    R.browser.push(row);
    await ctx.close();
  }
}
// Old UUID link in a browser lands on the readable address.
{
  const page = await browser.newPage();
  await page.goto(BASE + '/blog/08a02053-e1b9-4a6d-a4c2-3440817ad6e6', { waitUntil: 'networkidle' });
  R.oldLink = new URL(page.url()).pathname;
  if (!/^\/blog\/vietnam-slowly-.*-08a02053$/.test(R.oldLink)) fail('old blog link', R.oldLink);
  await page.close();
}
// Planner still works for a guest: pick a country, continue, route options appear.
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE + '/plan', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Accept' }).click({ timeout: 2000 }).catch(() => {});
  await page.getByRole('button', { name: 'Japan', exact: true }).first().click();
  const start = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  await page.locator('#wz-start').fill(start);
  await page.getByLabel('Total budget').fill('3000');
  await page.getByRole('button', { name: /^Continue$/ }).last().click();
  await page.getByRole('button', { name: /This looks good/ }).first().waitFor({ timeout: 60000 }).catch(() => {});
  R.planner = (await page.evaluate(() => document.body.innerText)).slice(0, 500);
  await page.screenshot({ path: 'shots/planner_step2.png' });
  if (!/route/i.test(R.planner) || !/Kyoto|Tokyo|Fukuoka/.test(R.planner)) fail('planner', 'no route options after step 1');
  await page.close();
}
await browser.close();
fs.writeFileSync('report.json', JSON.stringify(R, null, 1));
console.log(`fails: ${R.fails.length}`); R.fails.forEach(f => console.log(' -', f));
