'use strict';
// Pricing design D (Nov 16 2026): Trip Pass + One trip from Stripe metadata, GET /pricing from Stripe.
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STRIPE_WEBHOOK_SECRET: 'whsec_local', STRIPE_SECRET_KEY: 'sk_test_x', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', STAGE: 'test', FRONTEND_URL: 'https://www.wanderzenai.com', CLAUDE_API_KEY: 'x' });
const REPO = require('path').resolve(__dirname, '../../..');
const { getDB } = require('/opt/nodejs/index');
const auth = require('/opt/nodejs/auth.js');
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda');
lambdaSdk.LambdaClient.prototype.send = async () => ({});
const webhook = require(`${REPO}/backend/functions/form-handler/stripe-webhook.js`);
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const { handleGenerationFailure } = require(`${REPO}/backend/functions/itinerary-gen/failure.js`);
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now()/1000); const h=b64({alg:'RS256',kid:'k'}), p=b64({iss:'https://securetoken.google.com/wanderzenai-9c343',aud:'wanderzenai-9c343',sub,iat:t-5,exp:t+3600,email,email_verified:true}); return `${h}.${p}.${crypto.sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url')}`; };
const deliver = (evt) => { const body = JSON.stringify(evt); const t = Math.floor(Date.now()/1000); const sig = crypto.createHmac('sha256','whsec_local').update(`${t}.${body}`).digest('hex'); return webhook.handler({ headers: { 'Stripe-Signature': `t=${t},v1=${sig}` }, body }); };
const call = (method, path, uid, email, body) => form.handler({ httpMethod: method, path, headers: uid ? { Authorization: `Bearer ${token(uid, email)}` } : {}, body: body ? JSON.stringify(body) : null, queryStringParameters: null, requestContext: { identity: { sourceIp: '1.1.1.1' } } });
const submit = (uid, email) => call('POST', '/submit', uid, email, { destination: 'Kyoto', days: 3, budget: 900, currency: 'AUD', travelerType: 'Solo' });
const paid = (id, uid, metadata) => ({ id: 'evt_' + id, type: 'checkout.session.completed', data: { object: { id: 'cs_' + id, mode: 'payment', payment_status: 'paid', client_reference_id: uid, customer_details: { email: 'x@example.com' }, customer: 'cus_p', metadata } } });
const out = []; const check = (n, c, d='') => out.push(`${c?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`);

(async () => {
  const db = getDB(); const now = Date.now(); const uid = 'uidPass' + now; const email = `pass${now}@example.com`;
  await db.query(`insert into users (email, firebase_uid, plan, itineraries_remaining) values ($1,$2,'free',0)`, [email, uid]);
  const left = async () => (await db.query('select coalesce(sum(trips_left),0)::int n from trip_passes where email=$1', [email])).rows[0].n;
  const credits = async () => (await db.query('select itineraries_remaining n from users where email=$1', [email])).rows[0].n;

  let r = await deliver(paid(now + 'a', uid, { wz_plan: 'pass', trips: '3', valid_days: '365' }));
  check('Trip Pass checkout adds a pass with 3 trips (no credits)', r.statusCode === 200 && await left() === 3 && await credits() === 0);
  r = await deliver({ ...paid(now + 'a', uid, { wz_plan: 'pass', trips: '3', valid_days: '365' }), id: 'evt_' + now + 'dup' });
  check('same checkout session delivered again under a new event id adds nothing', r.statusCode === 200 && await left() === 3);
  r = await deliver(paid(now + 'b', uid, { wz_plan: 'trip', trips: '1' }));
  check('One trip checkout adds 1 credit that never expires', r.statusCode === 200 && await credits() === 1);

  r = await call('GET', '/entitlement', uid, email); let e = JSON.parse(r.body).data;
  check('GET /entitlement says the next trip uses the pass (3 left, with expiry)', e.source === 'pass' && e.remaining === 3 && !!e.expiresAt, JSON.stringify(e));

  r = await submit(uid, email);
  check('submit spends the pass before the credit', r.statusCode === 200 && await left() === 2 && await credits() === 1);
  const sub = (await db.query(`select id, plan from submissions where email=$1 order by created_at desc limit 1`, [email])).rows[0];
  check('…and is recorded as paid', sub.plan === 'paid');

  const passId = (await db.query('select id from trip_passes where email=$1', [email])).rows[0].id;
  const f = await handleGenerationFailure({ db, sendEmail: async () => {}, submissionId: sub.id, creditSource: `pass:${passId}`, errorMessage: 'test', log: { info() {}, error() {} } });
  check('a failed generation gives the trip back to the same pass', f.refunded === true && await left() === 3);

  // Use up this month's free trip first, so only paid sources are left to race for.
  await db.query(`insert into submissions (id, email, destination, days, budget, traveler_type, plan, status) values ($1, $2, 'Hue', 2, 500, 'Solo', 'free', 'email_sent')`, ['wz_free_' + now, email]);
  const par = await Promise.all(Array.from({ length: 6 }, () => submit(uid, email)));
  const okN = par.filter(x => x.statusCode === 200).length;
  check('6 parallel submits: 3 from the pass + 1 credit, never more', okN === 4 && await left() === 0 && await credits() === 0, `${okN} ok`);

  await db.query(`insert into trip_passes (email, trips_total, trips_left, expires_at) values ($1, 2, 2, NOW() - interval '1 day')`, [email]);
  r = await call('GET', '/entitlement', uid, email); e = JSON.parse(r.body).data;
  check('an expired pass is not used', e.source !== 'pass', JSON.stringify(e));

  // GET /pricing — from Stripe (stubbed), currency stated, location currency when Stripe has it.
  const realFetch = global.fetch; let stripeCalls = 0;
  global.fetch = async (url) => {
    stripeCalls++;
    const u = String(url);
    const body = u.includes('/products/search')
      ? { data: [
          { id: 'p1', active: true, name: 'One trip', description: 'd', metadata: { wz_plan: 'trip', trips: '1' }, default_price: { active: true, currency: 'aud', unit_amount: 1900, currency_options: { aud: { unit_amount: 1900 }, usd: { unit_amount: 1300 } } } },
          { id: 'p2', active: true, name: 'Trip Pass', description: 'd', metadata: { wz_plan: 'pass', trips: '6', valid_days: '365' }, default_price: { active: true, currency: 'aud', unit_amount: 5900 } },
        ] }
      : { data: [{ active: true, url: 'https://buy.stripe.com/test_trip', metadata: { wz_plan: 'trip' } }, { active: true, url: 'https://buy.stripe.com/test_pass', metadata: { wz_plan: 'pass' } }] };
    return { ok: true, status: 200, json: async () => body };
  };
  const pricingCall = (country) => form.handler({ httpMethod: 'GET', path: '/pricing', headers: {}, queryStringParameters: country ? { country } : null, requestContext: { identity: { sourceIp: '1.1.1.1' } } });
  r = await pricingCall('AU'); let p = JSON.parse(r.body).data;
  check('GET /pricing (public) lists One trip A$19 and Trip Pass A$59 / 6 trips, in AUD', r.statusCode === 200 && p.plans[0].amount === 19 && p.plans[0].currency === 'AUD' && p.plans[1].trips === 6 && p.plans[1].amount === 59, JSON.stringify(p.plans.map(x => [x.plan, x.amount, x.currency])));
  r = await pricingCall('US'); p = JSON.parse(r.body).data;
  check('a US visitor sees USD where Stripe has a USD price, AUD otherwise', p.plans[0].currency === 'USD' && p.plans[0].amount === 13 && p.plans[1].currency === 'AUD');
  check('Stripe is read once, then cached', stripeCalls === 2, `${stripeCalls} calls`);
  check('no secret or Stripe ids leak in the response', !/sk_test|price_|prod_|plink_/.test(r.body));
  global.fetch = realFetch;

  console.log(out.join('\n')); console.log(`\n${out.filter(x=>x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x=>x.startsWith('FAIL'))?1:0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
