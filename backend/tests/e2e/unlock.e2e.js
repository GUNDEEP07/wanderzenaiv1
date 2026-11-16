'use strict';
// Free trips show Day 1; unlocking opens the rest (Nov 16 2026). Real handlers (profile GET
// /itinerary, form-handler progress/adjust/unlock) on local Postgres; Lambda invokes recorded.
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', CLAUDE_API_KEY: 'sk-test', AWS_REGION: 'ap-southeast-2', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', FRONTEND_URL: 'https://www.wanderzenai.com' });
const REPO = require('path').resolve(__dirname, '../../..');
const invokes = [];
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda');
lambdaSdk.LambdaClient.prototype.send = async (cmd) => { invokes.push({ fn: cmd.input.FunctionName, payload: JSON.parse(Buffer.from(cmd.input.Payload).toString()) }); return {}; };
const auth = require('/opt/nodejs/auth.js');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now() / 1000); const h = b64({ alg: 'RS256', kid: 'k' }), p = b64({ iss: 'https://securetoken.google.com/wanderzenai-9c343', aud: 'wanderzenai-9c343', sub, iat: t - 5, exp: t + 3600, email, email_verified: true }); return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`; };
const { getDB } = require('/opt/nodejs/index');
const { lockItinerary } = require('/opt/nodejs/trip-access');
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const profile = require(`${REPO}/backend/functions/profile/handler.js`);
const { buildHTML } = require(`${REPO}/backend/functions/pdf-builder/index.js`)._internal;
const { buildEmailHTML } = require(`${REPO}/backend/functions/email-sender/index.js`)._internal;
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d && !c ? '  — ' + d : ''}`);
const ol = console.log, ow = console.warn, oe = console.error; const quiet = () => { console.log = console.warn = console.error = () => {}; }; const loud = () => { console.log = ol; console.warn = ow; console.error = oe; };
const req = (method, path, tok, extra = {}) => ({ httpMethod: method, path, headers: tok ? { Authorization: `Bearer ${tok}` } : {}, body: null, requestContext: { identity: { sourceIp: '9.9.9.8' } }, ...extra });
const parse = (res) => { let json = {}; try { json = JSON.parse(res.body); } catch { /* empty */ } return { status: res.statusCode, json }; };
const call = async (method, path, tok, body) => { quiet(); const res = await form.handler(req(method, path, tok, body ? { body: JSON.stringify(body) } : {})); loud(); return parse(res); };
const view = async (id, tok) => { quiet(); const res = await profile.handler(req('GET', '/itinerary', tok, { queryStringParameters: { id } })); loud(); return parse(res); };

const act = (v) => ({ time: '9:00', activity: `Walk to ${v}`, location: 'Hoi An', venueName: v, why: 'secret why', cost: 5, isFree: false, insiderTip: 'secret tip' });
const day = (n) => ({ dayNumber: n, theme: `Theme ${n}`, base: n === 1 ? 'Hanoi' : 'Hoi An', morningActivity: act(`SECRET-MORNING-${n}`), afternoonActivity: act(`SECRET-AFTERNOON-${n}`), eveningActivity: act(`SECRET-EVENING-${n}`), hiddenGem: `SECRET-GEM-${n}`, dailyCost: 40, localEats: { name: `SECRET-EATS-${n}`, dish: 'pho', cost: 5, venueName: null, vibe: 'v' } });
const ITIN = { title: 'Slow Vietnam', summary: 'A slow week', totalEstimatedCost: 2000, days: [day(1), day(2), day(3)], practicalTips: ['SECRET-TIP-A', 'SECRET-TIP-B'], avoidList: ['SECRET-TRAP'], stays: [{ base: 'Hoi An', type: 'homestay', why: 'SECRET-STAY' }], route: { bases: [{ name: 'Hanoi', days: 1 }, { name: 'Hoi An', days: 2 }] } };

(async () => {
  const db = getDB();
  await db.query('DELETE FROM rate_limits').catch(() => {});
  const n = Date.now(), email = `unl${n}@example.com`, tok = token('uU' + n, email), other = token('uX' + n, `x${n}@example.com`);
  const mk = async (tag, plan, status = 'email_sent') => {
    const id = `wz_unl${String(n).slice(-6)}_${tag.repeat(16)}`;
    await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,plan,status,progress) VALUES ($1,$2,'Vietnam',3,2000,'AUD','Couple',$3,$4,$5)`,
      [id, email, plan, status, JSON.stringify({ stage: 'writing', totalDays: 3, days: [1, 2, 3].map((d) => ({ day: d, theme: `Theme ${d}`, base: 'Hoi An', stops: [`SECRET-STOP-${d}`], eat: 'x' })) })]);
    await db.query(`INSERT INTO itineraries (id, submission_id, email, destination, itinerary_data, currency) VALUES ($1,$2,$3,'Vietnam',$4,'AUD')`, [`it_${tag}${n}`, id, email, JSON.stringify(ITIN)]);
    return id;
  };
  await db.query(`INSERT INTO users (email, plan, itineraries_remaining) VALUES ($1, 'free', 0)`, [email]);
  const free = await mk('F', 'free');
  const paid = await mk('P', 'paid');
  const old = await mk('O', 'free');
  await db.query(`UPDATE submissions SET created_at = '2026-11-10T00:00:00Z', unlocked_at = NULL WHERE id = $1`, [old]);

  // ── What leaves the system for a locked trip ────────────────────────────
  let r = await view(free);
  const body = JSON.stringify(r.json);
  check('free trip: GET /itinerary → 200, locked', r.status === 200 && r.json.locked === true, JSON.stringify(r.json).slice(0, 200));
  check('free trip: Day 1 in full', r.json.itinerary?.days?.[0]?.morningActivity?.venueName === 'SECRET-MORNING-1');
  check('free trip: days 2–3 are teasers only (number, theme, base)', r.json.itinerary?.days?.length === 3 && r.json.itinerary.days.slice(1).every((d) => d.locked && d.theme && !d.morningActivity && !d.localEats), JSON.stringify(r.json.itinerary?.days?.slice(1)));
  check('free trip: no later-day, stay, tip or trap text anywhere in the response', !/SECRET-(MORNING|AFTERNOON|EVENING|GEM|EATS)-[23]|SECRET-TIP|SECRET-TRAP|SECRET-STAY/.test(body), body.match(/SECRET-[A-Z]+-?[0-9A-Z]*/g)?.join(','));
  check('free trip: counts of what unlocking adds', r.json.itinerary?.locked?.tips === 2 && r.json.itinerary.locked.avoid === 1 && r.json.itinerary.locked.stays === 1, JSON.stringify(r.json.itinerary?.locked));
  r = await view(free, tok);
  check('the owner sees the same locked trip', r.json.isOwner === true && r.json.locked === true && !JSON.stringify(r.json).includes('SECRET-EVENING-2'));
  r = await view(old);
  check('free trip made before the lock (Nov 16) stays fully open', r.json.locked === false && JSON.stringify(r.json).includes('SECRET-EVENING-3'), JSON.stringify(r.json).slice(0, 160));
  r = await view(paid);
  check('paid trip: everything, not locked', r.json.locked === false && JSON.stringify(r.json).includes('SECRET-TIP-A') && r.json.itinerary.days[2].eveningActivity.venueName === 'SECRET-EVENING-3');

  r = await call('GET', `/itinerary/${free}/progress`, tok);
  check('live progress: Day 1 stops, later days locked teasers', r.status === 200 && r.json.data.locked === true && r.json.data.days[0].stops?.[0] === 'SECRET-STOP-1' && r.json.data.days.slice(1).every((d) => d.locked && !d.stops), JSON.stringify(r.json.data?.days));
  r = await call('POST', `/itinerary/${free}/days/1/adjust`, tok, { note: 'less walking please' });
  check('adjust a locked trip → 402 TRIP_LOCKED', r.status === 402 && r.json.code === 'TRIP_LOCKED', JSON.stringify(r.json));

  // ── Unlock ──────────────────────────────────────────────────────────────
  r = await call('POST', `/itinerary/${free}/unlock`);
  check('unlock signed out → 401', r.status === 401, `${r.status}`);
  r = await call('POST', `/itinerary/${free}/unlock`, other);
  check("unlock someone else's trip → 404", r.status === 404, `${r.status}`);
  r = await call('POST', '/itinerary/not-an-id/unlock', tok);
  check('malformed id → 404', r.status === 404, `${r.status}`);
  r = await call('POST', `/itinerary/${free}/unlock`, tok);
  check('no itinerary to spend → 402 NEEDS_ITINERARY, still locked', r.status === 402 && r.json.code === 'NEEDS_ITINERARY' && (await view(free)).json.locked === true, JSON.stringify(r.json));

  await db.query('UPDATE users SET itineraries_remaining = 1 WHERE email = $1', [email]);
  invokes.length = 0;
  const both = await Promise.all([call('POST', `/itinerary/${free}/unlock`, tok), call('POST', `/itinerary/${free}/unlock`, tok)]);
  const credits = (await db.query('SELECT itineraries_remaining FROM users WHERE email = $1', [email])).rows[0].itineraries_remaining;
  check('two clicks at once: both 200, exactly one credit spent', both.every((x) => x.status === 200) && credits === 0, `${both.map((x) => x.status)} credits=${credits}`);
  check('unlock spent a purchased credit', both.some((x) => x.json.data?.source === 'credit'), JSON.stringify(both.map((x) => x.json.data)));
  const rebuilds = invokes.filter((i) => i.fn.includes('pdf-builder'));
  check('full PDF rebuilt once (update: unlocked)', rebuilds.length === 1 && rebuilds[0].payload.update?.unlocked === true && rebuilds[0].payload.submissionId === free, JSON.stringify(invokes));
  r = await view(free);
  check('after unlocking: every day, tips and stays', r.json.locked === false && r.json.itinerary.days[2].eveningActivity?.venueName === 'SECRET-EVENING-3' && r.json.itinerary.practicalTips?.length === 2);
  const freeCount = (await db.query(`SELECT COUNT(*)::int AS c FROM submissions WHERE email = $1 AND plan = 'free' AND id <> $2`, [email, old])).rows[0].c;
  check('an unlocked trip still counts as the free trip of the month', freeCount === 1, `${freeCount}`);

  // Wanderer allowance is spent before purchased credits; a failed trip can't be unlocked.
  const sub = `sub${n}@example.com`, subTok = token('uS' + n, sub);
  await db.query(`INSERT INTO users (email, plan, itineraries_remaining, monthly_remaining) VALUES ($1, 'subscriber', 3, 2)`, [sub]);
  const id2 = `wz_unl${String(n).slice(-6)}_${'S'.repeat(16)}`;
  await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,plan,status) VALUES ($1,$2,'Japan',3,2000,'AUD','Couple','free','processing')`, [id2, sub]);
  invokes.length = 0;
  r = await call('POST', `/itinerary/${id2}/unlock`, subTok);
  const u = (await db.query('SELECT monthly_remaining, itineraries_remaining FROM users WHERE email = $1', [sub])).rows[0];
  check('subscriber: monthly allowance spent first', r.status === 200 && r.json.data.source === 'monthly' && u.monthly_remaining === 1 && u.itineraries_remaining === 3, JSON.stringify({ r: r.json, u }));
  check('trip still being written: no PDF rebuild now (its own build picks up the unlock)', invokes.length === 0, JSON.stringify(invokes));
  const id3 = `wz_unl${String(n).slice(-6)}_${'X'.repeat(16)}`;
  await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,plan,status) VALUES ($1,$2,'Peru',3,2000,'AUD','Couple','free','failed')`, [id3, sub]);
  r = await call('POST', `/itinerary/${id3}/unlock`, subTok);
  const u2 = (await db.query('SELECT monthly_remaining FROM users WHERE email = $1', [sub])).rows[0];
  check('failed trip → 409 TRIP_FAILED, nothing spent', r.status === 409 && r.json.code === 'TRIP_FAILED' && u2.monthly_remaining === 1, JSON.stringify(r.json));

  // ── PDF and email for a locked trip ─────────────────────────────────────
  const html = buildHTML(lockItinerary(ITIN), { destination: 'Vietnam', days: 3, budget: 2000 }, '$', null, { unlockUrl: 'https://www.wanderzenai.com/itinerary/x?unlock=1' });
  check('locked PDF: Day 1 printed, later days only as a list', html.includes('SECRET-MORNING-1') && !/SECRET-(MORNING|EVENING|GEM|EATS)-[23]|SECRET-TIP|SECRET-TRAP|SECRET-STAY/.test(html) && html.includes('The rest of your trip is ready') && html.includes('Theme 3') && html.includes('?unlock=1'));
  const fullHtml = buildHTML(ITIN, { destination: 'Vietnam', days: 3, budget: 2000 }, '$');
  check('unlocked PDF: every day, no unlock page', fullHtml.includes('SECRET-EVENING-3') && fullHtml.includes('SECRET-TIP-A') && !fullHtml.includes('The rest of your trip is ready'));
  const mail = buildEmailHTML({ itineraryTitle: 'T', destination: 'Vietnam', days: 3, downloadUrl: 'https://x', tripUrl: 'https://t', isPaid: false, locked: true, unlockUrl: 'https://www.wanderzenai.com/itinerary/x?unlock=1' });
  check('locked email: "Day 1 is ready" with an unlock button', mail.includes('Day 1 of your trip is ready') && mail.includes('Unlock the full trip') && mail.includes('?unlock=1'));
  const unlockedMail = buildEmailHTML({ itineraryTitle: 'T', destination: 'Vietnam', days: 3, downloadUrl: 'https://x', tripUrl: 'https://t', isPaid: false, update: { unlocked: true } });
  check('unlocked email: "Your full trip is unlocked", no upsell', unlockedMail.includes('Your full trip is unlocked') && !unlockedMail.includes('See plans'));

  console.log(out.join('\n')); console.log(`\n${out.filter((x) => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some((x) => x.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { loud(); console.error('ERR', e); process.exit(1); });
