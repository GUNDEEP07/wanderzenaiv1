'use strict';

// Run: node --test backend/tests/unit
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');

const auth = require(path.join(__dirname, '../../layers/shared/nodejs/auth.js'));

const PROJECT_ID = 'wanderzenai-test';
const KID = 'test-kid-1';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: attackerKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' });

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

function sign({ header = {}, claims = {}, key = privateKey } = {}) {
  const h = b64({ alg: 'RS256', kid: KID, typ: 'JWT', ...header });
  const t = now();
  const p = b64({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: 'uid-123',
    iat: t - 10,
    auth_time: t - 10,
    exp: t + 3600,
    email: 'traveller@example.com',
    email_verified: true,
    firebase: { sign_in_provider: 'google.com' },
    ...claims,
  });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url');
  return `${h}.${p}.${sig}`;
}

const eventWith = (token) => ({ headers: token ? { Authorization: `Bearer ${token}` } : {} });

async function expectAuthError(promise, statusCode, code) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof auth.AuthError, `expected AuthError, got ${err && err.name}: ${err && err.message}`);
    assert.equal(err.statusCode, statusCode);
    assert.equal(err.code, code);
    return true;
  });
}

test.beforeEach(() => {
  process.env.FIREBASE_PROJECT_ID = PROJECT_ID;
  delete process.env.REQUIRE_EMAIL_VERIFIED;
  auth.__setCertsForTesting({ [KID]: PUBLIC_PEM });
});

test('accepts a valid token and returns the identity', async () => {
  const user = await auth.requireUser(eventWith(sign()));
  assert.deepEqual(user, {
    uid: 'uid-123', email: 'traveller@example.com', emailVerified: true, signInProvider: 'google.com', name: null,
  });
});

test('accepts lowercase authorization header', async () => {
  const user = await auth.requireUser({ headers: { authorization: `Bearer ${sign()}` } });
  assert.equal(user.uid, 'uid-123');
});

test('rejects a missing token with AUTH_REQUIRED', async () => {
  await expectAuthError(auth.requireUser(eventWith(null)), 401, 'AUTH_REQUIRED');
});

test('rejects the legacy decode-only forgery (unsigned payload)', async () => {
  const forged = `${b64({ alg: 'none' })}.${b64({ email: 'victim@example.com' })}.`;
  await expectAuthError(auth.requireUser(eventWith(forged)), 401, 'TOKEN_INVALID');
});

test('rejects the demo-token placeholder', async () => {
  await expectAuthError(auth.requireUser(eventWith('demo-token')), 401, 'TOKEN_INVALID');
});

test('rejects a token signed by a different key', async () => {
  await expectAuthError(auth.requireUser(eventWith(sign({ key: attackerKey }))), 401, 'TOKEN_INVALID');
});

test('rejects a tampered payload', async () => {
  const [h, , s] = sign().split('.');
  const tampered = `${h}.${b64({ sub: 'uid-123', email: 'victim@example.com' })}.${s}`;
  await expectAuthError(auth.requireUser(eventWith(tampered)), 401, 'TOKEN_INVALID');
});

test('rejects alg other than RS256', async () => {
  await expectAuthError(auth.requireUser(eventWith(sign({ header: { alg: 'HS256' } }))), 401, 'TOKEN_INVALID');
});

test('rejects an unknown kid after forcing a cert refresh', async () => {
  // Refresh would hit the network; stub fetch to return the same cert set.
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true, json: async () => ({ [KID]: PUBLIC_PEM }), headers: new Map() });
  try {
    await expectAuthError(auth.requireUser(eventWith(sign({ header: { kid: 'rotated-away' } }))), 401, 'TOKEN_INVALID');
  } finally {
    global.fetch = realFetch;
  }
});

test('rejects an expired token with TOKEN_EXPIRED', async () => {
  const t = now();
  await expectAuthError(
    auth.requireUser(eventWith(sign({ claims: { iat: t - 7200, auth_time: t - 7200, exp: t - 3600 } }))),
    401, 'TOKEN_EXPIRED'
  );
});

test('rejects a token issued in the future', async () => {
  await expectAuthError(auth.requireUser(eventWith(sign({ claims: { iat: now() + 600 } }))), 401, 'TOKEN_INVALID');
});

test('rejects a token from another Firebase project (aud)', async () => {
  await expectAuthError(auth.requireUser(eventWith(sign({ claims: { aud: 'someone-else' } }))), 401, 'TOKEN_INVALID');
});

test('rejects a token with the wrong issuer', async () => {
  await expectAuthError(
    auth.requireUser(eventWith(sign({ claims: { iss: 'https://securetoken.google.com/someone-else' } }))),
    401, 'TOKEN_INVALID'
  );
});

test('rejects an empty sub', async () => {
  await expectAuthError(auth.requireUser(eventWith(sign({ claims: { sub: '' } }))), 401, 'TOKEN_INVALID');
});

test('rejects an unverified email with 403 EMAIL_NOT_VERIFIED', async () => {
  await expectAuthError(
    auth.requireUser(eventWith(sign({ claims: { email_verified: false, firebase: { sign_in_provider: 'password' } } }))),
    403, 'EMAIL_NOT_VERIFIED'
  );
});

test('REQUIRE_EMAIL_VERIFIED=false allows an unverified email', async () => {
  process.env.REQUIRE_EMAIL_VERIFIED = 'false';
  const user = await auth.requireUser(eventWith(sign({ claims: { email_verified: false } })));
  assert.equal(user.emailVerified, false);
});

test('fails closed when FIREBASE_PROJECT_ID is missing', async () => {
  delete process.env.FIREBASE_PROJECT_ID;
  await assert.rejects(auth.requireUser(eventWith(sign())), /FIREBASE_PROJECT_ID/);
});

test('optionalUser returns null for missing or invalid tokens', async () => {
  assert.equal(await auth.optionalUser(eventWith(null)), null);
  assert.equal(await auth.optionalUser(eventWith('demo-token')), null);
  assert.equal(await auth.optionalUser(eventWith(sign({ key: attackerKey }))), null);
  assert.equal((await auth.optionalUser(eventWith(sign()))).uid, 'uid-123');
});

test('rejects oversized tokens without parsing', async () => {
  await expectAuthError(auth.requireUser(eventWith('a'.repeat(5000))), 401, 'TOKEN_INVALID');
});

test('the verified identity carries a clean display name (saved to profiles when missing)', async () => {
  let user = await auth.requireUser(eventWith(sign({ claims: { name: '  Gundeep\u0000  Singh ' } })));
  assert.equal(user.name, 'Gundeep Singh');
  user = await auth.requireUser(eventWith(sign({ claims: { name: 'x'.repeat(300) } })));
  assert.equal(user.name.length, 120);
  user = await auth.requireUser(eventWith(sign()));
  assert.equal(user.name, null);
  user = await auth.requireUser(eventWith(sign({ claims: { name: { evil: true } } })));
  assert.equal(user.name, null);
});
