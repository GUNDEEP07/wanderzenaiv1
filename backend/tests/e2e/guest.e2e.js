'use strict';
// Guest planning (Nov 8): /route-plan + /preview without sign-in, IP + global guest limits,
// route cache, GET /entitlement, /profile/draft. Local Postgres, Claude stubbed.
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', CLAUDE_API_KEY: 'sk-test', AWS_REGION: 'ap-southeast-2', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', FRONTEND_URL: 'https://www.wanderzenai.com',
  RATE_LIMITS_JSON: JSON.stringify({ guestRoute: [{ limit: 3, windowSeconds: 3600 }], guestPreview: [{ limit: 4, windowSeconds: 3600 }], guestAi: [{ limit: 9, windowSeconds: 86400 }] }) });
const REPO = require('path').resolve(__dirname, '../../..');
let claudeCalls = 0;
const reply = (name) => JSON.stringify({ options: [{ name, summary: 's', bases: [{ name: 'Cusco', days: 5, lat: -13.5, lng: -72 }, { name: 'Arequipa', days: 5, lat: -16.4, lng: -71.5, transferIn: { mode: 'flight', hours: 2 } }] }] });
global.fetch = async (url, opts) => {
  if (!String(url).includes('anthropic')) return { ok: true, status: 200, json: async () => ({}), text: async () => '{}' };
  claudeCalls++;
  const prompt = JSON.parse(opts.body).messages[0].content;
  const text = /Suggest ONE ROUTE/.test(prompt) ? reply(`Route ${claudeCalls}`) : JSON.stringify([{ day: 1, theme: 'Arrive', vibe: 'slow' }, { day: 2, theme: 'Walk', vibe: 'calm' }]);
  return { ok: true, status: 200, headers: new Map(), json: async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }) };
};
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda'); lambdaSdk.LambdaClient.prototype.send = async () => ({});
const auth = require('/opt/nodejs/auth.js');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now()/1000); const h=b64({alg:'RS256',kid:'k'}), p=b64({iss:'https://securetoken.google.com/wanderzenai-9c343',aud:'wanderzenai-9c343',sub,iat:t-5,exp:t+3600,email,email_verified:true}); return `${h}.${p}.${crypto.sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url')}`; };
const { getDB } = require('/opt/nodejs/index');
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const profile = require(`${REPO}/backend/functions/profile/handler.js`);
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d && !c ? '  — ' + d : ''}`);
const ol = console.log, ow = console.warn, oe = console.error; const quiet = () => { console.log = console.warn = console.error = () => {}; }; const loud = () => { console.log = ol; console.warn = ow; console.error = oe; };
const call = async (fn, method, path, { tok, body, ip = '1.1.1.1' } = {}) => {
  quiet(); const res = await fn.handler({ httpMethod: method, path, headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: body ? JSON.stringify(body) : null, requestContext: { identity: { sourceIp: ip } }, queryStringParameters: null }); loud();
  let json = {}; try { json = JSON.parse(res.body); } catch { /* empty */ }
  return { status: res.statusCode, json };
};

(async () => {
  const db = getDB();
  await db.query('DELETE FROM rate_limits').catch(() => {});
  await db.query('DROP TABLE IF EXISTS route_plan_cache'); await db.query('DROP TABLE IF EXISTS plan_drafts');
  const n = Date.now();

  // 1. Guest routes
  let r = await call(form, 'POST', '/route-plan', { body: { destination: 'Vietnam', days: 10 } });
  check('guest: curated country → 200 with routes, no Claude call', r.status === 200 && r.json.data.source === 'curated' && claudeCalls === 0, `${r.status} ${claudeCalls}`);
  r = await call(form, 'POST', '/route-plan', { body: { destination: 'Peru', days: 10, prefs: { adults: 2, kids: [] } } });
  const first = claudeCalls;
  check('guest: other country → Claude routes (3 parallel calls)', r.status === 200 && r.json.data.source === 'ai' && first === 3, `${r.status} ${first} ${JSON.stringify(r.json).slice(0, 150)}`);
  r = await call(form, 'POST', '/route-plan', { body: { destination: ' peru ', days: 10, prefs: { adults: 2, kids: [] } }, ip: '2.2.2.2' });
  check('same trip again (another visitor) → served from cache, 0 Claude calls', r.status === 200 && claudeCalls === first && r.json.data.options.length > 0, `${claudeCalls}`);
  r = await call(form, 'POST', '/route-plan', { body: { destination: 'Peru', days: 10, prefs: { adults: 2, kids: [4] } } });
  check('different travellers (a child) → not the cached answer', claudeCalls === first + 3, `${claudeCalls}`);
  r = await call(form, 'POST', '/route-plan', { body: { destination: 'Peru', days: 10, more: true, avoid: ['Route 1'], prefs: { adults: 2, kids: [] } } });
  check('"show other ideas" never comes from cache', r.status === 200 && claudeCalls === first + 6, `${claudeCalls}`);
  r = await call(form, 'POST', '/route-plan', { body: { destination: 'Chile', days: 8 } });
  check('guest IP over its route limit (3/h here) → 429', r.status === 429, `${r.status}`);
  r = await call(form, 'POST', '/route-plan', { body: { destination: 'Peru', days: 10, prefs: { adults: 2, kids: [] } } });
  check('…but a cached trip still answers (no Claude, no limit)', r.status === 200, `${r.status}`);

  // 2. Guest preview + global guest cap
  r = await call(form, 'POST', '/preview', { body: { destination: 'Peru', days: 2 }, ip: '3.3.3.3' });
  check('guest preview → 200 outline', r.status === 200 && r.json.data.days.length === 2, `${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  // guestAi (9/day here) counts every guest route/preview request that reached the limiter: 3 + 1 + 1 so far (+ the refused Chile one counted before the IP check refused it? no: IP checked first)
  const statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await call(form, 'POST', '/preview', { body: { destination: 'Peru', days: 2 }, ip: `4.4.4.${i}` })).status);
  check('shared daily cap on all guests → 429 once reached, whatever the IP', statuses.includes(429) && statuses[0] === 200, statuses.join(','));
  const userTok = token('uG' + n, `g${n}@example.com`);
  r = await call(form, 'POST', '/preview', { tok: userTok, body: { destination: 'Peru', days: 2 }, ip: '4.4.4.0' });
  check('signed-in users are not affected by guest limits', r.status === 200, `${r.status}`);
  r = await call(form, 'POST', '/preview', { tok: 'garbage.token.here', body: { destination: 'Peru', days: 2 }, ip: '5.5.5.5' });
  check('an invalid token is treated as a guest (not a 500)', r.status === 200 || r.status === 429, `${r.status}`);

  // 3. Still signed-in only
  r = await call(form, 'POST', '/submit', { body: { destination: 'Peru' } });
  check('guest /submit → 401', r.status === 401, `${r.status}`);
  r = await call(form, 'GET', '/entitlement');
  check('guest /entitlement → 401', r.status === 401, `${r.status}`);
  r = await call(form, 'GET', '/itinerary/wz_abcdef_ABCDEFGHIJKLMNOP/progress');
  check('guest progress → 401', r.status === 401, `${r.status}`);

  // 4. Entitlement (read-only)
  const email = `e${n}@example.com`; const eTok = token('uE' + n, email);
  await db.query(`INSERT INTO users (email, firebase_uid) VALUES ($1, $2)`, [email, 'uE' + n]);
  r = await call(form, 'GET', '/entitlement', { tok: eTok });
  check('new user → free itinerary available', r.status === 200 && r.json.data.allowed && r.json.data.source === 'free', JSON.stringify(r.json));
  await db.query(`INSERT INTO submissions (id, email, destination, days, budget, traveler_type, plan, status) VALUES ($1, $2, 'Peru', 5, 1000, 'Couple', 'free', 'email_sent')`, [`wz_e${n % 1e6}_AAAAAAAAAAAAAAAA`, email]);
  r = await call(form, 'GET', '/entitlement', { tok: eTok });
  check('after this month\'s free one → not allowed, FREE_TIER_EXHAUSTED', r.json.data.allowed === false && r.json.data.code === 'FREE_TIER_EXHAUSTED', JSON.stringify(r.json));
  await db.query(`UPDATE users SET itineraries_remaining = 2 WHERE email = $1`, [email]);
  r = await call(form, 'GET', '/entitlement', { tok: eTok });
  check('with 2 purchased credits → credit, 2 remaining', r.json.data.allowed && r.json.data.source === 'credit' && r.json.data.remaining === 2, JSON.stringify(r.json));
  await db.query(`UPDATE users SET plan = 'subscriber', monthly_remaining = 4 WHERE email = $1`, [email]);
  r = await call(form, 'GET', '/entitlement', { tok: eTok });
  check('Wanderer with 4 left this month → monthly first', r.json.data.source === 'monthly' && r.json.data.remaining === 4, JSON.stringify(r.json));
  const before = (await db.query('SELECT itineraries_remaining, monthly_remaining FROM users WHERE email = $1', [email])).rows[0];
  check('checking never spends anything', before.itineraries_remaining === 2 && before.monthly_remaining === 4, JSON.stringify(before));
  await db.query(`UPDATE users SET monthly_remaining = 0, itineraries_remaining = 0 WHERE email = $1`, [email]);
  r = await call(form, 'GET', '/entitlement', { tok: eTok });
  check('Wanderer with none left → MONTHLY_LIMIT_REACHED', r.json.data.allowed === false && r.json.data.code === 'MONTHLY_LIMIT_REACHED', JSON.stringify(r.json));

  // 5. Plan drafts
  const draft = { form: { destinations: [{ name: 'Peru' }], days: 10 }, step: 3 };
  r = await call(profile, 'GET', '/profile/draft', { tok: eTok });
  check('draft: none yet → null', r.status === 200 && r.json.draft === null, JSON.stringify(r.json));
  r = await call(profile, 'PUT', '/profile/draft', { tok: eTok, body: draft });
  check('draft: save', r.status === 200, `${r.status}`);
  r = await call(profile, 'GET', '/profile/draft', { tok: eTok });
  check('draft: read back with its step and time', r.json.draft?.step === 3 && r.json.draft.form.destinations[0].name === 'Peru' && r.json.draft.updatedAt, JSON.stringify(r.json));
  r = await call(profile, 'GET', '/profile/draft', { tok: userTok });
  check('draft: another account cannot see it', r.json.draft === null, JSON.stringify(r.json));
  r = await call(profile, 'PUT', '/profile/draft', { tok: eTok, body: { form: [], step: 9 } });
  check('draft: bad shape → 400', r.status === 400, `${r.status}`);
  r = await call(profile, 'PUT', '/profile/draft', { tok: eTok, body: { form: { notes: 'x'.repeat(70000) }, step: 1 } });
  check('draft: over 64 KB → refused', r.status === 400 || r.status === 413, `${r.status}`);
  r = await call(profile, 'PUT', '/profile/draft', { body: draft });
  check('draft: guest → 401', r.status === 401, `${r.status}`);
  r = await call(profile, 'DELETE', '/profile/draft', { tok: eTok });
  const after = await call(profile, 'GET', '/profile/draft', { tok: eTok });
  check('draft: delete', r.status === 200 && after.json.draft === null, JSON.stringify(after.json));

  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { loud(); console.error('ERR', e); process.exit(1); });
