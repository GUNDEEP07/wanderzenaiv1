'use strict';

// Run: node --test backend/tests/unit/*.test.js
// The webhook requires '/opt/nodejs/index' (the Lambda layer path). Point the module
// resolver at the repo's layer so this test runs anywhere.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');
const Module = require('module');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  // The layer's index requires 'pg'; these tests never touch a real database.
  if (request === 'pg') return { Pool: class {} };
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  return origLoad.call(this, request, ...rest);
};

const { _internal } = require(path.join(__dirname, '../../functions/form-handler/stripe-webhook.js'));
const { verifyStripeSignature, resolveAccount, fulfilCheckout } = _internal;

const SECRET = 'whsec_test_secret';
const sign = (payload, t, secret = SECRET) =>
  crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');

test('accepts a valid signature', () => {
  const t = Math.floor(Date.now() / 1000);
  const body = '{"id":"evt_1"}';
  assert.doesNotThrow(() => verifyStripeSignature(body, `t=${t},v1=${sign(body, t)}`, SECRET));
});

test('accepts when any of several v1 signatures matches (secret rotation)', () => {
  const t = Math.floor(Date.now() / 1000);
  const body = '{"id":"evt_2"}';
  const header = `t=${t},v1=${sign(body, t, 'whsec_old')},v1=${sign(body, t)}`;
  assert.doesNotThrow(() => verifyStripeSignature(body, header, SECRET));
});

test('rejects tampered body, wrong secret, old timestamp, missing header, missing secret', () => {
  const t = Math.floor(Date.now() / 1000);
  const body = '{"id":"evt_3"}';
  assert.throws(() => verifyStripeSignature('{"id":"evt_X"}', `t=${t},v1=${sign(body, t)}`, SECRET), /mismatch/);
  assert.throws(() => verifyStripeSignature(body, `t=${t},v1=${sign(body, t, 'whsec_wrong')}`, SECRET), /mismatch/);
  assert.throws(() => verifyStripeSignature(body, `t=${t - 600},v1=${sign(body, t - 600)}`, SECRET), /too old/);
  assert.throws(() => verifyStripeSignature(body, undefined, SECRET), /Missing signature/);
  assert.throws(() => verifyStripeSignature(body, `t=${t},v1=${sign(body, t)}`, ''), /not configured/);
  assert.throws(() => verifyStripeSignature(body, `t=${t},v1=abc`, SECRET), /mismatch/); // different length
});

/** Minimal fake of the users table for fulfilment logic. */
function fakeClient(users) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push(sql.trim().split('\n')[0]);
      if (sql.includes('WHERE firebase_uid = $1')) {
        const u = users.find(x => x.firebase_uid === params[0]);
        return { rows: u ? [{ email: u.email }] : [] };
      }
      if (sql.startsWith('INSERT INTO users')) {
        const [email, plan, credits] = params;
        const u = users.find(x => x.email === email);
        if (u) {
          u.plan = u.plan === 'subscriber' && plan === 'paid_once' ? 'subscriber' : plan;
          u.itineraries_remaining += credits;
        } else users.push({ email, plan, itineraries_remaining: credits });
        return { rows: [] };
      }
      if (sql.includes('SELECT referred_by')) return { rows: [{}] };
      return { rows: [] };
    },
  };
}

test('matches the account by client_reference_id even when the checkout email differs', async () => {
  const users = [{ email: 'alice@example.com', firebase_uid: 'uidAlice', plan: 'free', itineraries_remaining: 0 }];
  const client = fakeClient(users);
  const r = await fulfilCheckout(client, {
    id: 'cs_1', mode: 'payment', payment_status: 'paid', client_reference_id: 'uidAlice',
    customer_email: null, customer_details: { email: 'alice.work@example.com' },
  });
  assert.equal(r.matchedBy, 'client_reference_id');
  assert.equal(users[0].plan, 'paid_once');
  assert.equal(users[0].itineraries_remaining, 1);
  assert.equal(users.length, 1, 'no orphan account created for the checkout email');
});

test('falls back to customer_details.email when customer_email is null (unprefilled link)', async () => {
  const client = fakeClient([]);
  const r = await resolveAccount(client, { customer_email: null, customer_details: { email: 'bob@example.com' } });
  assert.deepEqual(r, { email: 'bob@example.com', matchedBy: 'checkout_email' });
});

test('does not fulfil an unpaid (async) checkout', async () => {
  const users = [{ email: 'c@example.com', firebase_uid: 'uidC', plan: 'free', itineraries_remaining: 0 }];
  const r = await fulfilCheckout(fakeClient(users), { id: 'cs_2', mode: 'payment', payment_status: 'unpaid', client_reference_id: 'uidC' });
  assert.equal(r.fulfilled, false);
  assert.equal(users[0].itineraries_remaining, 0);
});

test('a subscriber buying a single plan keeps the subscription and gains a credit', async () => {
  const users = [{ email: 'd@example.com', firebase_uid: 'uidD', plan: 'subscriber', itineraries_remaining: 0 }];
  await fulfilCheckout(fakeClient(users), { id: 'cs_3', mode: 'payment', payment_status: 'paid', client_reference_id: 'uidD' });
  assert.equal(users[0].plan, 'subscriber');
  assert.equal(users[0].itineraries_remaining, 1);
});

test('an unmatched paid checkout is reported, not thrown', async () => {
  const r = await fulfilCheckout(fakeClient([]), { id: 'cs_4', mode: 'payment', payment_status: 'paid', customer_details: {} });
  assert.deepEqual(r, { fulfilled: false, reason: 'no_account' });
});
