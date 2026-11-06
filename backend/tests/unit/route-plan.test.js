'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const rp = require(path.join(LAYER, 'route-plan.js'));
const sv = require(path.join(LAYER, 'selected-venues.js'));

const japan = {
  bases: [
    { name: 'Kyoto', country: 'Japan', lat: 35.01, lng: 135.77, days: 4, stayType: 'machiya guesthouse', dayTrips: [{ name: 'Kurama' }, { name: 'Ohara' }] },
    { name: 'Takayama', country: 'Japan', lat: 36.14, lng: 137.25, days: 3, transferIn: { mode: 'Train', hours: 3.5, note: 'via Nagoya' } },
    { name: 'Kanazawa', country: 'Japan', lat: 36.56, lng: 136.66, days: 3, transferIn: { mode: 'bus', hours: 2.25 } },
  ],
};

test('sanitizeRoute keeps valid bases, normalises transfer mode, drops transferIn on the first base', () => {
  const r = rp.sanitizeRoute({ bases: [{ ...japan.bases[0], transferIn: { mode: 'car' } }, ...japan.bases.slice(1)] }, 10);
  assert.deepEqual(r.bases.map(b => [b.name, b.days]), [['Kyoto', 4], ['Takayama', 3], ['Kanazawa', 3]]);
  assert.equal(r.bases[0].transferIn, null);
  assert.deepEqual(r.bases[1].transferIn, { mode: 'train', hours: 3.5, note: 'via Nagoya' });
  assert.deepEqual(r.bases[0].dayTrips.map(d => d.name), ['Kurama', 'Ohara']);
});

test('sanitizeRoute rejects junk; caps bases; bad coordinates become null', () => {
  assert.equal(rp.sanitizeRoute(null, 5), null);
  assert.equal(rp.sanitizeRoute({ bases: [] }, 5), null);
  assert.equal(rp.sanitizeRoute({ bases: [{ name: '' }, { foo: 1 }] }, 5), null);
  const many = rp.sanitizeRoute({ bases: Array.from({ length: 9 }, (_, i) => ({ name: `Town ${i}`, days: 1 })) }, 30);
  assert.equal(many.bases.length, rp.MAX_BASES);
  const bad = rp.sanitizeRoute({ bases: [{ name: 'X', lat: 200, lng: 10, days: 2 }] }, 2);
  assert.equal(bad.bases[0].lat, null);
  assert.equal(bad.bases[0].lng, null);
  const mode = rp.sanitizeRoute({ bases: [{ name: 'A', days: 1 }, { name: 'B', days: 1, transferIn: { mode: 'teleport' } }] }, 2);
  assert.equal(mode.bases[1].transferIn.mode, 'other');
});

test('days always add up to the trip length (too many, too few, more bases than days)', () => {
  const sum = (r) => r.bases.reduce((a, b) => a + b.days, 0);
  const tooMany = rp.sanitizeRoute({ bases: [{ name: 'A', days: 6 }, { name: 'B', days: 6 }] }, 7);
  assert.equal(sum(tooMany), 7);
  assert.ok(tooMany.bases.every(b => b.days >= 1));
  const tooFew = rp.sanitizeRoute({ bases: [{ name: 'A', days: 1 }, { name: 'B', days: 2 }] }, 9);
  assert.equal(sum(tooFew), 9);
  const crowded = rp.sanitizeRoute({ bases: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }] }, 2);
  assert.deepEqual(crowded.bases.map(b => b.name), ['A', 'B']);
  assert.equal(sum(crowded), 2);
});

test('dayPlan maps days to bases; the first day at each later base is a travel day', () => {
  const plan = rp.dayPlan(rp.sanitizeRoute(japan, 10));
  assert.equal(plan.length, 10);
  assert.deepEqual(plan.filter(d => d.travelDay).map(d => d.day), [5, 8]);
  assert.equal(plan[4].base.name, 'Takayama');
  assert.deepEqual(rp.daysForBase(rp.sanitizeRoute(japan, 10), 'kanazawa, Japan'), [8, 9, 10]);
});

test('prompt blocks: overview lists day ranges; batch lines name the base and the travel day', () => {
  const r = rp.sanitizeRoute(japan, 10);
  const overview = rp.formatRouteOverview(r);
  assert.match(overview, /Days 1–4: Kyoto, Japan \(stay: machiya guesthouse\)/);
  assert.match(overview, /Days 5–7: Takayama, Japan — arrive by train \(~3.5 h\) — via Nagoya/);
  const batch = rp.formatRouteForDays(r, [4, 5, 6]);
  assert.match(batch, /Day 4: based in Kyoto, Japan.*Day-trip options from here: Kurama, Ohara/);
  assert.match(batch, /Day 5: TRAVEL DAY Kyoto → Takayama by train/);
  assert.match(batch, /Day 6: based in Takayama/);
  assert.equal(rp.formatRouteForDays(null, [1]), '');
  assert.deepEqual(rp.basesForDays(r, [3, 4, 5]).map(b => b.name), ['Kyoto', 'Takayama']);
});

test('parseRouteResponse: tolerates text around the JSON, balances days, keeps summary', () => {
  const text = 'Here you go:\n' + JSON.stringify({ summary: 'Temples, then mountains, then the coast', bases: japan.bases.map(b => ({ ...b, days: 5 })) });
  const r = rp.parseRouteResponse(text, 10);
  assert.equal(r.bases.reduce((a, b) => a + b.days, 0), 10);
  assert.equal(r.summary, 'Temples, then mountains, then the coast');
  assert.throws(() => rp.parseRouteResponse('no json here', 10), /No JSON/);
  assert.throws(() => rp.parseRouteResponse('{"bases":[]}', 10), /no usable bases/);
});

test('buildRoutePrompt states the day total and the slow-travel rules', () => {
  const p = rp.buildRoutePrompt({ destination: 'Japan', days: 10, travelStyle: ['Nature'], travelPace: 'relaxed', interests: 'onsen, hiking' });
  assert.match(p, /must add up to exactly 10/);
  assert.match(p, /small towns, villages and nature/);
  assert.match(p, /interests: onsen, hiking/);
});

test('selected_venues keeps a sanitised route; unpinned picks land on their base\'s non-travel days', () => {
  const raw = {
    version: 2,
    route: japan,
    picks: [
      { name: 'Hida Folk Village', destination: 'Takayama, Japan' },
      { name: 'Omicho Market', destination: 'Kanazawa' },
      { name: 'Philosopher’s Path', destination: 'Kyoto', day: 2 },
      { name: 'Somewhere Else', destination: 'Osaka' },
    ],
    interests: [],
  };
  const clean = sv.sanitizeSelectedVenues(raw, 10);
  assert.equal(clean.route.bases.length, 3);
  const plan = sv.planPicks(raw, 10);
  const day = (n) => plan.picks.find(p => p.name === n).day;
  assert.ok([6, 7].includes(day('Hida Folk Village')), `Takayama non-travel day, got ${day('Hida Folk Village')}`);
  assert.ok([9, 10].includes(day('Omicho Market')), `Kanazawa non-travel day, got ${day('Omicho Market')}`);
  assert.equal(day('Philosopher’s Path'), 2, 'pinned day kept');
  assert.ok(day('Somewhere Else') >= 1 && day('Somewhere Else') <= 10, 'unknown base → anywhere');
  assert.equal(plan.route.bases[1].name, 'Takayama');
});

test('a submission without a route behaves exactly as before', () => {
  const plan = sv.planPicks({ version: 2, picks: [{ name: 'A place' }], interests: [] }, 3);
  assert.equal(plan.route, null);
  assert.equal(plan.picks[0].day, 1);
  assert.equal('route' in sv.sanitizeSelectedVenues({ version: 2, picks: [], interests: [], route: { bases: [] } }, 3), false);
});
