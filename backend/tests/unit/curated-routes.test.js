'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const cr = require(path.join(LAYER, 'curated-routes.js'));
const rp = require(path.join(LAYER, 'route-plan.js'));

test('ten launch countries, every route well-formed', () => {
  assert.equal(cr.CURATED_COUNTRIES.length, 10);
  for (const [key, c] of Object.entries(cr.COUNTRIES)) {
    assert.ok(c.routes.length >= 2, `${key} has at least 2 routes`);
    const ids = new Set();
    for (const r of c.routes) {
      assert.ok(!ids.has(r.id), `unique id ${r.id}`); ids.add(r.id);
      assert.ok(r.name && r.summary && typeof r.kidFriendly === 'boolean', r.id);
      assert.equal(r.bases[0].transferIn, null, `${r.id}: first stop has no transfer`);
      for (const [i, b] of r.bases.entries()) {
        assert.ok(b.name && b.weight > 0 && b.why && b.stayType, `${r.id}/${b.name}`);
        assert.ok(Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180, `${r.id}/${b.name} coordinates`);
        if (i > 0) assert.ok(b.transferIn && b.transferIn.hours > 0 && b.transferIn.mode, `${r.id}/${b.name} transfer`);
      }
      if (r.kidFriendly) assert.ok(cr.longestTransfer(r.bases) <= 4.5, `${r.id} is kid-friendly but has a ${cr.longestTransfer(r.bases)} h leg`);
    }
  }
});

test('findCountry: country-level choices only, case/accents ignored', () => {
  assert.equal(cr.findCountry('Vietnam').name, 'Vietnam');
  assert.equal(cr.findCountry('viet nam').name, 'Vietnam');
  assert.equal(cr.findCountry('Sri Lanka, Asia').name, 'Sri Lanka');
  assert.equal(cr.findCountry('Hanoi, Vietnam'), null, 'a city is left to Claude');
  assert.equal(cr.findCountry('Peru'), null);
  assert.equal(cr.findCountry(''), null);
});

test('fitDays: days add up, ≥1 each, short trips cut from the end (transfers stay true)', () => {
  const route = cr.COUNTRIES.vietnam.routes.find(r => r.id === 'vn-north-centre');
  for (const days of [2, 3, 5, 7, 10, 14, 21]) {
    const bases = cr.fitDays(route.bases, days);
    assert.equal(bases.reduce((a, b) => a + b.days, 0), days, `sum for ${days}`);
    assert.ok(bases.every(b => b.days >= 1));
    assert.ok(bases.length <= cr.maxStops(days));
    bases.forEach((b, i) => assert.equal(b.name, route.bases[i].name, 'prefix of the original route'));
  }
  assert.equal(cr.maxStops(4), 1);
  assert.equal(cr.maxStops(7), 3);
  assert.equal(cr.maxStops(10), 4);
});

test('options: 10 days Vietnam — best fits first, Sapa route flagged for its 5.5 h leg', () => {
  const { country, options } = cr.curatedOptions({ destination: 'Vietnam', days: 10, prefs: rp.sanitizePrefs({}) });
  assert.equal(country, 'Vietnam');
  assert.equal(options.length, 3);
  assert.ok(options[0].fitsConstraints);
  const classic = options.find(o => o.id === 'vn-north-centre');
  assert.deepEqual(classic.bases.map(b => b.name), ['Hanoi', 'Sapa', 'Hanoi', 'Hoi An']);
  assert.equal(classic.fitsConstraints, false);
  assert.match(classic.caution, /5.5 h/);
  assert.equal(options.at(-1).id, 'vn-north-centre', 'non-fitting routes sort last');
  for (const o of options) {
    assert.ok(rp.sanitizeRoute(o, 10), `${o.id} survives sanitizeRoute`);
    assert.equal(o.source, 'curated');
  }
});

test('options: kids + short transfers only — nothing long is marked as fitting', () => {
  const { options } = cr.curatedOptions({ destination: 'India', days: 10, prefs: rp.sanitizePrefs({ kids: [4], transferComfort: 'short' }) });
  assert.ok(options.every(o => !o.fitsConstraints), 'all Indian routes have legs > 2.5 h');
  assert.ok(options.find(o => o.id === 'in-himachal').caution.includes('kids'));
});

test('options: long journeys fine → everything fits; short trips de-duplicate identical cuts', () => {
  const longOk = cr.curatedOptions({ destination: 'Vietnam', days: 10, prefs: rp.sanitizePrefs({ transferComfort: 'long' }) });
  assert.ok(longOk.options.every(o => o.fitsConstraints));
  const short = cr.curatedOptions({ destination: 'Vietnam', days: 3, prefs: rp.sanitizePrefs({}) });
  const keys = short.options.map(o => o.bases.map(b => b.name).join('>'));
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(short.options.every(o => o.bases.length === 1));
  assert.match(short.options.find(o => o.id === 'vn-central-easy').summary, /Shortened for 3 days/);
});

test('not curated → null (Claude takes over)', () => {
  assert.equal(cr.curatedOptions({ destination: 'Peru', days: 10 }), null);
});

// ── Seasons (Nov 16 2026): best months per route's region ──────────────────────
test('seasons: every route has best months (1–12) and a reason', () => {
  for (const c of Object.values(cr.COUNTRIES)) {
    for (const r of c.routes) {
      assert.ok(r.seasons && Array.isArray(r.seasons.best) && r.seasons.best.length >= 3, `${r.id} needs seasons`);
      assert.ok(r.seasons.best.every(m => Number.isInteger(m) && m >= 1 && m <= 12), `${r.id} months`);
      assert.ok(r.seasons.note.length > 10 && !r.seasons.note.endsWith('.'), `${r.id} note`);
    }
  }
});

test('seasons: every month has at least 5 Asia routes in season (home page is never empty)', () => {
  const asia = ['Vietnam', 'Japan', 'India', 'Thailand', 'Sri Lanka', 'Indonesia', 'Nepal'];
  const routes = Object.values(cr.COUNTRIES).filter(c => asia.includes(c.name)).flatMap(c => c.routes);
  for (let m = 1; m <= 12; m++) {
    assert.ok(routes.filter(r => r.seasons.best.includes(m)).length >= 5, `month ${m}`);
  }
});

test('monthRanges: joins runs and wraps over the new year', () => {
  assert.equal(cr.monthRanges([10, 11, 12, 1, 2, 3]), 'Oct–Mar');
  assert.equal(cr.monthRanges([3, 4, 5, 10, 11]), 'Mar–May, Oct–Nov');
  assert.equal(cr.monthRanges([6]), 'Jun');
  assert.equal(cr.monthRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'All year');
});

test('curatedOptions: travel month puts in-season routes first and flags the rest', () => {
  const nov = cr.curatedOptions({ destination: 'Vietnam', days: 9, travelDate: '2026-11-20', prefs: { transferComfort: 'long' } });
  assert.equal(nov.options[0].inSeason, true);
  const off = nov.options.find(o => o.inSeason === false);
  assert.match(off.caution, /^Off season in Nov\. .+ Best: /);
  const none = cr.curatedOptions({ destination: 'Vietnam', days: 9 });
  assert.ok(none.options.every(o => o.inSeason === null && !/Off season/.test(o.caution || '')));
});

test('route prompts: travel month → prefer regions in season; no date → say the best months', () => {
  const base = { destination: 'Laos', days: 8, travelStyle: [], prefs: { adults: 2, kids: [], transferComfort: 'medium' } };
  assert.match(rp.buildRouteOptionsPrompt({ ...base, travelDate: '2026-07-10' }), /travel in July\. Prefer regions at their best/);
  assert.match(rp.buildRouteOptionsPrompt({ ...base, travelDate: '' }), /no dates yet\. End each summary with the best months/);
  assert.match(rp.buildRouteOptionsPrompt({ ...base, travelDate: '2026-01-02', angle: Object.keys(rp.ROUTE_ANGLES || { x: 1 })[0] }), /Season:/);
});
