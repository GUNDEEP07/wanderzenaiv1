'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const { pickForUser, visitedCountries } = require(path.join(LAYER, 'picks.js'));
const curated = require(path.join(LAYER, 'curated-routes.js'));

test('regions are data: Asia is live, Europe/Oceania exist but are not promoted', () => {
  assert.deepEqual(curated.LIVE_REGIONS, ['asia']);
  assert.ok(curated.LIVE_COUNTRIES.includes('Vietnam'));
  assert.ok(!curated.LIVE_COUNTRIES.includes('Italy'));
  for (const c of Object.values(curated.COUNTRIES)) {
    assert.ok(curated.REGIONS.some(r => r.id === c.region), `${c.name} has a known region`);
  }
});

test('picks: only live-region curated routes, in season first, countries not yet planned first', () => {
  const inSeasonCountries = (m) => curated.LIVE_COUNTRIES.filter(n => curated.COUNTRIES[n.toLowerCase()].routes.some(r => r.seasons.best.includes(m)));
  for (let month = 1; month <= 12; month++) {
    const planned = ['Japan', 'Vietnam'];
    const picks = pickForUser({ pastDestinations: ['Kyoto', 'Hoi An, Vietnam'], month, seed: 'u1:1' });
    assert.equal(picks.length, 3);
    assert.equal(new Set(picks.map(p => p.country)).size, 3, 'one route per country');
    for (const p of picks) {
      assert.ok(curated.LIVE_COUNTRIES.includes(p.country), p.country);
      assert.ok(p.routeId && p.photoQuery && p.bestLabel && p.reason);
    }
    const good = inSeasonCountries(month);
    // never an off-season pick while an in-season country is left out
    assert.equal(picks.filter(p => p.inSeason).length, Math.min(3, good.length), `month ${month}`);
    // a planned country only when fewer than 3 unplanned countries are in season
    const freshGood = good.filter(n => !planned.includes(n)).length;
    if (freshGood >= 3) assert.ok(picks.every(p => !planned.includes(p.country)), `month ${month}: ${picks.map(p => p.country)}`);
  }
});

test('picks: families get kid-friendly routes; same user+week is stable; another week can differ', () => {
  const fam = pickForUser({ travelerTypes: ['Family'], month: 11, seed: 'u2:5' });
  assert.ok(fam.filter(p => p.reason.includes('easy with kids')).length >= 1);
  assert.deepEqual(pickForUser({ month: 11, seed: 'u3:7' }), pickForUser({ month: 11, seed: 'u3:7' }));
  const weeks = new Set(Array.from({ length: 8 }, (_, w) => pickForUser({ month: 11, seed: `u3:${w}` }).map(p => p.routeId).join()));
  assert.ok(weeks.size > 1, 'picks rotate across weeks');
});

test('picks: when every live country is planned, still suggests (any live country)', () => {
  const all = curated.LIVE_COUNTRIES.slice();
  assert.equal(visitedCountries(all).size >= all.length, true);
  assert.equal(pickForUser({ pastDestinations: all, month: 3, seed: 'x' }).length, 3);
});

test('picks: switching a region on (data only) brings its countries in', () => {
  const live = [...curated.LIVE_COUNTRIES, 'Italy', 'Portugal'];
  const many = new Set();
  for (let w = 0; w < 30; w++) pickForUser({ month: 5, seed: `s:${w}`, liveCountries: live, count: 9 }).forEach(p => many.add(p.country));
  assert.ok(many.has('Italy') && many.has('Portugal'));
});
