// Live check after #53–#55: home hero (A), Explore finder (B), pricing (D), guide season line, raw HTML.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
fs.mkdirSync('shots', { recursive: true });
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Australia/Sydney' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
const photoReqs = []; p.on('request', r => { if (r.url().includes('/photos/search')) photoReqs.push(decodeURIComponent(r.url().split('query=')[1] || '')); });

await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
await p.getByRole('button', { name: 'Accept' }).click({ timeout: 2000 }).catch(() => {});
check('home: hero heading', await p.getByRole('heading', { name: 'Where do you want to slow down?' }).isVisible());
const from = await p.getByLabel('Planning from').inputValue().catch(() => '');
check('home: planning from Sydney (time zone)', from === 'sydney', from);
const first = await p.locator('[aria-label="Country"] button').first().innerText();
check('home: first country is in season for November', /good in Nov/.test(first), first.replace(/\n/g, ' '));
await p.getByRole('button', { name: /^Vietnam/ }).click();
const tab = await p.getByRole('tab', { selected: true }).innerText();
check('home: Vietnam opens on its in-season route (the north)', tab === 'The north, slowly', tab);
await p.waitForTimeout(2500);
const img = await p.locator('img[alt*="The north, slowly"]').getAttribute('src').catch(() => '');
check('home: route photo from Unsplash, credited', /images\.unsplash\.com/.test(img || '') && await p.getByText(/^Photo:/).first().isVisible().catch(() => false), (img || '').slice(0, 70));
await p.screenshot({ path: 'shots/home_hero.png' });
await p.getByLabel('Planning from').selectOption('london');
check('home: London re-orders the list', /closest to London/.test(await p.locator('p').filter({ hasText: 'closest to' }).first().innerText()));
const homePricing = await p.locator('.pricing-grid').innerText().catch(() => '');
check('home pricing: Stripe prices with currency, no Wanderer', /A\$19 AUD/.test(homePricing) && /A\$59 AUD/.test(homePricing) && !/Wanderer|\/mo/.test(homePricing), homePricing.replace(/\n/g, ' ').slice(0, 160));
await p.getByLabel('Planning from').selectOption('sydney');
await p.getByRole('button', { name: 'Plan this route, free' }).click();
await p.waitForURL(/\/plan/, { timeout: 15000 });
check('home → planner with the country picked', p.url().includes('/plan'));

await p.goto(BASE + '/explore', { waitUntil: 'networkidle', timeout: 60000 });
check('explore: finder heading', await p.getByRole('heading', { name: 'Find your slow route' }).isVisible());
const cnt = async () => Number((await p.getByText(/Asia routes match/).innerText()).match(/^(\d+)/)[1]);
const nov = await cnt();
check('explore: defaults to Nov (now) with in-season routes', await p.getByRole('button', { name: 'Nov (now)' }).getAttribute('aria-pressed') === 'true' && nov >= 5, `${nov}`);
await p.getByRole('button', { name: 'Any month' }).click();
check('explore: any month → all 21', await cnt() === 21);
await p.getByRole('button', { name: 'Show all routes' }).click();
check('explore: kids filter narrows', await cnt() < 21);
await p.waitForTimeout(2000);
await p.screenshot({ path: 'shots/explore_finder.png' });

await p.goto(BASE + '/pricing', { waitUntil: 'networkidle', timeout: 60000 });
const pr = await p.locator('.pricing-cards-grid').innerText();
check('pricing: One trip A$19 AUD, Trip Pass A$59 AUD / 6 trips / 12 months', /A\$19 AUD/.test(pr) && /A\$59 AUD/.test(pr) && /6 trips · use within 12 months/.test(pr), pr.replace(/\n/g, ' ').slice(0, 200));
check('pricing: currency note', await p.getByText(/Prices in AUD, charged by Stripe/).isVisible());
await p.screenshot({ path: 'shots/pricing.png' });

await p.goto(BASE + '/guides/vietnam', { waitUntil: 'networkidle', timeout: 60000 });
check('guide: best time per route', await p.getByText(/Best Mar–May/).first().isVisible().catch(() => false) && await p.getByText(/When to go:/).first().isVisible().catch(() => false));

const api = await (await fetch('https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/pricing?country=AU')).json();
check('GET /pricing live', api?.data?.plans?.length === 2 && api.data.plans[0].currency === 'AUD', JSON.stringify(api.data?.plans?.map(x => [x.plan, x.amount, x.currency, x.trips])));
const raw = await (await fetch(BASE + '/')).text();
check('saved home page HTML has the new hero', raw.includes('Where do you want to slow down?'));
check('no page errors', errors.length === 0, errors.join(' | '));
check('photo searches use the checked queries', photoReqs.some(q => /Ninh Binh/.test(q)), photoReqs.slice(0, 6).join(', '));
fs.writeFileSync('report.txt', out.join('\n') + `\n\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed\n`);
await b.close();
