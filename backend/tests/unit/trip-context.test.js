'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Trip companion: which trip the dashboard chat talks about, and the brief it gets.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pickCompanionTrip, tripBrief } = require(path.join(__dirname, '../../layers/shared/nodejs/trip-context.js'));

const NOW = new Date('2026-11-22T03:00:00Z');
const row = (id, o = {}) => ({ id, status: 'email_sent', days: 5, travel_date: null, created_at: '2026-11-20T00:00:00Z', ...o });

test('soonest trip that is ahead or under way wins', () => {
  const rows = [
    row('later', { travel_date: '2027-03-01' }),
    row('soon', { travel_date: '2026-12-10' }),
    row('over', { travel_date: '2026-10-01' }),
  ];
  assert.equal(pickCompanionTrip(rows, NOW).id, 'soon');
  // under way: started 2 days ago, 5 days long
  assert.equal(pickCompanionTrip([row('now', { travel_date: '2026-11-20' }), row('later', { travel_date: '2027-01-01' })], NOW).id, 'now');
});

test('without dated trips: the newest undated trip from the last 120 days', () => {
  assert.equal(pickCompanionTrip([row('a', { created_at: '2026-10-01T00:00:00Z' }), row('b', { created_at: '2026-11-21T00:00:00Z' })], NOW).id, 'b');
  assert.equal(pickCompanionTrip([row('old', { created_at: '2026-05-01T00:00:00Z' })], NOW), null);
});

test('only delivered trips count', () => {
  assert.equal(pickCompanionTrip([row('x', { status: 'processing', travel_date: '2026-12-01' }), row('y', { status: 'failed' })], NOW), null);
  assert.equal(pickCompanionTrip([], NOW), null);
  assert.equal(pickCompanionTrip(null, NOW), null);
});

test('brief: dates per day, activities, stays; locked trips keep later days out', () => {
  const it = {
    title: 'T', route: { bases: [{ name: 'Queenstown', days: 3 }, { name: 'Te Anau', days: 2 }] },
    days: [1, 2].map((d) => ({ dayNumber: d, theme: `Th${d}`, base: 'Queenstown', morningActivity: { time: '9:00', activity: `ACT${d}`, location: 'L', insiderTip: `TIP${d}` } })),
    stays: [{ base: 'Queenstown', type: 'homestay', why: 'SECRET-STAY' }],
    practicalTips: ['SECRET-TIP'],
  };
  const sub = { destination: 'Queenstown', days: 2, travel_date: '2026-12-10', currency: 'AUD' };
  const full = tripBrief(sub, it);
  assert.match(full, /Route: Queenstown \(3 days\) → Te Anau \(2 days\)/);
  assert.match(full, /Day 1 \(Thu,? 10 Dec\)/);
  assert.match(full, /Day 2 \(Fri,? 11 Dec\)/);
  assert.ok(full.includes('ACT2') && full.includes('SECRET-STAY') && full.includes('SECRET-TIP'));
  const locked = tripBrief(sub, it, { locked: true });
  assert.ok(locked.includes('ACT1'));
  assert.ok(!locked.includes('ACT2') && !locked.includes('SECRET-STAY') && !locked.includes('SECRET-TIP'));
  assert.match(locked, /Day 2.*Th2 \[LOCKED/);
});

test('brief is capped', () => {
  const it = { days: Array.from({ length: 30 }, (_, i) => ({ dayNumber: i + 1, theme: 'x'.repeat(100), morningActivity: { activity: 'y'.repeat(220), insiderTip: 'z'.repeat(140) }, afternoonActivity: { activity: 'y'.repeat(220) }, eveningActivity: { activity: 'y'.repeat(220) } })) };
  assert.ok(tripBrief({ destination: 'X', days: 30 }, it).length <= 9000);
});
