'use strict';
// "Adjust this day" end to end: form-handler claims a slot, itinerary-gen rewrites the day,
// PDF rebuild triggered in update mode. Local Postgres; Claude, Foursquare and Lambda stubbed.
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', CLAUDE_API_KEY: 'sk-test', FOURSQUARE_API_KEY: '', AWS_REGION: 'ap-southeast-2', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', FRONTEND_URL: 'https://www.wanderzenai.com' });
const REPO = require('path').resolve(__dirname, '../../..');
const prompts = []; let claudeMode = 'ok';
const act = (v) => ({ time: '9:00', activity: 'x', location: 'Hoi An', venueName: v, why: 'w', cost: 0, isFree: true, insiderTip: 't' });
const day = (n, tag) => ({ dayNumber: n, theme: `${tag} ${n}`, morningActivity: act(`${tag} market ${n}`), afternoonActivity: act(`${tag} beach ${n}`), eveningActivity: act(`${tag} lantern ${n}`), hiddenGem: 'g', dailyCost: 40, localEats: { name: `${tag} cao lau ${n}`, dish: 'd', cost: 5, venueName: null, vibe: 'v' } });
global.fetch = async (url, opts) => {
  if (!String(url).includes('anthropic')) return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => '{}' };
  const prompt = JSON.parse(opts.body).messages[0].content; prompts.push(prompt);
  const n = +/Create days (\d+) of/.exec(prompt)[1];
  const text = claudeMode === 'junk' ? 'sorry, no' : JSON.stringify({ days: [day(n, 'NEW')] });
  return { ok: true, status: 200, headers: new Map(), json: async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 100, output_tokens: 300 }, stop_reason: 'end_turn' }) };
};
const invokes = [];
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda');
lambdaSdk.LambdaClient.prototype.send = async (cmd) => { invokes.push({ fn: cmd.input.FunctionName, payload: JSON.parse(Buffer.from(cmd.input.Payload).toString()) }); return {}; };
const auth = require('/opt/nodejs/auth.js');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now()/1000); const h=b64({alg:'RS256',kid:'k'}), p=b64({iss:'https://securetoken.google.com/wanderzenai-9c343',aud:'wanderzenai-9c343',sub,iat:t-5,exp:t+3600,email,email_verified:true}); return `${h}.${p}.${crypto.sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url')}`; };
const { getDB } = require('/opt/nodejs/index');
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const gen = require(`${REPO}/backend/functions/itinerary-gen/index.js`);
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d && !c ? '  — ' + d : ''}`);
const ol = console.log, ow = console.warn, oe = console.error; const quiet = () => { console.log = console.warn = () => {}; }; const loud = () => { console.log = ol; console.warn = ow; console.error = oe; };
const call = async (method, path, tok, body) => {
  quiet(); const res = await form.handler({ httpMethod: method, path, headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: body ? JSON.stringify(body) : null, requestContext: { identity: { sourceIp: '9.9.9.9' } } }); loud();
  let json = {}; try { json = JSON.parse(res.body); } catch { /* empty */ } return { status: res.statusCode, json };
};
const runGen = async () => { const p = invokes.filter(i => i.fn.includes('itinerary-gen')).pop().payload; quiet(); await gen.handler(p); loud(); return p; };

(async () => {
  const db = getDB(); await db.query('DELETE FROM rate_limits').catch(() => {});
  const n = Date.now(), email = `adj${n}@example.com`, tok = token('uA' + n, email), other = token('uO' + n, `other${n}@example.com`);
  const id = `wz_adj${String(n).slice(-6)}_${'A'.repeat(16)}`;
  const sv = { version: 2, interests: [], picks: [], route: { bases: [{ name: 'Hanoi', days: 1, lat: 21, lng: 105.8 }, { name: 'Hoi An', days: 2, lat: 15.9, lng: 108.3, transferIn: { mode: 'flight', hours: 2 } }] } };
  await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,travel_style,plan,status,selected_venues) VALUES ($1,$2,'Vietnam',3,2000,'AUD','Couple','["Nature"]','paid','email_sent',$3)`, [id, email, JSON.stringify(sv)]);
  const itin = { title: 'T', days: [day(1, 'OLD'), day(2, 'OLD'), day(3, 'OLD')] };
  await db.query(`INSERT INTO itineraries (id, submission_id, email, destination, itinerary_data, currency, claude_input_tokens, claude_output_tokens) VALUES ($1,$2,$3,'Vietnam',$4,'AUD',1000,2000)`, [`it_${n}`, id, email, JSON.stringify(itin)]);
  const base = `/itinerary/${id}`;

  let r = await call('GET', `${base}/adjustments`, tok);
  check('owner: 3 adjustments available', r.status === 200 && r.json.data.remaining === 3 && r.json.data.used === 0, JSON.stringify(r.json));
  r = await call('GET', `${base}/adjustments`, other);
  check('someone else → 404 (share links reveal nothing)', r.status === 404, `${r.status}`);
  r = await call('GET', `${base}/adjustments`);
  check('signed out → 401', r.status === 401, `${r.status}`);
  r = await call('POST', `${base}/days/2/adjust`, tok, { note: 'x' });
  check('note too short → 400', r.status === 400, `${r.status}`);
  r = await call('POST', `${base}/days/2/adjust`, tok, { note: 'y'.repeat(301) });
  check('note too long → 400', r.status === 400, `${r.status}`);
  r = await call('POST', `${base}/days/9/adjust`, tok, { note: 'less walking please' });
  check('day outside the trip → 400', r.status === 400, `${r.status}`);
  r = await call('POST', `${base}/days/2/adjust`, other, { note: 'less walking please' });
  check("can't adjust someone else's trip → 404", r.status === 404, `${r.status}`);

  // The real flow
  r = await call('POST', `${base}/days/2/adjust`, tok, { note: 'Less walking, add a\u0000 food market please' });
  if (r.status !== 202) { loud(); console.log("START", r.status, JSON.stringify(r.json)); }
  check('start → 202, pending day 2, 2 left', r.status === 202 && r.json.data.pending?.day === 2 && r.json.data.remaining === 2, JSON.stringify(r.json));
  const startInvoke = invokes.find(i => i.fn === 'wanderzenai-itinerary-gen-test');
  check('generator invoked with only ids (the note is read from the DB)', startInvoke && startInvoke.payload.mode === 'adjustDay' && !('note' in startInvoke.payload), JSON.stringify(startInvoke?.payload));
  r = await call('POST', `${base}/days/3/adjust`, tok, { note: 'more cafes please' });
  check('second change while one is running → 409 ADJUST_IN_PROGRESS', r.status === 409 && r.json.code === 'ADJUST_IN_PROGRESS', JSON.stringify(r.json));
  await runGen();
  const p = prompts.at(-1);
  check('prompt: only day 2, with the note fenced, the current day and places to avoid', /Create days 2 of 3/.test(p) && p.includes('<change_request>Less walking, add a food market please</change_request>') && p.includes('OLD market 2') && p.includes('OLD market 1') && p.includes('OLD cao lau 3'), p.slice(-600));
  check('prompt keeps the day on its route base (Hoi An)', /Hoi An/.test(p));
  let it = (await db.query('SELECT itinerary_data, claude_output_tokens FROM itineraries WHERE submission_id = $1', [id])).rows[0];
  const d = it.itinerary_data.days;
  check('day 2 replaced, days 1 and 3 untouched', d[1].theme === 'NEW 2' && d[0].theme === 'OLD 1' && d[2].theme === 'OLD 3', d.map(x => x.theme).join());
  check('new day keeps number + base, marked adjusted (time only, no note)', d[1].dayNumber === 2 && d[1].base === 'Hoi An' && d[1].adjusted?.at && !JSON.stringify(d[1]).includes('food market please'), JSON.stringify(d[1]).slice(0, 200));
  check('tokens added to the trip', Number(it.claude_output_tokens) === 2300, String(it.claude_output_tokens));
  const pdf = invokes.find(i => i.fn === 'wanderzenai-pdf-builder-test');
  check('PDF rebuild triggered in update mode', pdf && pdf.payload.update?.dayNumber === 2 && pdf.payload.isPaid === true, JSON.stringify(pdf?.payload).slice(0, 200));
  const status = (await db.query('SELECT status FROM submissions WHERE id = $1', [id])).rows[0].status;
  check('trip status untouched (email_sent)', status === 'email_sent', status);
  r = await call('GET', `${base}/adjustments`, tok);
  check('list: done, 2 left, nothing pending', r.json.data.used === 1 && r.json.data.remaining === 2 && !r.json.data.pending && r.json.data.last.status === 'done', JSON.stringify(r.json.data));
  await runGen();
  check('a repeated generator invoke does nothing (already done)', prompts.length === 1, `${prompts.length} prompts`);

  // A failed rewrite doesn't count and changes nothing
  claudeMode = 'junk';
  r = await call('POST', `${base}/days/3/adjust`, tok, { note: 'more cafes please' });
  await runGen();
  it = (await db.query('SELECT itinerary_data FROM itineraries WHERE submission_id = $1', [id])).rows[0];
  r = await call('GET', `${base}/adjustments`, tok);
  check('failed rewrite: day 3 unchanged, not counted (still 2 left)', it.itinerary_data.days[2].theme === 'OLD 3' && r.json.data.remaining === 2 && r.json.data.last.status === 'failed', JSON.stringify(r.json.data.last));
  claudeMode = 'ok';

  // Stuck pending (generator never ran) times out
  await db.query(`INSERT INTO day_adjustments (submission_id, day_number, note, status, created_at) VALUES ($1, 1, 'stuck', 'pending', NOW() - INTERVAL '20 minutes')`, [id]);
  r = await call('POST', `${base}/days/1/adjust`, tok, { note: 'slower morning' });
  check('a stuck change older than 15 min no longer blocks the trip', r.status === 202, `${r.status} ${JSON.stringify(r.json)}`);
  await runGen();
  r = await call('POST', `${base}/days/3/adjust`, tok, { note: 'quieter evening' });
  await runGen();
  r = await call('GET', `${base}/adjustments`, tok);
  check('three done → none left', r.json.data.remaining === 0 && r.json.data.used === 3, JSON.stringify(r.json.data));
  r = await call('POST', `${base}/days/1/adjust`, tok, { note: 'one more' });
  check('fourth → 409 ADJUST_LIMIT', r.status === 409 && r.json.code === 'ADJUST_LIMIT', JSON.stringify(r.json));

  // Not finished yet
  const id2 = `wz_adj${String(n).slice(-6)}_${'B'.repeat(16)}`;
  await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,plan,status) VALUES ($1,$2,'Peru',3,2000,'AUD','Couple','free','processing')`, [id2, email]);
  r = await call('POST', `/itinerary/${id2}/days/1/adjust`, tok, { note: 'less walking' });
  check('trip still being written → 409 NOT_READY', r.status === 409 && r.json.code === 'NOT_READY', JSON.stringify(r.json));

  // Two clicks at the same moment: exactly one starts
  const id3 = `wz_adj${String(n).slice(-6)}_${'C'.repeat(16)}`;
  await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,plan,status) VALUES ($1,$2,'Peru',3,2000,'AUD','Couple','free','email_sent')`, [id3, email]);
  await db.query('DELETE FROM rate_limits');
  const both = await Promise.all([1, 2, 3].map(dn => call('POST', `/itinerary/${id3}/days/${dn}/adjust`, tok, { note: 'quieter please' })));
  check('three simultaneous requests -> exactly one starts, the others 409', both.filter(x => x.status === 202).length === 1 && both.filter(x => x.status === 409).length === 2, both.map(x => x.status).join());

  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { loud(); console.error('ERR', e); process.exit(1); });
