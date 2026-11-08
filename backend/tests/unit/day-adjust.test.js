'use strict';

// Run: node --test backend/tests/unit/*.test.js
// "Adjust this day" (option A): note cleaning, limits summary, prompt block, routes, email.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'pg') return { Pool: class {} };
  if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  return origLoad.call(this, request, ...rest);
};
const adj = require(path.join(LAYER, 'day-adjust.js'));
const { adjustRouteOf } = require(path.join(__dirname, '../../functions/form-handler/adjust-day.js'));
const { DEFAULT_LIMITS } = require(path.join(LAYER, 'rate-limit.js'));

const ID = 'wz_abc123_ABCDEFGHIJKLMNOP';

test('notes: cleaned, 3–300 characters, text only', () => {
  assert.deepEqual(adj.cleanNote('  less\u0000 walking\n please '), { value: 'less walking please' });
  assert.ok(adj.cleanNote('ab').error);
  assert.ok(adj.cleanNote('x'.repeat(301)).error);
  assert.ok(adj.cleanNote(42).error);
  assert.ok(adj.cleanNote(undefined).error);
});

test('summary: failed attempts do not count; pending is reported', () => {
  const at = new Date();
  const s = adj.summarize([
    { id: 1, day_number: 2, note: 'a', status: 'done', created_at: at },
    { id: 2, day_number: 3, note: 'b', status: 'failed', created_at: at },
    { id: 3, day_number: 1, note: 'c', status: 'pending', created_at: at },
  ]);
  assert.equal(s.max, 3);
  assert.equal(s.used, 2);
  assert.equal(s.remaining, 1);
  assert.deepEqual(s.pending && { id: s.pending.id, day: s.pending.day }, { id: '3', day: 1 });
  assert.equal(s.last.status, 'pending');
  assert.equal(adj.summarize([]).remaining, 3);
});

test('prompt block fences the note and lists places used on other days', () => {
  const days = [1, 2, 3].map(n => ({
    dayNumber: n, theme: `T${n}`,
    morningActivity: { venueName: `M${n}` }, afternoonActivity: { location: `A${n}` }, eveningActivity: { venueName: null, location: null },
    localEats: { name: `E${n}` },
  }));
  const other = adj.venuesOutside(days, 2);
  assert.ok(other.includes('M1') && other.includes('E3') && !other.includes('M2'));
  const block = adj.adjustmentRules({ note: 'add a market', currentDay: days[1], otherVenues: other });
  assert.match(block, /<change_request>add a market<\/change_request>/);
  assert.match(block, /<current_day>\{"theme":"T2","morning":"M2"/);
  assert.match(block, /do not reuse these places: M1; A1; E1; M3; A3; E3/);
  assert.match(block, /keep the same base town/);
});

test('routes: only well-formed ids and day numbers', () => {
  assert.deepEqual(adjustRouteOf({ httpMethod: 'GET', path: `/itinerary/${ID}/adjustments` }), { kind: 'list', id: ID });
  assert.deepEqual(adjustRouteOf({ httpMethod: 'POST', path: `/itinerary/${ID}/days/4/adjust` }), { kind: 'start', id: ID, day: 4 });
  assert.deepEqual(adjustRouteOf({ httpMethod: 'POST', path: `/itinerary/${ID}/days/x/adjust` }), { kind: 'bad' });
  assert.deepEqual(adjustRouteOf({ httpMethod: 'GET', path: '/itinerary/../adjustments' }), { kind: 'bad' });
  assert.equal(adjustRouteOf({ httpMethod: 'GET', path: `/itinerary/${ID}/progress` }), null);
  assert.equal(adjustRouteOf({ httpMethod: 'POST', path: '/submit' }), null);
});

test('adjustDay has its own rate limit', () => {
  assert.ok(Array.isArray(DEFAULT_LIMITS.adjustDay) && DEFAULT_LIMITS.adjustDay.length);
});
