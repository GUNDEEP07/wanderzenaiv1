'use strict';
// No filler days, end to end: real itinerary-gen + form-handler entitlement on local Postgres.
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', CLAUDE_API_KEY: 'sk-test', FOURSQUARE_API_KEY: '', AWS_REGION: 'ap-southeast-2', FROM_EMAIL: 'hello@wanderzenai.com', FRONTEND_URL: 'https://www.wanderzenai.com' });
const REPO = require('path').resolve(__dirname, '../../..');
let mode = 'garbage'; let delayMs = 0; const emails = [];
global.fetch = async (url, opts) => {
  if (!String(url).includes('anthropic')) return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => '{}' };
  const prompt = JSON.parse(opts.body).messages[0].content;
  if (delayMs) await new Promise(r => setTimeout(r, delayMs));
  let text;
  if (/overview section/.test(prompt)) text = JSON.stringify({ title: 't', summary: 's', accommodation: {}, practicalTips: [], totalEstimatedCost: 900, avoidList: [] });
  else if (mode === 'garbage' && /Create days 4/.test(prompt)) text = 'Sorry, here is a lovely plan: Day 4 …';
  else { const nums = /Create days ([\d, ]+) of/.exec(prompt)[1].split(',').map(s => +s.trim());
    text = JSON.stringify({ days: nums.map(n => ({ dayNumber: n, theme: 'x', morningActivity: { venueName: `S${n}` }, afternoonActivity: {}, eveningActivity: {}, hiddenGem: 'g', dailyCost: 1, localEats: {} })) }); }
  return { ok: true, status: 200, headers: new Map(), json: async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }) };
};
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda');
const invoked = []; lambdaSdk.LambdaClient.prototype.send = async (c) => { invoked.push(c.input.FunctionName); return {}; };
const sesSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-ses');
sesSdk.SESClient.prototype.send = async (c) => { emails.push(c.input); return {}; };
const { getDB } = require('/opt/nodejs/index');
const gen = require(`${REPO}/backend/functions/itinerary-gen/index.js`);
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
const ctx = (ms) => ({ getRemainingTimeInMillis: () => ms });
(async () => {
  const db = getDB(); const n = Date.now();
  const mk = async (id, email, plan = 'paid') => db.query(`insert into submissions (id,email,destination,days,budget,currency,traveler_type,travel_style,plan,status,selected_venues)
    values ($1,$2,'Kyoto',6,1000,'AUD','Couple','[]',$3,'pending','{"version":2,"picks":[],"interests":[]}')`, [id, email, plan]);
  const q = (sql, p) => db.query(sql, p).then(r => r.rows[0]);
  const ol = console.log, ow = console.warn, oe = console.error; const quiet = () => { console.log = console.warn = console.error = () => {}; }; const loud = () => { console.log = ol; console.warn = ow; console.error = oe; };

  // 1. Unparseable batch, paid with a monthly itinerary
  const email = `fail${n}@example.com`;
  await db.query(`insert into users (email, plan, monthly_remaining, itineraries_remaining) values ($1,'subscriber',2,0)`, [email]);
  await mk('wz_f1_' + n, email);
  quiet(); await gen.handler({ submissionId: 'wz_f1_' + n, isPaid: true, creditSource: 'monthly' }, ctx(900000)); loud();
  let s = await q('select status, error_message from submissions where id=$1', ['wz_f1_' + n]);
  let u = await q('select monthly_remaining from users where email=$1', [email]);
  const itin = await q('select count(*)::int c from itineraries where submission_id=$1', ['wz_f1_' + n]);
  check('unparseable batch → submission failed (no filler days shipped)', s.status === 'failed' && itin.c === 0 && !invoked.some(f => /pdf-builder/.test(f)), `${s.status}: ${s.error_message}`);
  check('monthly itinerary given back (2 → 3)', u.monthly_remaining === 3, JSON.stringify(u));
  check('user emailed "couldn\'t finish" with refund wording', emails.length === 1 && emails[0].Destination.ToAddresses[0] === email && /returned to your account/.test(emails[0].Message.Body.Text.Data));

  // 2. Lambda retry of the same event: no second refund/email
  quiet(); await gen.handler({ submissionId: 'wz_f1_' + n, isPaid: true, creditSource: 'monthly' }, ctx(900000)); loud();
  u = await q('select monthly_remaining from users where email=$1', [email]);
  check('repeated invocation: no double refund, no second email', u.monthly_remaining === 3 && emails.length === 1);

  // 3. Deadline: Claude too slow → failed + refunded, late result discarded
  mode = 'ok'; delayMs = 2500;
  await db.query('update users set itineraries_remaining = 0 where email=$1', [email]);
  await mk('wz_f2_' + n, email);
  quiet(); await gen.handler({ submissionId: 'wz_f2_' + n, isPaid: true, creditSource: 'credit' }, ctx(61000)); loud();
  s = await q('select status, error_message from submissions where id=$1', ['wz_f2_' + n]);
  u = await q('select itineraries_remaining from users where email=$1', [email]);
  check('deadline hit → failed and the purchased credit refunded', s.status === 'failed' && /too long/.test(s.error_message) && u.itineraries_remaining === 1, JSON.stringify({ s, u }));
  await new Promise(r => setTimeout(r, 6000)); // let the abandoned generation finish
  const late = await q('select count(*)::int c from itineraries where submission_id=$1', ['wz_f2_' + n]);
  s = await q('select status from submissions where id=$1', ['wz_f2_' + n]);
  check('late finish after the deadline stores nothing and status stays failed', late.c === 0 && s.status === 'failed');

  // 4. Free user whose generation failed can try again
  mode = 'garbage'; delayMs = 0;
  const freeEmail = `free${n}@example.com`;
  await db.query(`insert into users (email, plan) values ($1,'free')`, [freeEmail]);
  await mk('wz_f3_' + n, freeEmail, 'free');
  quiet(); await gen.handler({ submissionId: 'wz_f3_' + n, isPaid: false, creditSource: null }, ctx(900000)); loud();
  const ent = await form._internal.decideEntitlement(db, freeEmail);
  check('failed free itinerary does not use up the free one', ent.allowed && ent.reason === 'free_monthly', JSON.stringify(ent));
  check('free-user email says it does not count', /does not count/.test(emails.at(-1).Message.Body.Text.Data));

  // 5. Happy path still works and still triggers the PDF
  mode = 'ok'; invoked.length = 0;
  await mk('wz_f4_' + n, email);
  quiet(); await gen.handler({ submissionId: 'wz_f4_' + n, isPaid: true, creditSource: 'credit' }, ctx(900000)); loud();
  s = await q('select status from submissions where id=$1', ['wz_f4_' + n]);
  check('normal generation still completes and triggers the PDF', s.status === 'itinerary_ready' && invoked.some(f => /pdf-builder/.test(f)), s.status);

  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log = ol; console.error('ERR', e); process.exit(1); });
