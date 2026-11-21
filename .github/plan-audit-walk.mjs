// New-user walk: Australian guest planning Japan. No sign-up, no submit.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const log = [];
const L = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };
const b = await chromium.launch();

async function walk(name, vp, dpr) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: dpr, timezoneId: 'Australia/Sydney', locale: 'en-AU', isMobile: name === 'mobile', hasTouch: name === 'mobile' });
  const p = await ctx.newPage();
  const t0 = {};
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') L(`[${name}] console.${m.type()}:`, m.text().slice(0, 220)); });
  p.on('pageerror', e => L(`[${name}] PAGEERROR:`, e.message.slice(0, 220)));
  p.on('request', r => { t0[r.url() + r.method()] = Date.now(); });
  p.on('requestfailed', r => L(`[${name}] reqfailed:`, r.method(), r.url().slice(0, 140), r.failure()?.errorText));
  p.on('response', r => {
    const u = r.url(); if (!/execute-api|\/api\//.test(u) && r.status() < 400) return;
    const ms = Date.now() - (t0[u + r.request().method()] || Date.now());
    L(`[${name}] ${r.status()} ${r.request().method()} ${u.replace(/^https:\/\/[^/]+/, '').slice(0, 110)} ${ms}ms`);
  });
  let n = 0;
  const shot = async (label) => {
    await p.waitForTimeout(800);
    const f = `${name}_${String(n++).padStart(2, '0')}_${label}`;
    await p.screenshot({ path: `shots/${f}.png`, fullPage: true });
    fs.writeFileSync(`shots/${f}.txt`, (await p.locator('body').innerText()).slice(0, 8000));
    L(`[${name}] shot ${f} url=${p.url().replace(BASE, '')}`);
  };
  const cont = async () => { const btns = p.getByRole('button', { name: /^Continue/ }); await btns.last().click({ timeout: 8000 }); };
  try {
    let t = Date.now();
    await p.goto(BASE + '/', { waitUntil: 'load', timeout: 60000 });
    L(`[${name}] home load ${Date.now() - t}ms`);
    await p.getByRole('button', { name: /Accept|Decline|Reject/ }).first().click({ timeout: 3000 }).catch(() => L(`[${name}] no cookie banner button`));
    await shot('home');
    // What does "Not sure where yet" show for a Sydney visitor?
    const from = await p.locator('#lp-from').first().inputValue().catch(() => 'n/a');
    L(`[${name}] home origin guess: ${from}`);
    // Click the main CTA
    t = Date.now();
    const cta = p.getByRole('button', { name: /Plan my trip, free/i }).filter({ visible: true }).first();
    await cta.click({ timeout: 8000 });
    await p.waitForURL(/\/plan/, { timeout: 15000 });
    await p.waitForSelector('#wz-where', { timeout: 20000 });
    L(`[${name}] plan page ready ${Date.now() - t}ms`);
    await shot('step1_empty');
    // Try Continue with nothing filled → validation
    await cont().catch(e => L(`[${name}] continue(empty) err ${e.message.slice(0, 80)}`));
    await p.waitForTimeout(600);
    const alerts = await p.getByRole('alert').allInnerTexts().catch(() => []);
    L(`[${name}] empty-submit alerts: ${JSON.stringify(alerts)}`);
    // Step 1: Japan, April 2027, 10 days, 2 adults, AUD 6000
    await p.getByRole('button', { name: /^Japan$/ }).first().click({ timeout: 8000 });
    await p.fill('#wz-start', '2027-04-06');
    const days = await p.locator('section[aria-labelledby="wz-when"]').innerText();
    L(`[${name}] when section: ${days.replace(/\n/g, ' | ').slice(0, 200)}`);
    for (let i = 0; i < 3; i++) await p.getByRole('button', { name: 'One day more' }).click().catch(() => {});
    const who = await p.locator('section[aria-labelledby="wz-who"]').innerText();
    L(`[${name}] who section: ${who.replace(/\n/g, ' | ').slice(0, 300)}`);
    if (/\b1 adult\b|Adults\s*\|?\s*1\b/i.test(who)) await p.getByRole('button', { name: 'One adult more' }).click().catch(() => {});
    const cur = await p.getByLabel('Currency').inputValue().catch(() => 'n/a');
    L(`[${name}] default currency: ${cur}`);
    await p.getByLabel('Total budget').fill('6000');
    await shot('step1_filled');
    t = Date.now();
    await cont();
    await p.getByRole('button', { name: /This looks good/ }).first().waitFor({ timeout: 60000 });
    L(`[${name}] route options shown ${Date.now() - t}ms`);
    await shot('step2_routes');
    await p.getByRole('button', { name: /This looks good/ }).first().click();
    await shot('step2_chosen');
    t = Date.now();
    await cont();
    await p.waitForSelector('[aria-label="Stops on your route"]', { timeout: 30000 });
    await p.waitForTimeout(4000);
    L(`[${name}] days step ${Date.now() - t}ms`);
    await shot('step3_days');
    const adds = p.locator('button.pd-add:not(.pd-add--done)');
    L(`[${name}] add buttons visible: ${await adds.count()}`);
    for (let i = 0; i < 2; i++) await adds.first().click({ timeout: 5000 }).catch(e => L(`[${name}] add err ${e.message.slice(0, 80)}`));
    await shot('step3_added');
    await cont();
    await p.waitForTimeout(1500);
    await shot('step4_stays');
    await cont();
    await p.waitForTimeout(12000); // let the outline preview load
    await shot('step5_review');
    const btns = await p.getByRole('button').allInnerTexts();
    L(`[${name}] review buttons: ${JSON.stringify(btns.filter(Boolean).slice(-12))}`);
    const links = await p.getByRole('link').evaluateAll(as => as.map(a => a.textContent.trim() + ' -> ' + a.getAttribute('href')).filter(x => /sign|account|log/i.test(x)));
    L(`[${name}] review sign-up links: ${JSON.stringify(links)}`);
    // Reload: is the draft kept for a guest?
    await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(3000);
    await shot('after_reload');
  } catch (e) {
    L(`[${name}] WALK STOPPED: ${e.message.split('\n')[0].slice(0, 200)}`);
    await shot('stopped').catch(() => {});
  }
  // Other pages an AU visitor would see
  for (const path of ['/explore', '/guides/japan', '/pricing', '/signup?next=/plan']) {
    try {
      const t = Date.now();
      await p.goto(BASE + path, { waitUntil: 'load', timeout: 45000 });
      await p.waitForTimeout(3000);
      L(`[${name}] ${path} load ${Date.now() - t}ms`);
      await shot(path.replace(/[^a-z]/g, '_'));
    } catch (e) { L(`[${name}] ${path} failed ${e.message.slice(0, 120)}`); }
  }
  await ctx.close();
}
await walk('mobile', { width: 390, height: 844 }, 2);
await walk('desktop', { width: 1440, height: 900 }, 1);
fs.writeFileSync('report.txt', log.join('\n') + '\n');
await b.close();
