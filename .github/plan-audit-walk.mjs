// Landing page review: full-page shots desktop + mobile, image sharpness (natural vs displayed size).
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const lines = [];
const b = await chromium.launch();
for (const [name, vp, dpr] of [['desktop', { width: 1440, height: 900 }, 2], ['mobile', { width: 390, height: 844 }, 3]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, timezoneId: 'Australia/Sydney', isMobile: name === 'mobile' });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await p.getByRole('button', { name: 'Accept' }).click({ timeout: 2000 }).catch(() => {});
  for (let y = 0; y < 12000; y += 500) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(200); }
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(1500);
  const h = await p.evaluate(() => document.body.scrollHeight);
  // viewport-height slices (sharper than one giant image)
  for (let i = 0, y = 0; y < h && i < 14; i++, y += vp.height) {
    await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(500);
    await p.screenshot({ path: `shots/${name}_${String(i).padStart(2, '0')}.png` });
  }
  const imgs = await p.evaluate(() => [...document.images].map(i => {
    const r = i.getBoundingClientRect();
    return { src: i.currentSrc.slice(0, 120), nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(r.width), h: Math.round(r.height), fit: getComputedStyle(i).objectFit, alt: i.alt.slice(0, 50) };
  }).filter(x => x.w > 40));
  lines.push(`== ${name} (dpr ${dpr}) page height ${h}`);
  for (const i of imgs) {
    const need = i.w * dpr;
    lines.push(`${i.nw >= need ? 'ok   ' : 'SOFT '} shown ${i.w}x${i.h} needs ${need}px wide, file ${i.nw}x${i.nh} fit=${i.fit} | ${i.alt} | ${i.src}`);
  }
  const text = await p.locator('body').innerText();
  fs.writeFileSync(`shots/${name}_text.txt`, text);
  await ctx.close();
}
fs.writeFileSync('report.txt', lines.join('\n') + '\n');
await b.close();
