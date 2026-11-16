'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const pricing = require(path.join(LAYER, 'pricing.js'));
const tripPass = require(path.join(LAYER, 'trip-pass.js'));

const product = (plan, extra = {}) => ({
  id: `p_${plan}`, active: true, name: plan === 'pass' ? 'Trip Pass' : 'One trip', description: 'x',
  metadata: { wz_plan: plan, trips: plan === 'pass' ? '6' : '1', valid_days: '365' },
  default_price: { active: true, currency: 'aud', unit_amount: plan === 'pass' ? 5900 : 1900 },
  ...extra,
});
const links = [
  { active: true, url: 'https://buy.stripe.com/test_pass', metadata: { wz_plan: 'pass' } },
  { active: true, url: 'https://buy.stripe.com/test_trip', metadata: { wz_plan: 'trip' } },
  { active: true, url: 'https://buy.stripe.com/old', metadata: {} },
];

test('buildCatalog: only active wz_plan products with an active price AND a payment link, trip first', () => {
  const cat = pricing.buildCatalog([
    product('pass'), product('trip'),
    product('trip', { active: false }),
    { ...product('pass'), metadata: { wz_plan: 'other' } },
  ], links);
  assert.deepEqual(cat.map(p => [p.plan, p.trips, p.validDays, p.currency, p.amounts.aud, p.url]), [
    ['trip', 1, null, 'aud', 1900, 'https://buy.stripe.com/test_trip'],
    ['pass', 6, 365, 'aud', 5900, 'https://buy.stripe.com/test_pass'],
  ]);
  assert.equal(pricing.buildCatalog([product('trip')], []).length, 0, 'no link → not for sale');
});

test('priceFor: visitor currency when Stripe has it, else the price currency; always stated', () => {
  const cat = pricing.buildCatalog([
    product('trip', { default_price: { active: true, currency: 'aud', unit_amount: 1900, currency_options: { usd: { unit_amount: 1300 }, jpy: { unit_amount: 1900 } } } }),
    product('pass'),
  ], links);
  const au = pricing.priceFor(cat, 'au');
  assert.deepEqual(au.map(p => [p.amount, p.currency]), [[19, 'AUD'], [59, 'AUD']]);
  const us = pricing.priceFor(cat, 'US');
  assert.deepEqual(us.map(p => [p.amount, p.currency]), [[13, 'USD'], [59, 'AUD']]);
  assert.equal(pricing.priceFor(cat, 'JP')[0].amount, 1900, 'zero-decimal currency is not divided by 100');
  assert.deepEqual(pricing.priceFor(cat, '').map(p => p.currency), ['AUD', 'AUD']);
});

test('getCatalog: the Stripe search query uses only OR (Stripe rejects AND mixed with OR)', async () => {
  pricing._reset();
  const urls = [];
  const fetchImpl = async (url) => { urls.push(String(url)); return { ok: true, json: async () => ({ data: [] }) }; };
  await pricing.getCatalog({ secretKey: 'sk_test', fetchImpl, now: 5, log: { warn() {} } });
  const q = new URL(urls.find(u => u.includes('/products/search'))).searchParams.get('query');
  assert.equal(q, "metadata['wz_plan']:'trip' OR metadata['wz_plan']:'pass'");
  assert.doesNotMatch(q, /AND|\(/);
  pricing._reset();
});

test('getCatalog: cached; last good copy when Stripe fails; error when there is none', async () => {
  pricing._reset();
  let calls = 0;
  const ok = async (url) => { calls++; return { ok: true, json: async () => ({ data: String(url).includes('/products/search') ? [product('trip')] : links }) }; };
  const quiet = { warn() {} };
  const a = await pricing.getCatalog({ secretKey: 'sk_test', fetchImpl: ok, now: 1000, log: quiet });
  await pricing.getCatalog({ secretKey: 'sk_test', fetchImpl: ok, now: 2000, log: quiet });
  assert.equal(calls, 2);
  const down = async () => ({ ok: false, status: 500 });
  const b = await pricing.getCatalog({ secretKey: 'sk_test', fetchImpl: down, now: 1000 + pricing.CACHE_MS + 1, log: quiet });
  assert.deepEqual(b, a);
  pricing._reset();
  await assert.rejects(pricing.getCatalog({ secretKey: 'sk_test', fetchImpl: down, now: 1, log: quiet }));
  pricing._reset();
});

test('trip pass source strings round-trip, junk is ignored', () => {
  assert.equal(tripPass.passSource(42), 'pass:42');
  assert.equal(tripPass.passIdOf('pass:42'), 42);
  for (const bad of ['pass:', 'pass:x', 'credit', null, 'pass:1;drop']) assert.equal(tripPass.passIdOf(bad), null);
});
