'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const v = require(path.join(__dirname, '../../functions/itinerary-gen/validate.js'));

const day = (n, venues = {}, eats = null) => ({
  dayNumber: n,
  morningActivity: { venueName: venues.m || null },
  afternoonActivity: { venueName: venues.a || null },
  eveningActivity: { venueName: venues.e || null },
  localEats: { venueName: eats },
});

test('finds a venue repeated on later days, ignoring case, accents and bracketed names', () => {
  const days = [
    day(1, { m: 'Fushimi Inari Taisha' }),
    day(2, { a: 'fushimi inari taisha (伏見稲荷大社)' }),
    day(3, { e: 'Café Kosci' }),
    day(4, { m: 'Cafe Kosci' }),
  ];
  const dups = v.findDuplicateVenues(days);
  assert.deepEqual(dups.map(d => [d.name, d.firstDay, d.repeatDays]), [
    ['Fushimi Inari Taisha', 1, [2]],
    ['Café Kosci', 3, [4]],
  ]);
});

test('a venue repeated within one day is not a duplicate; null names are ignored', () => {
  const days = [day(1, { m: 'Nishiki Market' }, 'Nishiki Market'), day(2), day(3)];
  assert.deepEqual(v.findDuplicateVenues(days), []);
});

test('localEats repeats across days are caught', () => {
  const days = [day(1, {}, 'Ippudo'), day(2, {}, 'IPPUDO')];
  assert.deepEqual(v.findDuplicateVenues(days)[0].repeatDays, [2]);
});

test('planRepairs: pick problems first, then duplicates, capped at 3 days, avoid lists exclude the day itself', () => {
  const days = [
    day(1, { m: 'Alpha Cafe' }), day(2, { m: 'Alpha Cafe' }), day(3, { m: 'Bravo Park' }),
    day(4, { m: 'Bravo Park' }), day(5, { m: 'Charlie Market' }), day(6, { m: 'Charlie Market' }),
    day(7, { m: 'Delta Temple' }), day(8, { m: 'Delta Temple' }),
  ];
  const coverage = { missing: [{ name: 'Pick X', day: 8 }], wrongDay: [] };
  const repairs = v.planRepairs({ days, coverage });
  // 4 days need work (2, 4, 6, 8); the pick day wins a slot, then the earliest duplicates.
  assert.deepEqual([...repairs.keys()], [2, 4, 8]);
  assert.deepEqual(repairs.get(8).include.map(p => p.name), ['Pick X']);
  assert.ok(repairs.get(2).avoid.includes('Alpha Cafe'), 'day 2 must avoid Alpha Cafe (used on day 1)');
  assert.ok(!repairs.get(2).avoid.includes(undefined));
  assert.ok(repairs.get(8).avoid.includes('Delta Temple'), 'day 8 avoids Delta Temple because day 7 has it');
});

test('very short names are not treated as venues', () => {
  assert.deepEqual(v.findDuplicateVenues([day(1, { m: 'Go' }), day(2, { m: 'go' })]), []);
});

test('planRepairs ignores picks for days that do not exist and returns nothing when clean', () => {
  const days = [day(1, { m: 'A' }), day(2, { m: 'B' })];
  assert.equal(v.planRepairs({ days, coverage: { missing: [{ name: 'Z', day: 9 }], wrongDay: [] } }).size, 0);
  assert.equal(v.planRepairs({ days, coverage: { missing: [], wrongDay: [] } }).size, 0);
});

test('repairRules lists places to avoid and picks to include', () => {
  const text = v.repairRules({ avoid: ['A', 'B'], include: [{ name: 'Pick X', address: '1 Road' }], reasons: [] });
  assert.match(text, /REWRITTEN/);
  assert.match(text, /Do NOT use any of these places.*A; B/);
  assert.match(text, /- Pick X — 1 Road/);
});
