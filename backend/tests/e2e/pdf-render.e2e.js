'use strict';
// The real pdf-builder template rendered by the real Chromium package, the way Lambda runs it.
// AWS_EXECUTION_ENV makes @sparticuz/chromium unpack its Amazon Linux 2023 libraries, as on
// the nodejs24.x runtime: v123 only recognised "20.x" and would have broken every PDF on
// Node 24 (found Nov 2026 before the upgrade). Needs `npm ci` in backend/functions/pdf-builder.
process.env.AWS_EXECUTION_ENV = process.env.AWS_EXECUTION_ENV || `AWS_Lambda_nodejs${process.versions.node.split('.')[0]}.x`;
const path = require('path');
const { buildHTML, launchBrowser } = require(path.resolve(__dirname, '../../functions/pdf-builder/index.js'))._internal;

const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d && !c ? '  — ' + d : ''}`);
const act = (v, t) => ({ time: t, activity: `Walk the lanes near ${v}`, location: v, venueName: v, why: 'Quiet before the tour groups', cost: 0, isFree: true, insiderTip: 'Go before 8am' });
const day = (n, base) => ({ dayNumber: n, theme: `Slow day ${n} in ${base}`, base, morningActivity: act('Tra Que village', '7:30'), afternoonActivity: act('An Bang beach', '14:00'), eveningActivity: act('Old town lanterns', '18:30'), hiddenGem: 'A tiny coffee shop behind the market', dailyCost: 45, localEats: { name: 'Cao lau stall', dish: 'cao lau', cost: 4, vibe: 'busy, local' } });
const itinerary = { title: 'Coast, Lanterns and Imperial Rivers', summary: 'A slow walk through central Vietnam.', days: [day(1, 'Hoi An'), day(2, 'Hoi An'), day(3, 'Hue')], totalEstimatedCost: 135 };
const submission = { destination: 'Vietnam', days: 3, budget: 2000, currency: 'AUD', travelStyle: ['Nature'], travelPace: 'relaxed', travelerType: 'Couple' };

(async () => {
  let browser;
  try {
    const t0 = Date.now();
    browser = await launchBrowser();
    check(`Chromium starts on Node ${process.versions.node} with the Lambda AL2023 libraries`, (process.env.LD_LIBRARY_PATH || '').includes('al2023'), process.env.LD_LIBRARY_PATH);
    const page = await browser.newPage();
    await page.setContent(buildHTML(itinerary, submission, 'A$', null), { waitUntil: 'networkidle0', timeout: 30000 });
    const text = await page.evaluate(() => document.body.innerText);
    check('the itinerary HTML has every day', ['Slow day 1 in Hoi An', 'Slow day 3 in Hue', 'Cao lau stall'].every(s => text.includes(s)));
    const pdf = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } }));
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    check('a real multi-page PDF comes out', pdf.subarray(0, 5).toString() === '%PDF-' && pdf.length > 50000 && pages >= 2, `${pdf.length} bytes, ${pages} pages`);
    check('render time is sane (< 60 s)', Date.now() - t0 < 60000, `${Date.now() - t0} ms`);
  } catch (err) {
    check('render did not throw', false, err.message);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})();
