// Live end-to-end: real Firebase account, real site, real API. Throwaway account, deleted at the end.
import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import crypto from 'crypto';

const { API, SITE, FIREBASE_KEY, TAG } = process.env;
const email = `gundeep07+${TAG}@gmail.com`;
const password = crypto.randomBytes(18).toString('base64url');
const SHOTS = `e2e-live/shots/${TAG}`; mkdirSync(SHOTS, { recursive: true });
const out = []; const check = (n, c, d = '') => { out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`); console.log(out.at(-1)); };
const idt = async (path, body) => {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${FIREBASE_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j.error)}`); return j;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let idToken;

try {
  // 1. Throwaway account + verification (code delivered by pushing e2e-live/codes/<TAG>.txt)
  ({ idToken } = await idt('accounts:signUp', { email, password, returnSecureToken: true }));
  await idt('accounts:sendOobCode', { requestType: 'VERIFY_EMAIL', idToken });
  console.log(`VERIFY EMAIL SENT TO ${email} — waiting for e2e-live/codes/${TAG}.txt`);
  let code = null;
  for (let i = 0; i < 90 && !code; i++) {
    await sleep(10000);
    try { execSync('git fetch -q origin smoke/route-debug'); code = execSync(`git show origin/smoke/route-debug:e2e-live/codes/${TAG}.txt`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not yet */ }
  }
  if (!code) throw new Error('no verification code arrived');
  await idt('accounts:update', { oobCode: code });
  ({ idToken } = await idt('accounts:signInWithPassword', { email, password, returnSecureToken: true }));
  check('throwaway account created and verified', true, email);

  // 2. API directly
  const post = (body) => fetch(`${API}/route-plan`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}`, origin: SITE }, body: JSON.stringify(body) });
  let r = await post({ destination: 'Vietnam', days: 10, travelStyle: [], travelPace: 'balanced', interests: 'Hiking', prefs: { adults: 2, kids: [], transferComfort: 'medium' }, more: false, avoid: [] });
  let j = await r.json();
  check('API Vietnam 10d → 200 curated, 3 options, route for old tabs', r.status === 200 && j.data.source === 'curated' && j.data.options.length === 3 && j.data.route?.id === j.data.options[0].id, `${r.status} ${j.data?.options?.map(o => o.id)} cors=${r.headers.get('access-control-allow-origin')}`);
  r = await post({ destination: 'Peru', days: 7, prefs: { adults: 2, kids: [4], transferComfort: 'short' } }); j = await r.json();
  check('API Peru 7d (Claude) → 200 with options', r.status === 200 && j.data.options.length >= 2, `${r.status} ${j.data?.options?.map(o => `${o.name}: ${o.bases.map(b => `${b.name} ${b.days}`).join(' > ')}`).join(' | ') || j.message}`);

  // 3. The real site in a browser
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const routeCalls = []; page.on('response', async res => { if (res.url().includes('/route-plan')) routeCalls.push(`${res.status()}`); });
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
  await page.goto(`${SITE}/login`); await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /accept/i }).click({ timeout: 3000 }).catch(() => {});
  await page.getByPlaceholder('Email address').fill(email); await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click(); await page.waitForURL(/dashboard|onboarding|plan/, { timeout: 20000 });
  check('signed in on the live site', true, page.url());

  const fillStep1And2 = async ({ kidAge = null, short = false } = {}) => {
    await page.goto(`${SITE}/plan`); await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Vietnam', exact: true }).click();
    await page.getByRole('button', { name: '+', exact: true }).first().click(); // days 5 → 6
    await page.getByPlaceholder('e.g., 2500').fill('3000');
    await page.getByRole('button', { name: 'Hiking', exact: true }).click();
    if (kidAge !== null) { await page.getByText('+ Add a child').click(); await page.getByLabel('Age of child 1').selectOption(String(kidAge)); }
    if (short) await page.getByText('Short hops').click();
    await shot(`1-step1${kidAge !== null ? '-kid' : ''}`);
    await page.getByText('Continue →').click(); await page.waitForTimeout(700);
    const d = new Date(Date.now() + 70 * 864e5); const iso = (x) => x.toISOString().slice(0, 10);
    const dates = page.locator('input[type=date]');
    await dates.nth(0).fill(iso(d)); await dates.nth(1).fill(iso(new Date(d.getTime() + 5 * 864e5)));
    await page.getByText('Continue →').click();
  };

  // A. default group
  await fillStep1And2();
  const cards = page.getByText('This looks good →');
  await cards.first().waitFor({ timeout: 30000 }).catch(() => {});
  await shot('2-route-options');
  const n = await cards.count();
  const errorShown = await page.getByText(/Could not plan a route/).count();
  check('route step shows option cards (no error)', n >= 2 && errorShown === 0, `cards=${n} error=${errorShown} calls=${routeCalls.join(',')}`);
  if (n) {
    await cards.first().click(); await page.waitForTimeout(500); await shot('3-route-chosen');
    check('choosing a route shows the editor with all days placed', (await page.getByText(/✓ All 6 days placed/).count()) === 1);
    await page.getByText('Continue →').click(); await page.waitForTimeout(3000); await shot('4-after-route');
    check('Continue moves past the route step', (await page.getByText('STEP 4 OF 6').count()) + (await page.getByText('STEP 5 OF 6').count()) > 0, await page.locator('text=/STEP \\d OF 6/').first().textContent().catch(() => '?'));
  }

  // B. toddler + short hops
  await page.goto(`${SITE}/plan`); await page.waitForLoadState('networkidle');
  await page.getByText('✕ Exit').first().click().catch(() => {});
  await fillStep1And2({ kidAge: 3, short: true });
  await page.getByText('This looks good →').first().waitFor({ timeout: 40000 }).catch(() => {});
  await shot('5-route-options-toddler');
  const n2 = await page.getByText('This looks good →').count();
  check('toddler + short hops: options shown', n2 >= 1, `cards=${n2} calls=${routeCalls.join(',')}`);

  // C. show other ideas (Claude)
  if (n2) {
    await page.getByText('Show other ideas').click();
    await page.getByText('This looks good →').first().waitFor({ timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(500); await shot('6-other-ideas');
    check('"Show other ideas" returns new options', (await page.getByText('This looks good →').count()) >= 1 && (await page.getByText(/Could not plan a route/).count()) === 0, `calls=${routeCalls.join(',')}`);
  }
  check('no page errors', errs.filter(e => !/favicon|ERR_BLOCKED|youtube|unsplash|ipapi/i.test(e)).length === 0, errs.slice(0, 5).join(' | '));
  await browser.close();
} catch (e) {
  check('run completed', false, e.message);
} finally {
  if (idToken) { try { await idt('accounts:delete', { idToken }); console.log('throwaway account deleted'); } catch (e) { console.log('delete failed', e.message); } }
  writeFileSync(`${SHOTS}/result.txt`, out.join('\n'));
  console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
}
