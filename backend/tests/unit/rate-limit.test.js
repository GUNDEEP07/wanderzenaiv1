'use strict';

// Run: node --test backend/tests/unit
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const rl = require(path.join(__dirname, '../../layers/shared/nodejs/rate-limit.js'));

/** In-memory stand-in for the rate_limits upsert. */
function fakeDb({ failWith } = {}) {
  const rows = new Map();
  return {
    rows,
    async query(sql, params) {
      if (failWith) throw failWith;
      if (sql.startsWith('DELETE')) return { rows: [] };
      const key = `${params[0]}@${params[1]}`;
      const count = (rows.get(key) || 0) + 1;
      rows.set(key, count);
      return { rows: [{ count }] };
    },
  };
}

const HOUR = 3600 * 1000;
const T0 = Date.UTC(2026, 10, 5, 10, 0, 0); // window-aligned start

test('allows requests up to the limit, then blocks with Retry-After', async () => {
  const db = fakeDb();
  const limit = rl.LIMITS.submit[0].limit; // 10/hour
  for (let i = 0; i < limit; i++) {
    assert.equal(await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 + i }), null);
  }
  const blocked = await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 + 60_000 });
  assert.ok(blocked);
  assert.equal(blocked.retryAfterSeconds, 3600 - 60);
});

test('limits are per subject', async () => {
  const db = fakeDb();
  for (let i = 0; i < 10; i++) await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 });
  assert.ok(await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 }));
  assert.equal(await rl.checkRateLimit(db, 'submit', 'u:b', { nowMs: T0 }), null);
});

test('window resets after it elapses', async () => {
  const db = fakeDb();
  for (let i = 0; i < 11; i++) await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 });
  assert.equal(await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 + HOUR }), null);
});

test('daily window still blocks after hourly windows reset', async () => {
  const db = fakeDb();
  // 30/day: spread 10/hour over 3 hours, then the 31st in hour 4 is blocked by the day rule.
  for (let h = 0; h < 3; h++) {
    for (let i = 0; i < 10; i++) {
      assert.equal(await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 + h * HOUR }), null);
    }
  }
  const blocked = await rl.checkRateLimit(db, 'submit', 'u:a', { nowMs: T0 + 3 * HOUR });
  assert.ok(blocked, 'expected daily limit to block');
});

test('fails open when the database errors', async () => {
  const db = fakeDb({ failWith: new Error('connection refused') });
  const errors = [];
  const realError = console.error;
  console.error = (m) => errors.push(m);
  try {
    assert.equal(await rl.checkRateLimit(db, 'submit', 'u:a'), null);
  } finally {
    console.error = realError;
  }
  assert.match(errors[0], /failing open/);
});

test('unknown bucket is a programming error, surfaced via fail-open log', async () => {
  await assert.rejects(rl.consume(fakeDb(), 'nope', 'u:a'), /Unknown rate-limit bucket/);
});

test('ipSubject hashes the source IP and never stores it raw', () => {
  const subject = rl.ipSubject({ requestContext: { identity: { sourceIp: '203.0.113.7' } } });
  assert.match(subject, /^ip:[0-9a-f]{32}$/);
  assert.ok(!subject.includes('203.0.113.7'));
});

test('rateLimitBody is client-safe and human readable', () => {
  const body = rl.rateLimitBody(90);
  assert.equal(body.code, 'RATE_LIMITED');
  assert.match(body.message, /2 minutes/);
});
