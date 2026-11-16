'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ta = require(path.join(__dirname, '../../layers/shared/nodejs/trip-access.js'));

const day = (n) => ({ dayNumber: n, theme: `T${n}`, base: 'Hoi An', travelDay: n === 2, morningActivity: { activity: `secret ${n}` }, localEats: { name: 'x' } });

test('isLocked: free and not unlocked only', () => {
  assert.equal(ta.isLocked({ plan: 'free', unlocked_at: null }), true);
  assert.equal(ta.isLocked({ plan: 'free', unlocked_at: new Date() }), false);
  assert.equal(ta.isLocked({ plan: 'paid', unlocked_at: null }), false);
  assert.equal(ta.isLocked(undefined), false);
});

test('lockItinerary: Day 1 whole, later days teasers, extras counted not shown', () => {
  const src = { title: 'T', summary: 'S', totalEstimatedCost: 900, route: { bases: [] }, days: [day(3), day(1), day(2)], practicalTips: ['a', 'b'], avoidList: ['c'], stays: [{}, {}], accommodation: { recommendation: 'r' } };
  const out = ta.lockItinerary(src);
  assert.deepEqual(out.days.map((d) => d.dayNumber), [1, 2, 3]);
  assert.equal(out.days[0].morningActivity.activity, 'secret 1');
  assert.deepEqual(out.days[1], { dayNumber: 2, theme: 'T2', base: 'Hoi An', travelDay: true, locked: true });
  assert.equal(out.practicalTips, undefined);
  assert.equal(out.avoidList, undefined);
  assert.equal(out.stays, undefined);
  assert.equal(out.accommodation, undefined);
  assert.deepEqual(out.locked, { visibleDays: 1, totalDays: 3, stays: 2, tips: 2, avoid: 1 });
  assert.equal(out.route.bases.length, 0);
  assert.equal(src.days[0].morningActivity.activity, 'secret 3', 'input untouched');
  assert.equal(JSON.stringify(out).includes('secret 2'), false);
});

test('lockItinerary tolerates junk', () => {
  assert.deepEqual(ta.lockItinerary(null).days, []);
  assert.equal(ta.lockItinerary({ days: [day(1)], accommodation: { recommendation: 'r' } }).locked.stays, 1);
});

test('lockProgressDays', () => {
  const out = ta.lockProgressDays([{ day: 1, stops: ['a'] }, { day: 2, theme: 'x', stops: ['b'], eat: 'e' }]);
  assert.deepEqual(out[0], { day: 1, stops: ['a'] });
  assert.deepEqual(out[1], { day: 2, theme: 'x', base: null, travelDay: false, locked: true });
});

test('ensureUnlockColumn: adds the column, opens pre-lock free trips, once per container', async () => {
  ta._reset();
  const seen = [];
  const db = { query: async (sql) => { seen.push(sql); return { rows: [] }; } };
  await ta.ensureUnlockColumn(db);
  await ta.ensureUnlockColumn(db);
  assert.equal(seen.length, 2);
  assert.match(seen[0], /ADD COLUMN IF NOT EXISTS unlocked_at/);
  assert.match(seen[1], /UPDATE submissions SET unlocked_at = created_at[\s\S]*plan = 'free'[\s\S]*created_at < '2026-11-16T00:40:00Z'/);
  ta._reset();
});
