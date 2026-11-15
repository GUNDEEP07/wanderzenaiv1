// Image audit: broken images, failed image requests, stretched/squashed images, missing alt,
// broken CSS background images — every public page, phone + desktop, after scrolling.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const PAGES = ['/', '/explore', '/pricing', '/blog', 'BLOGPOSTS', '/plan', '/itinerary/wz_mw6d79lh_9lVr5-9EZHzCTs82', '/confirmation?id=wz_x', '/login', '/signup', '/contact', '/feedback', '/privacy', '/terms', '/agency', '/no-such-page'];
const out = [];
const browser = await chromium.launch();
for (const [w, h, label] of [[390, 844, 'phone'], [1280, 900, 'desktop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  let posts = [];
  const queue = [];
  for (const p of PAGES) queue.push(p);
  while (queue.length) {
    let path = queue.shift();
    if (path === 'BLOGPOSTS') { queue.unshift(...posts.slice(0, 3)); continue; }
    const failed = [];
    const onResp = r => { const t = r.request().resourceType(); if (t === 'image' && r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 140)}`); };
    const onFail = r => { if (r.resourceType() === 'image') failed.push(`FAILED ${r.failure()?.errorText} ${r.url().slice(0, 140)}`); };
    page.on('response', onResp); page.on('requestfailed', onFail);
    const row = { label, path };
    try {
      await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 });
      await page.getByRole('button', { name: 'Accept' }).click({ timeout: 1500 }).catch(() => {});
      // scroll through to trigger lazy images
      const H = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += h * 0.8) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(350); }
      await page.waitForTimeout(2500);
      if (path === '/blog') {
        posts = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/blog/"]')].map(a => new URL(a.href).pathname))]);
        if (!posts.length) {
          // cards may navigate on click: click the first card
          const card = page.locator('[class*="card"], article').first();
          if (await card.count()) { await card.click().catch(() => {}); await page.waitForTimeout(2500); const u = new URL(page.url()).pathname; if (u.startsWith('/blog/')) posts = [u]; await page.goBack().catch(() => {}); }
        }
        row.postsFound = posts;
      }
      row.images = await page.evaluate(() => [...document.querySelectorAll('img')].map(img => {
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        const visible = r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
        const nat = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : null;
        const shown = r.height ? r.width / r.height : null;
        const fit = cs.objectFit;
        const distortion = nat && shown && (fit === 'fill' || !fit) ? Math.abs(shown / nat - 1) : 0;
        return {
          src: (img.currentSrc || img.src || '').slice(0, 120), alt: img.getAttribute('alt'), visible,
          broken: img.complete && img.naturalWidth === 0 && !!(img.currentSrc || img.src),
          size: `${Math.round(r.width)}x${Math.round(r.height)}`, natural: `${img.naturalWidth}x${img.naturalHeight}`,
          fit, distortion: Math.round(distortion * 100),
          overflow: r.right > window.innerWidth + 1,
          upscaled: img.naturalWidth && r.width > img.naturalWidth * 1.6,
        };
      }));
      row.bgBroken = await page.evaluate(async () => {
        const urls = new Set();
        for (const el of document.querySelectorAll('*')) { const m = getComputedStyle(el).backgroundImage.match(/url\(["']?([^"')]+)/); if (m && !m[1].startsWith('data:')) urls.add(m[1]); }
        const bad = [];
        for (const u of urls) { await new Promise(res => { const i = new Image(); i.onload = () => res(); i.onerror = () => { bad.push(u.slice(0, 140)); res(); }; i.src = u; setTimeout(res, 8000); }); }
        return { count: urls.size, bad };
      });
      await page.screenshot({ path: `shots/img-${label}-${path.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}.png`, fullPage: true });
    } catch (e) { row.error = e.message.slice(0, 160); }
    page.off('response', onResp); page.off('requestfailed', onFail);
    row.failedRequests = [...new Set(failed)];
    out.push(row);
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync('report.json', JSON.stringify({ images: out }, null, 2));
for (const r of out) {
  const imgs = r.images || [];
  const issues = imgs.filter(i => i.visible && (i.broken || i.distortion > 4 || i.overflow || i.upscaled || i.alt === null));
  console.log(`${r.label[0]} ${r.path.padEnd(42)} imgs=${imgs.length} visible=${imgs.filter(i => i.visible).length} broken=${imgs.filter(i => i.broken).length} issues=${issues.length} failedReq=${r.failedRequests.length} bg=${r.bgBroken?.count}/${r.bgBroken?.bad?.length} ${r.error || ''}`);
  for (const i of issues.slice(0, 8)) console.log('     ', JSON.stringify(i));
  for (const f of r.failedRequests.slice(0, 6)) console.log('      REQ', f);
  for (const b of (r.bgBroken?.bad || []).slice(0, 4)) console.log('      BG', b);
  if (r.postsFound) console.log('      posts:', r.postsFound);
}
