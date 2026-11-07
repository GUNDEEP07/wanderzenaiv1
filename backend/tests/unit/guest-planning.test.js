'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Guest planning (Nov 2026): route-cache keys, guest rate-limit buckets, plan-draft checks.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'pg') return { Pool: class {} };
  if (request === 'stripe') return () => ({});
  if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  return origLoad.call(this, request, ...rest);
};
const { routeCacheKey, rateLimited } = require(path.join(__dirname, '../../functions/form-handler/index.js'))._internal;
const { validateDraft } = require(path.join(__dirname, '../../functions/profile/handler.js'))._internal;
const { DEFAULT_LIMITS } = require(path.join(LAYER, 'rate-limit.js'));

const trip = { destination: 'Peru', days: 10, travelStyle: ['Nature', 'Food'], travelPace: 'relaxed', interests: '', travelDate: '2027-03-14', prefs: { adults: 2, kids: [] } };

test('route cache key: same trip shape → same key, whoever asks and however it is typed', () => {
  const k = routeCacheKey(trip);
  assert.match(k, /^[0-9a-f]{64}$/);
  assert.equal(routeCacheKey({ ...trip, destination: '  peru ' }), k);
  assert.equal(routeCacheKey({ ...trip, travelStyle: ['food', 'nature'] }), k);
  assert.equal(routeCacheKey({ ...trip, travelDate: '2027-03-29' }), k, 'same month');
});

test('route cache key: anything that changes the routes changes the key', () => {
  const k = routeCacheKey(trip);
  for (const change of [
    { days: 12 }, { destination: 'Chile' }, { travelPace: 'packed' }, { travelDate: '2027-07-01' },
    { prefs: { adults: 2, kids: [4] } }, { prefs: { adults: 2, kids: [], transferComfort: 'short' } }, { interests: 'birds' },
  ]) assert.notEqual(routeCacheKey({ ...trip, ...change }), k, JSON.stringify(change));
});

test('every guest bucket the planner uses has limits (an unknown bucket would fail open)', () => {
  for (const b of ['guestRoute', 'guestPreview', 'guestAi']) assert.ok(Array.isArray(DEFAULT_LIMITS[b]) && DEFAULT_LIMITS[b].length, b);
});

test('guests are checked by IP and against the shared cap; users only by account', async () => {
  const seen = [];
  const db = { query: async (_sql, params) => { seen.push(params[0]); return { rows: [{ count: 1 }] }; } };
  const event = { requestContext: { identity: { sourceIp: '203.0.113.9' } } };
  assert.equal(await rateLimited(db, 'route', null, event), null);
  assert.ok(seen.some(k => /^guestRoute:\d+:ip:/.test(k)), seen.join());
  assert.ok(seen.some(k => /^guestAi:\d+:all$/.test(k)), seen.join());
  assert.ok(!seen.some(k => k.includes('203.0.113.9')), 'the raw IP is never stored');
  seen.length = 0;
  await rateLimited(db, 'route', { uid: 'u1', email: 'a@example.com' }, event);
  assert.ok(seen.length && seen.every(k => k.startsWith('route:')), seen.join());
});

test('plan drafts: shape and size are checked', () => {
  assert.ok(validateDraft({ form: { days: 5 }, step: 2 }).value);
  assert.ok(validateDraft({ form: [], step: 1 }).error);
  assert.ok(validateDraft({ form: {}, step: 6 }).error);
  assert.ok(validateDraft({ form: {}, step: 1.5 }).error);
  assert.ok(validateDraft(null).error);
  assert.ok(validateDraft({ form: { notes: 'x'.repeat(70 * 1024) }, step: 1 }).error);
});
