// UX review capture (after #48): home + explore, phone + desktop. Read-only.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const R = {};
const b = await chromium.launch();
for (const [w, h, tag] of [[390, 844, 'phone'], [1440, 900, 'desk']]) {
  for (const path of ['/', '/explore']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 150))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
    const t0 = Date.now();
    await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 60000 });
    const loadMs = Date.now() - t0;
    await p.getByRole('button', { name: 'Accept' }).click({ timeout: 2000 }).catch(() => {});
    // scroll through so reveal-on-scroll sections show
    const H = await p.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < H; y += 500) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(120); }
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500);
    const name = `${tag}${path === '/' ? '_home' : '_explore'}`;
    // viewport-sized slices (full-page shots distort sticky headers)
    const total = await p.evaluate(() => document.body.scrollHeight);
    let i = 0;
    for (let y = 0; y < total && i < 14; y += h - 80, i++) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(250); await p.screenshot({ path: `shots/${name}_${String(i).padStart(2, '0')}.png` }); }
    const info = await p.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      return {
        title: document.title, height: document.body.scrollHeight,
        headings: [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(h => `${h.tagName} ${h.textContent.trim().slice(0, 90)}`),
        buttons: [...document.querySelectorAll('button')].filter(vis).map(x => x.textContent.trim().slice(0, 50)).filter(Boolean),
        links: [...new Set([...document.querySelectorAll('a')].filter(vis).map(a => `${a.textContent.trim().slice(0, 40)} → ${a.getAttribute('href')}`))],
        inputs: [...document.querySelectorAll('input,select,textarea')].filter(vis).map(x => `${x.tagName} ${x.type || ''} ${x.placeholder || x.getAttribute('aria-label') || x.name || ''}`),
        images: [...document.querySelectorAll('img')].map(i => ({ src: i.currentSrc.slice(0, 80), w: i.naturalWidth, broken: i.complete && i.naturalWidth === 0 })).filter(i => i.broken).length,
        text: document.body.innerText.slice(0, 6000),
        smallTargets: [...document.querySelectorAll('a,button')].filter(vis).filter(el => { const r = el.getBoundingClientRect(); return r.height < 32 || r.width < 32; }).map(el => `${el.textContent.trim().slice(0, 30)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`).slice(0, 25),
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    const perf = await p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; const lcp = performance.getEntriesByType('largest-contentful-paint').pop(); return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), bytes: performance.getEntriesByType('resource').reduce((a, r) => a + (r.transferSize || 0), 0), requests: performance.getEntriesByType('resource').length }; });
    R[name] = { loadMs, perf, errors, ...info };
    await ctx.close();
  }
}
// Explore interactions (phone): try search, filters, a card click
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/explore', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Accept' }).click({ timeout: 2000 }).catch(() => {});
  const steps = [];
  const inp = p.locator('input').first();
  if (await inp.count()) { await inp.fill('Japan'); await p.waitForTimeout(1500); steps.push('search Japan: ' + (await p.evaluate(() => document.body.innerText.slice(0, 600)))); await p.screenshot({ path: 'shots/phone_explore_search.png' }); await inp.fill(''); }
  const chips = await p.locator('button').allTextContents();
  steps.push('buttons: ' + chips.slice(0, 40).join(' | '));
  const firstCard = p.getByText(/Plan this/).first();
  if (await firstCard.count()) { await firstCard.click(); await p.waitForTimeout(2500); steps.push('after Plan this: ' + p.url()); await p.screenshot({ path: 'shots/phone_explore_after_plan.png' }); }
  R.exploreInteractions = steps;
  await ctx.close();
}
await b.close();
// Raw HTML checks (what crawlers and first paint get)
for (const path of ['/', '/explore', '/pricing']) {
  const html = await (await fetch(BASE + path)).text();
  R['raw' + path] = { testimonials: /Prabhsimran|Meena C\.|Jaideep S\./.test(html), trusted: /Trusted by/.test(html), senso: /Senso-ji/.test(html), priority: /Priority generation/.test(html), fullFree: /Full day-by-day/.test(html), travelers: /\d[\d,]* travelers/.test(html), myanmar: /Myanmar/.test(html), dayOne: /Day 1 written in full|Day 1/.test(html) };
}
const api = await (await fetch('https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/recommendations/trending')).json().catch(e => ({ err: e.message }));
R.trendingApi = api;
fs.writeFileSync('report.json', JSON.stringify(R, null, 1));
// rerun 2026-11-16T04:40:42Z
