// Walks the live planner as a guest (Vietnam) and records what a user sees.
// Output: shots/<width>-<n>-<step>.png, report.json (failed requests, console errors, link checks).
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const report = { runs: [] };
const iso = (d) => d.toISOString().slice(0, 10);
const start = new Date(Date.now() + 40 * 86400000), end = new Date(Date.now() + 45 * 86400000);
const mask = (u) => u.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g, '<email>').replace(/([?&](key|token|sig|X-Amz-[A-Za-z]+)=)[^&]+/g, '$1…');

async function walk(width, height, label) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'en-AU', timezoneId: 'Australia/Sydney' });
  const page = await ctx.newPage();
  const run = { label, width, steps: [], failed: [], badStatus: [], console: [], links: [] };
  let stepName = 'start';
  page.on('requestfailed', r => run.failed.push({ step: stepName, url: mask(r.url()).slice(0, 200), err: r.failure()?.errorText }));
  page.on('response', r => { if (r.status() >= 400) run.badStatus.push({ step: stepName, status: r.status(), url: mask(r.url()).slice(0, 200) }); });
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) run.console.push({ step: stepName, type: m.type(), text: m.text().slice(0, 300) }); });
  page.on('pageerror', e => run.console.push({ step: stepName, type: 'pageerror', text: e.message.slice(0, 300) }));
  let n = 0;
  const shot = async (name) => {
    stepName = name; n++;
    await page.waitForTimeout(800);
    const file = `shots/${label}-${String(n).padStart(2, '0')}-${name}.png`;
    await page.screenshot({ path: file, fullPage: true });
    const info = await page.evaluate(() => ({
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      tinyText: [...document.querySelectorAll('body *')].filter(e => e.childNodes.length && [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim().length > 2) && parseFloat(getComputedStyle(e).fontSize) < 12 && e.offsetParent).length,
      smallTargets: [...document.querySelectorAll('button, a[href], input, select')].filter(e => { const r = e.getBoundingClientRect(); return e.offsetParent && r.width > 0 && (r.height < 36 || r.width < 36); }).length,
      h: document.documentElement.scrollHeight,
    }));
    run.steps.push({ name, file, ...info });
  };
  const click = async (sel, opts = {}) => { await page.locator(sel).first().click({ timeout: 15000, ...opts }); };
  try {
    await page.goto(`${BASE}/plan`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => { sessionStorage.clear(); });
    await page.goto(`${BASE}/plan`, { waitUntil: 'networkidle', timeout: 60000 });
    await shot('step1-empty');
    await click('button:has-text("Accept")').catch(() => {});
    await click('button:has-text("Vietnam")');
    await page.waitForTimeout(500);
    await page.locator('input[placeholder="e.g., 2500"]').fill('3000');
    await click('button:has-text("Food tours")');
    await click('button:has-text("Markets")');
    await click('button:has-text("Couple")');
    await shot('step1-filled');
    await click('button:has-text("Continue")');
    await page.waitForSelector('input[type="date"]', { timeout: 10000 }).catch(async () => { await shot('step1-blocked'); });
    await shot('step2-dates-empty');
    const dates = page.locator('input[type="date"]');
    await dates.nth(0).fill(iso(start));
    await shot('step2-after-start-date');
    await dates.nth(1).fill(iso(end));
    await shot('step2-filled');
    await click('button:has-text("Continue")');
    await page.waitForSelector('text=This looks good', { timeout: 60000 }).catch(() => {});
    await shot('step3-route-options');
    await click('button:has-text("This looks good")');
    await shot('step3-route-chosen');
    await click('button:has-text("Continue")');
    await page.waitForTimeout(8000);
    await shot('step4-overview');
    run.links.push(...await page.$$eval('a[href^="http"]', as => as.map(a => ({ step: 'step4', text: a.textContent.trim().slice(0, 60), href: a.href }))));
    await click('button:has-text("Continue")');
    await page.waitForTimeout(12000);
    await shot('step5-experiences');
    await click('button:has-text("Food")').catch(() => {});
    await page.waitForTimeout(10000);
    await shot('step5-food');
    run.links.push(...await page.$$eval('a[href]', as => as.map(a => ({ step: 'step5', text: a.textContent.trim().slice(0, 60), href: a.href }))));
    run.step5Buttons = await page.$$eval('button', bs => bs.filter(b => b.offsetParent).map(b => b.textContent.trim().slice(0, 50)));
    await click('button.venue-footer__continue');
    await page.waitForTimeout(15000);
    await shot('step6-review');
    run.links.push(...await page.$$eval('a[href]', as => as.map(a => ({ step: 'step6', text: a.textContent.trim().slice(0, 60), href: a.href }))));
  } catch (e) {
    run.error = `${stepName}: ${e.message.slice(0, 300)}`;
    await page.screenshot({ path: `shots/${label}-zz-error.png`, fullPage: true }).catch(() => {});
  }
  await browser.close();
  report.runs.push(run);
}

async function checkLinks() {
  const seen = new Map();
  for (const r of report.runs) for (const l of r.links) if (/^https?:/.test(l.href) && !seen.has(l.href)) seen.set(l.href, l);
  for (const [href, l] of seen) {
    let status = 'ERR';
    try {
      const res = await fetch(href, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link check)' }, signal: AbortSignal.timeout(15000) });
      status = res.status;
    } catch (e) { status = `ERR ${e.cause?.code || e.message}`.slice(0, 60); }
    l.status = status;
  }
  report.linkCheck = [...seen.values()].map(l => ({ step: l.step, text: l.text, status: l.status, href: mask(l.href).slice(0, 220) }));
}

await walk(390, 844, 'phone');
await walk(1280, 900, 'desktop');
await checkLinks();
fs.writeFileSync('report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.runs.map(r => ({ label: r.label, error: r.error, steps: r.steps.map(s => `${s.name} ox=${s.overflowX} tiny=${s.tinyText} small=${s.smallTargets}`) })), null, 1));
