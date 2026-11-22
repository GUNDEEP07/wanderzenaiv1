'use strict';
// Trip companion (Nov 22 2026): the dashboard chat answers questions about the user's own
// upcoming trip. Locked days never reach the model; other people's trips are never used.
// Local Postgres, Claude stubbed (we inspect the system prompt it would have received).
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', CLAUDE_API_KEY: 'sk-test', AWS_REGION: 'ap-southeast-2', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', FRONTEND_URL: 'https://www.wanderzenai.com' });
const REPO = require('path').resolve(__dirname, '../../..');
const prompts = [];
// The recommendations function calls Claude through the Anthropic SDK: stub its messages.create.
const Anthropic = require(`${REPO}/backend/functions/recommendations/node_modules/@anthropic-ai/sdk`);
const Messages = Object.getPrototypeOf(new Anthropic({ apiKey: 'x' }).messages).constructor;
Messages.prototype.create = async (body) => {
  prompts.push(body.system || '');
  return { content: [{ type: 'text', text: 'Pack layers — Day 2 is the Glenorchy drive.' }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' };
};
const auth = require('/opt/nodejs/auth.js');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now() / 1000); const h = b64({ alg: 'RS256', kid: 'k' }), p = b64({ iss: 'https://securetoken.google.com/wanderzenai-9c343', aud: 'wanderzenai-9c343', sub, iat: t - 5, exp: t + 3600, email, email_verified: true }); return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`; };
const { getDB } = require('/opt/nodejs/index');
const recs = require(`${REPO}/backend/functions/recommendations/index.js`);
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d && !c ? '  — ' + d : ''}`);
const ol = console.log, ow = console.warn, oe = console.error; const quiet = () => { console.log = console.warn = console.error = () => {}; }; const loud = () => { console.log = ol; console.warn = ow; console.error = oe; };
const chat = async (tok, body) => {
  quiet(); const res = await recs.handler({ httpMethod: 'POST', path: '/recommendations/chat', headers: { Authorization: `Bearer ${tok}`, origin: 'https://www.wanderzenai.com' }, body: JSON.stringify(body), requestContext: { identity: { sourceIp: '9.9.9.9' } }, queryStringParameters: null }); loud();
  let json = {}; try { json = JSON.parse(res.body); } catch { /* empty */ }
  return { status: res.statusCode, json };
};

const act = (tag) => ({ time: '09:00', activity: `ACT-${tag}`, location: `LOC-${tag}`, venueName: null, insiderTip: `TIP-${tag}` });
const ITIN = {
  title: 'Queenstown slow loop',
  summary: 'Lakes and mountains',
  route: { bases: [{ name: 'Queenstown', days: 3 }, { name: 'Te Anau', days: 2 }] },
  days: [1, 2, 3].map((d) => ({ dayNumber: d, theme: `Theme ${d}`, base: 'Queenstown', morningActivity: act(`M${d}`), afternoonActivity: act(`A${d}`), eveningActivity: act(`E${d}`), hiddenGem: `GEM-${d}`, localEats: { name: `EAT-${d}`, dish: 'pie' } })),
  stays: [{ base: 'Queenstown', type: 'homestay', priceTier: 'mid', why: 'STAY-WHY' }],
  practicalTips: ['TIP-PRACTICAL'],
  avoidList: ['TRAP-1'],
};

(async () => {
  const db = getDB();
  await db.query('DELETE FROM rate_limits').catch(() => {});
  const n = Date.now();
  const me = `companion${n}@example.com`, other = `other${n}@example.com`;
  const meTok = token(`u${n}`, me), otherTok = token(`o${n}`, other);
  const future = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const add = async (id, email, { plan = 'paid', status = 'email_sent', travelDate = null, destination = 'Queenstown' } = {}) => {
    await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,plan,status,travel_date) VALUES ($1,$2,$3,3,3000,'AUD','Couple',$4,$5,$6)`, [id, email, destination, plan, status, travelDate]);
    await db.query(`INSERT INTO itineraries (id, submission_id, email, destination, itinerary_data, currency) VALUES ($1,$2,$3,$4,$5,'AUD')`, [`it_${id}`, id, email, destination, JSON.stringify(ITIN)]);
  };
  const id = (k) => `wz_${String(n).slice(-8)}_${(k + 'x'.repeat(16)).slice(0, 16)}`;
  await add(id('past'), me, { travelDate: past, destination: 'Kyoto' });
  await add(id('soon'), me, { travelDate: future, plan: 'free' });   // locked free trip, upcoming
  await add(id('other'), other, { travelDate: future, destination: 'Hanoi' });

  // 1. No trip named → the upcoming one, locked days kept out of the prompt.
  let r = await chat(meTok, { message: 'What should I pack?', history: [{ role: 'user', content: 'What should I pack?' }] });
  const sys = prompts[prompts.length - 1];
  check('companion picks the upcoming trip (not the past one)', r.status === 200 && r.json.trip?.id === id('soon') && r.json.trip.locked === true, JSON.stringify(r.json).slice(0, 200));
  check('prompt carries Day 1 in full', sys.includes('ACT-M1') && sys.includes('TIP-M1') && sys.includes('EAT-1'));
  check('locked days: theme only, no details, no stays/tips', sys.includes('Theme 2') && sys.includes('[LOCKED') && !/ACT-[MAE][23]|GEM-[23]|EAT-[23]|STAY-WHY|TIP-PRACTICAL|TRAP-1/.test(sys), sys.slice(0, 400));
  check('reply comes back', /Glenorchy/.test(r.json.reply || ''), JSON.stringify(r.json));

  // 2. Someone else's trip id → not used (falls back to planning chat, no trip in the reply).
  r = await chat(meTok, { message: 'hi', tripId: id('other') });
  const sys2 = prompts[prompts.length - 1];
  check("another user's trip is never loaded", r.status === 200 && !r.json.trip && !sys2.includes('Hanoi') && /FLOW/.test(sys2), JSON.stringify(r.json).slice(0, 160));

  // 3. Unlocked trip → every day available.
  await db.query('UPDATE submissions SET unlocked_at = NOW() WHERE id = $1', [id('soon')]);
  r = await chat(meTok, { message: 'Day 3 dinner?', tripId: id('soon') });
  const sys3 = prompts[prompts.length - 1];
  check('unlocked trip: all days, stays and tips in the prompt', r.json.trip?.locked === false && sys3.includes('ACT-E3') && sys3.includes('STAY-WHY') && sys3.includes('TIP-PRACTICAL'));

  // 4. "New trip" mode → the planning chat.
  r = await chat(meTok, { message: 'Plan Bali', mode: 'plan' });
  check('mode=plan → planning chat, no trip', r.status === 200 && !r.json.trip && /FLOW/.test(prompts[prompts.length - 1]));

  // 5. Bad input.
  r = await chat(meTok, { message: 'x', tripId: '../etc/passwd' });
  check('malformed trip id → 400', r.status === 400, `${r.status}`);
  r = await chat(meTok, { message: 'x', mode: 'admin' });
  check('unknown mode → 400', r.status === 400, `${r.status}`);

  // 6. A user with no delivered trip → planning chat.
  r = await chat(token(`z${n}`, `nobody${n}@example.com`), { message: 'hello' });
  check('no trips → planning chat', r.status === 200 && !r.json.trip && /FLOW/.test(prompts[prompts.length - 1]));
  void otherTok;

  console.log(out.join('\n')); console.log(`\n${out.filter((x) => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { loud(); console.error('ERR', e); process.exit(1); });
