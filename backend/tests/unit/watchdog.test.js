'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// CI's unit job has no Lambda layer path or layer node_modules: map /opt/nodejs to the
// layer source and stub the SDK/pg (the watchdog's DB and email are injected below).
const Module = require('module');
const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const origLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === 'pg') return { Pool: class {} };
  if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  return origLoad.call(this, request, ...rest);
};
const { _internal: w } = require(path.join(__dirname, '../../functions/itinerary-gen/watchdog.js'));
const { countMetric } = require(path.join(__dirname, '../../layers/shared/nodejs/metrics.js'));

/** Fake db: submissions + users + day_adjustments, enough for failure.js and the sweep. */
function fakeDb({ subs = [], users = {} } = {}) {
  const calls = [];
  return {
    subs, users, calls,
    async query(sql, params = []) {
      calls.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
      if (sql.includes('FROM submissions') && sql.includes("status IN ('pending', 'processing')")) {
        return { rows: subs.filter((s) => ['pending', 'processing'].includes(s.status) && s.ageMin >= 20 && s.ageMin < 24 * 60).map(({ id, status, plan }) => ({ id, status, plan })) };
      }
      if (sql.startsWith('UPDATE submissions')) {
        const s = subs.find((x) => x.id === params[1]);
        if (!s || ['failed', 'itinerary_ready', 'pdf_ready', 'email_sent'].includes(s.status)) return { rows: [] };
        s.status = 'failed'; s.error = params[0];
        return { rows: [{ email: s.email, destination: s.destination }] };
      }
      const m = /^UPDATE users SET (\w+) = \1 \+ 1/.exec(sql);
      if (m) { users[params[0]][m[1]] += 1; return { rows: [] }; }
      if (sql.includes('UPDATE day_adjustments')) { calls.push(`adjust:${params[0]}:${params[1]}`); return { rows: [] }; }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
}

const crash = (fn, payload, extra = {}) => ({
  version: '1.0',
  requestContext: { functionArn: `arn:aws:lambda:ap-southeast-2:1:function:wanderzenai-${fn}-prod:$LATEST`, condition: 'RetriesExhausted', approximateInvokeCount: 1 },
  requestPayload: payload,
  responsePayload: { errorType: 'Sandbox.Timedout', errorMessage: 'Task timed out after 900.00 seconds' },
  ...extra,
});

test('stageOf and record detection', () => {
  assert.equal(w.stageOf('arn:aws:lambda:ap-southeast-2:1:function:wanderzenai-pdf-builder-prod:$LATEST'), 'pdf-builder');
  assert.equal(w.stageOf('arn:aws:lambda:x:1:function:wanderzenai-itinerary-gen-prod'), 'itinerary-gen');
  assert.equal(w.isDestinationRecord(crash('pdf-builder', {})), true);
  assert.equal(w.isDestinationRecord({ source: 'aws.events' }), false);
});

test('crashed generation: failed once, credit returned, traveller emailed', async () => {
  const db = fakeDb({ subs: [{ id: 's1', status: 'processing', email: 'a@x.com', destination: 'Kyoto' }], users: { 'a@x.com': { monthly_remaining: 0, itineraries_remaining: 2 } } });
  const sent = [];
  const send = async (m) => { sent.push(m); };
  const r1 = await w.handleCrash(crash('itinerary-gen', { submissionId: 's1', isPaid: true, creditSource: 'credit' }), { db, send });
  assert.equal(r1.action, 'trip-failed');
  assert.equal(r1.refunded, true);
  assert.equal(db.users['a@x.com'].itineraries_remaining, 3);
  assert.equal(sent.length, 1);
  assert.match(sent[0].subject, /Kyoto/);
  assert.match(db.subs[0].error, /crashed \(RetriesExhausted\)/);
  // Delivered twice (or after the generator's own catch already handled it): no second refund.
  const r2 = await w.handleCrash(crash('itinerary-gen', { submissionId: 's1', creditSource: 'credit' }), { db, send });
  assert.equal(r2.handled, false);
  assert.equal(db.users['a@x.com'].itineraries_remaining, 3);
  assert.equal(sent.length, 1);
});

test('crashed day adjustment frees its slot; pdf/email crashes only alert', async () => {
  const db = fakeDb();
  const r = await w.handleCrash(crash('itinerary-gen', { mode: 'adjustDay', adjustmentId: 42, submissionId: 's1' }), { db, send: async () => {} });
  assert.equal(r.action, 'adjustment-failed');
  assert.ok(db.calls.includes('adjust:42:failed'));
  const p = await w.handleCrash(crash('pdf-builder', { submissionId: 's1', itineraryId: 'i1' }), { db, send: async () => { throw new Error('no'); } });
  assert.equal(p.action, 'alerted');
  assert.equal(db.calls.filter((c) => c.startsWith('UPDATE submissions')).length, 0);
});

test('sweep fails only recent stuck trips, never old or finished ones', async () => {
  const db = fakeDb({
    users: { 'b@x.com': { monthly_remaining: 0, itineraries_remaining: 0 } },
    subs: [
      { id: 'stuck', status: 'processing', ageMin: 25, plan: 'paid', email: 'b@x.com', destination: 'Hanoi' },
      { id: 'fresh', status: 'processing', ageMin: 5, plan: 'free', email: 'c@x.com', destination: 'Rome' },
      { id: 'ancient', status: 'pending', ageMin: 60 * 24 * 30, plan: 'free', email: 'd@x.com', destination: 'Bali' },
      { id: 'done', status: 'email_sent', ageMin: 120, plan: 'paid', email: 'e@x.com', destination: 'Oslo' },
    ],
  });
  const sent = [];
  const out = await w.sweepStuck({ db, send: async (m) => { sent.push(m.to); } });
  assert.deepEqual(out.map((o) => o.id), ['stuck']);
  assert.equal(db.subs.find((s) => s.id === 'stuck').status, 'failed');
  assert.equal(db.subs.find((s) => s.id === 'fresh').status, 'processing');
  assert.equal(db.subs.find((s) => s.id === 'ancient').status, 'pending');
  assert.deepEqual(sent, ['b@x.com']);
  assert.equal(db.users['b@x.com'].itineraries_remaining, 1, 'a paid stuck trip is given back as a credit');
  assert.equal(out[0].refunded, true);
});

test('countMetric writes an EMF line and never throws', () => {
  const lines = [];
  const orig = console.log;
  console.log = (l) => lines.push(l);
  try {
    process.env.STAGE = 'prod';
    countMetric('TripFailed', { submissionId: 's1' });
  } finally { console.log = orig; }
  const j = JSON.parse(lines[0]);
  assert.equal(j._aws.CloudWatchMetrics[0].Namespace, 'WanderZenAI');
  assert.deepEqual(j._aws.CloudWatchMetrics[0].Dimensions, [['Stage']]);
  assert.equal(j._aws.CloudWatchMetrics[0].Metrics[0].Name, 'TripFailed');
  assert.equal(j.TripFailed, 1);
  assert.equal(j.Stage, 'prod');
  assert.equal(j.submissionId, 's1');
});
