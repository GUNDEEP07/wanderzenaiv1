'use strict';
// Wanderer 5/month end to end on local Postgres: real form-handler + webhook handlers.
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STRIPE_WEBHOOK_SECRET: 'whsec_local', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', STAGE: 'test', FRONTEND_URL: 'https://www.wanderzenai.com', CLAUDE_API_KEY: 'x' });
const REPO = require('path').resolve(__dirname, '../../..');
const { getDB } = require('/opt/nodejs/index');
const auth = require('/opt/nodejs/auth.js');
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda');
lambdaSdk.LambdaClient.prototype.send = async () => ({});
const webhook = require(`${REPO}/backend/functions/form-handler/stripe-webhook.js`);
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now()/1000); const h=b64({alg:'RS256',kid:'k'}), p=b64({iss:'https://securetoken.google.com/wanderzenai-9c343',aud:'wanderzenai-9c343',sub,iat:t-5,exp:t+3600,email,email_verified:true}); return `${h}.${p}.${crypto.sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url')}`; };
const deliver = (evt) => { const body = JSON.stringify(evt); const t = Math.floor(Date.now()/1000); const sig = crypto.createHmac('sha256','whsec_local').update(`${t}.${body}`).digest('hex'); return webhook.handler({ headers: { 'Stripe-Signature': `t=${t},v1=${sig}` }, body }); };
const submit = (uid, email) => form.handler({ httpMethod: 'POST', path: '/submit', headers: { Authorization: `Bearer ${token(uid, email)}` }, body: JSON.stringify({ destination: 'Kyoto', days: 3, budget: 900, currency: 'AUD', travelerType: 'Solo' }), requestContext: { identity: { sourceIp: '1.1.1.' + Math.floor(Math.random()*250) } } });
const out = []; const check = (n, c, d='') => out.push(`${c?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`);
(async () => {
  const db = getDB();
  await db.query('ALTER TABLE users DROP COLUMN IF EXISTS monthly_remaining'); // as on prod before this deploy
  await db.query('DELETE FROM rate_limits').catch(() => {});
  const n = Date.now(); const uid = 'uidW' + n; const email = `wanda${n}@example.com`; const cus = 'cus_W' + n;
  await db.query(`insert into users (email, firebase_uid, plan, itineraries_remaining) values ($1,$2,'free',0)`, [email, uid]);
  const q = async () => (await db.query('select plan, itineraries_remaining, monthly_remaining from users where email=$1',[email])).rows[0];

  let r = await submit(uid, email);
  check('column missing: /submit adds it and the free itinerary still works', r.statusCode === 200, String(r.statusCode));
  const col = (await db.query(`select 1 from information_schema.columns where table_name='users' and column_name='monthly_remaining'`)).rows.length;
  check('users.monthly_remaining now exists', col === 1);

  r = await deliver({ id: 'evt_s' + n, type: 'checkout.session.completed', data: { object: { id: 'cs_s', mode: 'subscription', payment_status: 'paid', client_reference_id: uid, customer: cus, subscription: 'sub_' + n } } });
  let u = await q(); check('Wanderer checkout → subscriber with 5 this month', r.statusCode === 200 && u.plan === 'subscriber' && u.monthly_remaining === 5, JSON.stringify(u));

  const codes = []; for (let i = 0; i < 5; i++) codes.push((await submit(uid, email)).statusCode);
  u = await q(); check('5 submits allowed, allowance spent', codes.every(c => c === 200) && u.monthly_remaining === 0, codes.join(',') + ' ' + JSON.stringify(u));
  r = await submit(uid, email); const body = JSON.parse(r.body);
  check('6th → 402 MONTHLY_LIMIT_REACHED (no extra free one for subscribers)', r.statusCode === 402 && body.code === 'MONTHLY_LIMIT_REACHED', r.body);

  await deliver({ id: 'evt_p' + n, type: 'checkout.session.completed', data: { object: { id: 'cs_p', mode: 'payment', payment_status: 'paid', client_reference_id: uid, customer: cus } } });
  u = await q(); check('Single Plan bought on top: stays subscriber, +1 credit', u.plan === 'subscriber' && u.itineraries_remaining === 1, JSON.stringify(u));
  r = await submit(uid, email); u = await q(); check('purchased credit spent when monthly is gone', r.statusCode === 200 && u.itineraries_remaining === 0);

  await deliver({ id: 'evt_u' + n, type: 'invoice.paid', data: { object: { id: 'in_u', billing_reason: 'subscription_update', customer: cus } } });
  u = await q(); check('invoice.paid for a plan change does not reset', u.monthly_remaining === 0);
  r = await deliver({ id: 'evt_r' + n, type: 'invoice.paid', data: { object: { id: 'in_r', billing_reason: 'subscription_cycle', customer: cus } } });
  u = await q(); check('renewal (subscription_cycle) resets to 5', r.statusCode === 200 && u.monthly_remaining === 5, JSON.stringify(u));
  r = await deliver({ id: 'evt_r' + n, type: 'invoice.paid', data: { object: { id: 'in_r', billing_reason: 'subscription_cycle', customer: cus } } });
  check('duplicate renewal delivery ignored', JSON.parse(r.body).duplicate === true);

  await db.query('update users set monthly_remaining = 1, itineraries_remaining = 1 where email=$1', [email]);
  r = await submit(uid, email); u = await q();
  check('monthly allowance is spent before purchased credits', r.statusCode === 200 && u.monthly_remaining === 0 && u.itineraries_remaining === 1, JSON.stringify(u));

  await db.query('update users set monthly_remaining = 2, itineraries_remaining = 0 where email=$1', [email]);
  await db.query('DELETE FROM rate_limits'); // the per-user submit limit (10/h) is not what this checks
  const par = await Promise.all(Array.from({ length: 6 }, () => submit(uid, email)));
  u = await q(); check('6 parallel submits with 2 left → exactly 2 allowed', par.filter(x => x.statusCode === 200).length === 2 && u.monthly_remaining === 0, par.map(x => x.statusCode).join(','));

  await db.query('update users set monthly_remaining = 3, itineraries_remaining = 2 where email=$1', [email]);
  await deliver({ id: 'evt_d' + n, type: 'customer.subscription.deleted', data: { object: { id: 'sub_' + n, customer: cus } } });
  u = await q(); check('cancellation: back to free, monthly gone, purchased credits kept', u.plan === 'free' && u.monthly_remaining === 0 && u.itineraries_remaining === 2, JSON.stringify(u));
  await deliver({ id: 'evt_r2' + n, type: 'invoice.paid', data: { object: { id: 'in_r2', billing_reason: 'subscription_cycle', customer: cus } } });
  u = await q(); check('a late renewal after cancellation grants nothing', u.monthly_remaining === 0);

  // refund path: monthly consumed then the insert fails → refunded to the right column
  await db.query(`update users set plan='subscriber', monthly_remaining = 1, itineraries_remaining = 0 where email=$1`, [email]);
  const { decideEntitlement, refundCredit } = form._internal;
  const ent = await decideEntitlement(db, email);
  await refundCredit(db, email, 'sub_test', ent.source);
  u = await q(); check('refund returns a monthly itinerary to monthly_remaining', ent.source === 'monthly' && u.monthly_remaining === 1 && u.itineraries_remaining === 0, JSON.stringify(u));

  // Nov 7: Traveler Type is optional on Step 1 — a submit without it must work (it used to 400)
  const fam = 'fam' + Date.now() + '@example.com';
  await db.query(`delete from rate_limits`).catch(() => {});
  const famRes = await form.handler({ httpMethod: 'POST', path: '/submit', headers: { Authorization: `Bearer ${token('uidFam' + Date.now(), fam)}` }, body: JSON.stringify({ destination: 'Vietnam', days: 6, budget: 3000, currency: 'AUD', selected_venues: { version: 2, picks: [], interests: [], tripPrefs: { adults: 2, kids: [3], transferComfort: 'short' } } }), requestContext: { identity: { sourceIp: '7.7.7.7' } } });
  const famRow = (await db.query('select traveler_type from submissions where email=$1', [fam])).rows[0];
  check('submit without travelerType → 200, stored as Family from who\'s travelling', famRes.statusCode === 200 && famRow?.traveler_type === 'Family', `${famRes.statusCode} ${famRes.body.slice(0, 120)}`);
  const badRes = await form.handler({ httpMethod: 'POST', path: '/submit', headers: { Authorization: `Bearer ${token('uidBad' + Date.now(), 'bad' + Date.now() + '@example.com')}` }, body: JSON.stringify({ days: 6, budget: 3000, currency: 'AUD' }), requestContext: { identity: { sourceIp: '7.7.7.8' } } });
  check('a real validation error says what is wrong', badRes.statusCode === 400 && /destination is required/.test(JSON.parse(badRes.body).message));

  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
