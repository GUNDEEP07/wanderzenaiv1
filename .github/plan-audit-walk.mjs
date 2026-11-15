// Walks the redesigned live planner (guest, Vietnam) at phone + desktop width.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const report = { runs: [] };
const iso = (d) => d.toISOString().slice(0, 10);
const start = new Date(Date.now() + 40 * 86400000);
const mask = (u) => u.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g, '<email>');

async function walk(width, height, label) {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width, height }, locale: 'en-AU', timezoneId: 'Australia/Sydney' })).newPage();
  const run = { label, steps: [], bad: [], console: [], links: [], checks: {} };
  let stepName = 'start';
  page.on('response', r => { if (r.status() >= 400) run.bad.push({ step: stepName, status: r.status(), url: mask(r.url()).slice(0, 160) }); });
  page.on('console', m => { if (m.type() === 'error') run.console.push({ step: stepName, text: m.text().slice(0, 200) }); });
  page.on('pageerror', e => run.console.push({ step: stepName, text: 'PAGEERROR ' + e.message.slice(0, 200) }));
  let n = 0;
  const shot = async (name) => {
    stepName = name; n++; await page.waitForTimeout(700);
    await page.screenshot({ path: `shots/${label}-${String(n).padStart(2, '0')}-${name}.png`, fullPage: true });
    run.steps.push({ name, h1: await page.locator('h1').first().textContent().catch(() => null),
      overflowX: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
      footerOnScreen: await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(Continue|Create|See plans)/.test(x.textContent.trim())); if (!b) return null; const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }) });
  };
  const cont = async () => { await page.getByRole('button', { name: /^(Continue|Create free account|Create my itinerary)$/ }).last().click(); };
  try {
    await page.goto(`${BASE}/plan`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`${BASE}/plan`, { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByRole('button', { name: 'Accept' }).click().catch(() => {});
    await shot('1-basics');
    await page.getByRole('button', { name: 'Vietnam', exact: true }).first().click();
    await page.locator('#wz-start').fill(iso(start));
    run.checks.endDate = await page.locator('#wz-end').inputValue();
    await page.getByLabel('Total budget').fill('3000');
    await shot('1-filled');
    await cont();
    await page.getByRole('button', { name: /This looks good/ }).first().waitFor({ timeout: 60000 });
    await shot('2-route-options');
    await page.getByRole('button', { name: /This looks good/ }).first().click();
    await shot('2-route-chosen');
    await cont();
    await page.waitForTimeout(12000);
    await shot('3-days-picked');
    run.checks.pickedAdd = await page.locator('button[aria-label^="Add "][aria-label*=" to day "]').count();
    if (run.checks.pickedAdd) await page.locator('button[aria-label^="Add "][aria-label*=" to day "]').first().click();
    await page.getByRole('tab', { name: 'Browse by category' }).click();
    await page.waitForTimeout(6000);
    run.checks.foodResults = await page.locator('.pd-result').count();
    run.checks.foodFirst = await page.locator('.pd-result b').first().textContent().catch(() => null);
    const adds = page.locator('button[aria-label^="Add "][aria-label*=" to day "]');
    if (await adds.count()) await adds.last().click();
    await page.getByRole('button', { name: 'Markets' }).click(); await page.waitForTimeout(5000);
    run.checks.marketResults = await page.locator('.pd-result').count();
    await shot('3-days-browsed');
    run.links.push(...await page.$$eval('.pd-result a', as => as.slice(0, 3).map(a => ({ step: 'days', text: a.textContent.trim(), href: a.href }))));
    run.checks.status3 = await page.locator('[aria-live="polite"]').first().textContent().catch(() => null);
    await cont();
    await shot('4-stays');
    run.links.push(...await page.$$eval('main a[href^="http"]', as => as.map(a => ({ step: 'stays', text: a.textContent.trim(), href: a.href }))));
    await cont();
    await page.waitForTimeout(12000);
    await shot('5-review');
    run.checks.savedPicks = await page.evaluate(() => { try { return (JSON.parse(sessionStorage.getItem('wz_plan_form_v2')).selected_venues.picks || []).map(p => ({ name: p.name, day: p.day, destination: p.destination })); } catch (e) { return String(e); } });
    run.checks.reviewButton = await page.getByRole('button', { name: /^(Create free account|Create my itinerary|See plans)$/ }).last().textContent().catch(() => null);
  } catch (e) {
    run.error = `${stepName}: ${e.message.slice(0, 300)}`;
    await page.screenshot({ path: `shots/${label}-zz-error.png`, fullPage: true }).catch(() => {});
  }
  await browser.close();
  report.runs.push(run);
}

await walk(390, 844, 'phone');
await walk(1280, 900, 'desktop');
const seen = new Map();
for (const r of report.runs) for (const l of r.links) if (!seen.has(l.href)) seen.set(l.href, l);
for (const [href, l] of seen) {
  try { l.status = (await fetch(href, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (link check)' }, signal: AbortSignal.timeout(15000) })).status; } catch (e) { l.status = 'ERR ' + (e.cause?.code || e.message); }
}
report.linkCheck = [...seen.values()];
fs.writeFileSync('report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1).slice(0, 6000));
