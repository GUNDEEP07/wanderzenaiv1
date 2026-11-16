// Live check after #58: no off-region places on home/Explore; strip + browse from curated data.
import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'https://www.wanderzenai.com';
const API = 'https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod';
fs.mkdirSync('shots', { recursive: true });
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
const ASIA = ['Vietnam', 'Japan', 'India', 'Thailand', 'Sri Lanka', 'Indonesia', 'Nepal'];
const OFF = /Patagonia|Faroe|Ljubljana|Slovenia|Chile|Rwanda|Fiji|Morocco|Colombia|Croatia|Albania|Ethiopia|Tanzania|Mexico|Peru|Jordan|Oman|Georgia/;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Australia/Sydney' })).newPage();
const errors = []; p.on('pageerror', e => errors.push(e.message.slice(0, 160)));
await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
await p.getByRole('button', { name: 'Accept' }).click({ timeout: 2000 }).catch(() => {});
for (let y = 0; y < 9000; y += 600) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(150); }
const home = await p.locator('body').innerText();
check('home: no off-region places', !OFF.test(home), (home.match(OFF) || [])[0] || '');
const strip = await p.locator('.photo-strip-grid').innerText();
check('home: photo strip = curated Asia countries', ASIA.filter(c => strip.includes(c)).length >= 5 && !/PATAGONIA|FAROE/i.test(strip), strip.replace(/\n/g, ' | ').slice(0, 200));
check('home: strip photos credited', await p.locator('.photo-strip-grid >> text=Unsplash').count() >= 3);
await p.locator('.photo-strip-grid').scrollIntoViewIfNeeded(); await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/home_strip.png' });
await p.goto(BASE + '/explore', { waitUntil: 'networkidle', timeout: 60000 });
for (let y = 0; y < 9000; y += 600) { await p.evaluate(y => window.scrollTo(0, y), y); await p.waitForTimeout(150); }
const ex = await p.locator('body').innerText();
check('explore: no off-region places', !OFF.test(ex), (ex.match(OFF) || [])[0] || '');
check('explore: browse by region shows curated countries with route counts', /3 hand-picked routes/.test(ex));
const tr = await (await fetch(`${API}/recommendations/trending`, { headers: { Origin: BASE } })).json().catch(() => ({}));
const trList = (tr.data?.trending || tr.trending || []).map(t => t.destination);
check('trending API: only live countries', trList.length > 0 && trList.every(d => ASIA.includes(d.split(',').pop().trim())), trList.join(' | '));
const pr = await fetch(`${API}/recommendations/personalised`);
check('picked-for-you still needs sign-in', pr.status === 401, String(pr.status));
check('no page errors', errors.length === 0, errors.join(' | '));
fs.writeFileSync('report.txt', out.join('\n') + `\n\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed\n`);
await b.close();
