'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { handleGenerationFailure, failureEmail, GenerationFailed } = require(
  path.join(__dirname, '../../functions/itinerary-gen/failure.js')
);

const quiet = { info() {}, error() {} };

/** Fake submissions + users tables. */
function fakeDb({ status = 'processing', users = { 'a@example.com': { monthly_remaining: 0, itineraries_remaining: 0 } } } = {}) {
  const sub = { id: 's1', email: 'a@example.com', destination: 'Kyoto', status };
  return {
    sub, users,
    async query(sql, params) {
      if (sql.startsWith('UPDATE submissions')) {
        if (params[1] !== sub.id || ['failed', 'itinerary_ready', 'pdf_ready', 'email_sent'].includes(sub.status)) return { rows: [] };
        sub.status = 'failed'; sub.error_message = params[0];
        return { rows: [{ email: sub.email, destination: sub.destination }] };
      }
      const m = /^UPDATE users SET (\w+) = \1 \+ 1/.exec(sql);
      if (m) { users[params[0]][m[1]] += 1; return { rows: [] }; }
      throw new Error('unexpected sql: ' + sql);
    },
  };
}

test('monthly itinerary is given back, user emailed, submission failed', async () => {
  const db = fakeDb(); const sent = [];
  const r = await handleGenerationFailure({ db, sendEmail: async m => sent.push(m), submissionId: 's1', creditSource: 'monthly', errorMessage: 'Days 4, 5, 6 could not be generated', log: quiet });
  assert.deepEqual(r, { handled: true, refunded: true, emailed: true });
  assert.equal(db.sub.status, 'failed');
  assert.equal(db.users['a@example.com'].monthly_remaining, 1);
  assert.equal(db.users['a@example.com'].itineraries_remaining, 0);
  assert.equal(sent[0].to, 'a@example.com');
  assert.match(sent[0].subject, /couldn't finish your Kyoto itinerary/);
  assert.match(sent[0].text, /returned to your account/);
});

test('purchased credit goes back to itineraries_remaining', async () => {
  const db = fakeDb();
  await handleGenerationFailure({ db, sendEmail: async () => {}, submissionId: 's1', creditSource: 'credit', errorMessage: 'x', log: quiet });
  assert.equal(db.users['a@example.com'].itineraries_remaining, 1);
  assert.equal(db.users['a@example.com'].monthly_remaining, 0);
});

test('free or test-account submissions: nothing to refund; email says it does not count', async () => {
  const db = fakeDb(); const sent = [];
  const r = await handleGenerationFailure({ db, sendEmail: async m => sent.push(m), submissionId: 's1', creditSource: null, errorMessage: 'x', log: quiet });
  assert.equal(r.refunded, false);
  assert.match(sent[0].text, /does not count towards your free itinerary/);
});

test('exactly once: a second call (Lambda retry) neither refunds nor emails again', async () => {
  const db = fakeDb(); const sent = [];
  const args = { db, sendEmail: async m => sent.push(m), submissionId: 's1', creditSource: 'credit', errorMessage: 'x', log: quiet };
  await handleGenerationFailure(args);
  const second = await handleGenerationFailure(args);
  assert.deepEqual(second, { handled: false, refunded: false, emailed: false });
  assert.equal(db.users['a@example.com'].itineraries_remaining, 1);
  assert.equal(sent.length, 1);
});

test('a finished itinerary is never marked failed or refunded', async () => {
  for (const status of ['itinerary_ready', 'pdf_ready', 'email_sent']) {
    const db = fakeDb({ status });
    const r = await handleGenerationFailure({ db, sendEmail: async () => { throw new Error('must not send'); }, submissionId: 's1', creditSource: 'credit', errorMessage: 'x', log: quiet });
    assert.equal(r.handled, false, status);
    assert.equal(db.sub.status, status);
  }
});

test('an email failure does not undo the refund', async () => {
  const db = fakeDb();
  const r = await handleGenerationFailure({ db, sendEmail: async () => { throw new Error('SES down'); }, submissionId: 's1', creditSource: 'monthly', errorMessage: 'x', log: quiet });
  assert.deepEqual(r, { handled: true, refunded: true, emailed: false });
});

test('unknown credit source is not used to build SQL (no refund)', async () => {
  const db = fakeDb();
  const r = await handleGenerationFailure({ db, sendEmail: async () => {}, submissionId: 's1', creditSource: 'users; DROP TABLE users', errorMessage: 'x', log: quiet });
  assert.equal(r.refunded, false);
});

test('failure email escapes the destination in HTML', () => {
  const { html, subject } = failureEmail({ destination: '<img src=x onerror=alert(1)>', refunded: false });
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(subject.length < 200);
});

test('GenerationFailed carries a reason', () => {
  const e = new GenerationFailed('nope', { reason: 'deadline' });
  assert.equal(e.reason, 'deadline');
  assert.ok(e instanceof Error);
});
