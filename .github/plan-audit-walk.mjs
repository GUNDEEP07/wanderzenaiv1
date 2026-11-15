// For every public page: is there a visible way home, and does it work? (guest, phone + desktop)
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const PAGES = ['/', '/login', '/signup', '/pricing', '/blog', 'BLOGPOST', '/explore', '/contact', '/feedback', '/privacy', '/terms', '/plan', '/confirmation?id=wz_x', '/itinerary/wz_mw6d79lh_9lVr5-9EZHzCTs82', '/agency', '/no-such-page', '/dashboard', '/settings', '/admin'];
const report = [];
const browser = await chromium.launch();
for (const [w, h, label] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  let blogPost = null;
  for (let path of PAGES) {
    if (path === 'BLOGPOST') { if (!blogPost) continue; path = blogPost; }
    const row = { label, path };
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 });
      await page.getByRole('button', { name: 'Accept' }).click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(1200);
      row.landedOn = new URL(page.url()).pathname;
      if (path === '/blog') blogPost = await page.$$eval('a[href^="/blog/"]', as => as.map(a => new URL(a.href).pathname)[0] || null);
      const homeLinks = await page.$$eval('a, button', els => els.filter(e => {
        const r = e.getBoundingClientRect(); const st = getComputedStyle(e);
        if (!r.width || !r.height || st.visibility === 'hidden' || r.top > window.innerHeight * 1.2) return false;
        const href = e.getAttribute('href');
        const t = (e.textContent || '').trim().toLowerCase();
        return href === '/' || href === 'https://www.wanderzenai.com/' || /^(home|wanderzenai|w ?wanderzenai|← home|back to home)$/.test(t) || /wanderzenai$/.test(t);
      }).map(e => `${e.tagName.toLowerCase()}:${(e.textContent || '').trim().slice(0, 30)}|${e.getAttribute('href') || ''}`));
      row.homeInView = homeLinks;
      row.anyNav = await page.$$eval('nav, header', n => n.length);
      await page.screenshot({ path: `shots/nav-${label}-${path.replace(/[^a-z0-9]+/gi, '_')}.png`, clip: { x: 0, y: 0, width: w, height: Math.min(h, 500) } });
      // Does the first home link actually go home?
      if (homeLinks.length && row.landedOn !== '/') {
        const el = page.locator('a[href="/"], a[href="https://www.wanderzenai.com/"]').first();
        if (await el.count()) { await el.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1200); row.clickedTo = new URL(page.url()).pathname; }
      }
    } catch (e) { row.error = e.message.slice(0, 160); }
    report.push(row);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync('report.json', JSON.stringify({ nav: report }, null, 2));
for (const r of report) console.log(JSON.stringify(r));
