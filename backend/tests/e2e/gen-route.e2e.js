'use strict';
// Route first, end to end: /route-plan handler + generator with a confirmed route (Claude stubbed).
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', CLAUDE_API_KEY: 'sk-test', FOURSQUARE_API_KEY: '', AWS_REGION: 'ap-southeast-2', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', FRONTEND_URL: 'https://www.wanderzenai.com' });
const REPO = require('path').resolve(__dirname, '../../..');
const prompts = []; let routeReply;
global.fetch = async (url, opts) => {
  if (!String(url).includes('anthropic')) return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => '{}' };
  const body = JSON.parse(opts.body); const prompt = body.messages[0].content; prompts.push({ model: body.model, prompt, effort: body.output_config?.effort });
  let text;
  if (/Suggest ONE ROUTE/.test(prompt)) text = (global.failQuiet && /quieter/.test(prompt)) ? 'I cannot help' : routeReply;
  else if (/overview section/.test(prompt)) text = JSON.stringify({ title: 'Japan slowly', summary: 's', accommodation: { recommendation: 'r' }, stays: [{ base: 'Takayama', type: 'ryokan', priceTier: 'mid', why: 'onsen' }], practicalTips: [], totalEstimatedCost: 3000, avoidList: [] });
  else { const nums = /Create days ([\d, ]+) of/.exec(prompt)[1].split(',').map(s => +s.trim());
    text = JSON.stringify({ days: nums.map(n => ({ dayNumber: n, theme: `D${n}`, morningActivity: { venueName: n === 6 ? 'Hida Folk Village' : `Spot ${n}` }, afternoonActivity: { venueName: n === 9 ? 'Omicho Market' : null }, eveningActivity: {}, hiddenGem: 'g', dailyCost: 1, localEats: {} })) }); }
  return { ok: true, status: 200, headers: new Map(), json: async () => ({ content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'end_turn' }) };
};
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda'); lambdaSdk.LambdaClient.prototype.send = async () => ({});
const auth = require('/opt/nodejs/auth.js');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now()/1000); const h=b64({alg:'RS256',kid:'k'}), p=b64({iss:'https://securetoken.google.com/wanderzenai-9c343',aud:'wanderzenai-9c343',sub,iat:t-5,exp:t+3600,email,email_verified:true}); return `${h}.${p}.${crypto.sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url')}`; };
const { getDB } = require('/opt/nodejs/index');
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const gen = require(`${REPO}/backend/functions/itinerary-gen/index.js`);
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
const route = { bases: [
  { name: 'Kyoto', region: 'Kyoto', country: 'Japan', lat: 35.01, lng: 135.77, days: 4, stayType: 'machiya guesthouse', dayTrips: [{ name: 'Kurama' }] },
  { name: 'Takayama', region: 'Gifu', country: 'Japan', lat: 36.14, lng: 137.25, days: 3, transferIn: { mode: 'train', hours: 3.5 } },
  { name: 'Kanazawa', region: 'Ishikawa', country: 'Japan', lat: 36.56, lng: 136.66, days: 3, transferIn: { mode: 'bus', hours: 2 } },
] };
(async () => {
  const db = getDB(); await db.query('DELETE FROM rate_limits').catch(() => {}); await db.query('DROP TABLE IF EXISTS route_plan_cache');
  const ol = console.log, ow = console.warn; const quiet = () => { console.log = console.warn = () => {}; }; const loud = () => { console.log = ol; console.warn = ow; };

  // 1. /route-plan (option B)
  const n = Date.now();
  const plan = async (b) => { quiet(); const res = await form.handler({ httpMethod: 'POST', path: '/route-plan', headers: { Authorization: `Bearer ${token('uidR' + n, `r${n}@example.com`)}` }, body: JSON.stringify(b), requestContext: { identity: { sourceIp: '9.9.9.9' } } }); loud(); return { status: res.statusCode, body: JSON.parse(res.body) }; };
  const isRoutePrompt = (p) => /Suggest ONE ROUTE/.test(p.prompt);
  const sumOf = (o) => o.bases.reduce((a, b) => a + b.days, 0);

  // 1a. Curated country → hand-made routes, no Claude call
  let r = await plan({ destination: 'Vietnam', days: 10, travelStyle: ['Nature'], travelPace: 'relaxed' });
  check('Vietnam → 200 curated options, each 10 days, no Claude call; route = first option for old tabs', r.status === 200 && r.body.data.route?.id === r.body.data.options[0].id && r.body.data.source === 'curated' && r.body.data.options.length >= 2 && r.body.data.options.every(o => sumOf(o) === 10 && o.source === 'curated') && !prompts.some(isRoutePrompt), `${r.status} ${r.body.data?.source} ${r.body.data?.options?.map(o => o.id)}`);

  // 1b. Uncurated country → Claude, 3 options, balanced to the day total
  routeReply = 'Sure!\n' + JSON.stringify({ options: [
    { name: 'Andes slow', summary: 'Valleys', bases: [{ name: 'Cusco', days: 4, lat: -13.5, lng: -72 }, { name: 'Ollantaytambo', days: 4, lat: -13.26, lng: -72.26, transferIn: { mode: 'car', hours: 1.5 } }, { name: 'Arequipa', days: 4, lat: -16.4, lng: -71.5, transferIn: { mode: 'flight', hours: 3 } }] },
    { name: 'Coast', summary: 'Sea', bases: [{ name: 'Paracas', days: 5 }, { name: 'Huacachina', days: 5, transferIn: { mode: 'car', hours: 1.5 } }] },
  ] });
  r = await plan({ destination: 'Peru', days: 10, prefs: { adults: 2, kids: [5], transferComfort: 'short' } });
  const rp = prompts.find(isRoutePrompt);
  check('Peru → Claude options balanced to 10 days', r.status === 200 && r.body.data.source === 'ai' && r.body.data.options.length === 2 && r.body.data.options.every(o => sumOf(o) === 10), JSON.stringify(r.body.data?.options?.map(sumOf)));
  const rps = prompts.filter(isRoutePrompt);
  check('route prompts: 3 parallel one-route calls (classic, quiet, region), fast model, low effort, kids + travel limit', rps.length === 3 && rps.every(p => p.model === 'claude-haiku-5-5' && p.effort === 'low' && /child/i.test(p.prompt) && /2\.5/.test(p.prompt)) && /first-timer/.test(rps.map(p => p.prompt).join()) && /quieter/.test(rps.map(p => p.prompt).join()) && /region most visitors skip/.test(rps.map(p => p.prompt).join()), String(rps.length));

  // 1c. "Show other ideas" for a curated country → Claude, avoiding what was shown
  prompts.length = 0;
  r = await plan({ destination: 'Vietnam', days: 10, more: true, avoid: ['North loop'] });
  const rp2 = prompts.find(isRoutePrompt);
  check('more:true skips curated, 3 new angles (no classic), avoiding the routes already shown', r.status === 200 && r.body.data.source === 'ai' && rp2 && prompts.filter(isRoutePrompt).length === 3 && !prompts.some(p => /first-timer/.test(p.prompt)) && /they already saw: North loop/.test(rp2.prompt));

  quiet(); const r401 = await form.handler({ httpMethod: 'POST', path: '/route-plan', headers: {}, body: '{}' }); loud();
  check('/route-plan without a token: open to guests (Nov 8) but still validated → 400', r401.statusCode === 400, String(r401.statusCode));
  // one angle fails → the others still come back
  global.failQuiet = true;
  r = await plan({ destination: 'Ecuador', days: 10 }); // not cached: the Peru answer above is
  global.failQuiet = false;
  check('one of the parallel calls fails → 200 with the routes that came back', r.status === 200 && r.body.data.options.length >= 1, `${r.status} ${r.body.data?.options?.length}`);
  routeReply = 'I cannot help';
  r = await plan({ destination: 'Bolivia', days: 10 });
  check('unusable answer for an uncurated country → 500 with a friendly message', r.status === 500 && /Could not plan a route/.test(JSON.stringify(r.body)));
  r = await plan({ destination: 'Vietnam', days: 10, more: true });
  check('unusable answer on "more" → 500 (not the same curated routes again)', r.status === 500);

  // 2. Generator with the confirmed route
  prompts.length = 0;
  const id = 'wz_' + n.toString(36) + '_' + crypto.randomBytes(12).toString('base64url'); // real id format (progress route checks it)
  await db.query(`insert into submissions (id,email,destination,days,budget,currency,traveler_type,travel_style,plan,status,selected_venues)
    values ($1,'route@example.com','Japan',10,3000,'AUD','Couple','["Nature"]','free','pending',$2)`,
    [id, JSON.stringify({ version: 2, interests: [], route, tripPrefs: { adults: 2, kids: [4, 8], transferComfort: 'short' }, picks: [{ name: 'Hida Folk Village', destination: 'Takayama, Japan' }, { name: 'Omicho Market', destination: 'Kanazawa, Japan' }] })]);
  quiet(); await gen.handler({ submissionId: id, isPaid: false }, { getRemainingTimeInMillis: () => 900000 }); loud();
  const meta = prompts.find(p => /overview section/.test(p.prompt)).prompt;
  check('overview prompt lists the route with day ranges and asks for stays per base', /Days 1–4: Kyoto, Kyoto, Japan \(stay: machiya guesthouse\)/.test(meta) && /Days 5–7: Takayama, Gifu, Japan — arrive by train/.test(meta) && /"stays"/.test(meta));
  check('overview and batch prompts carry WHO IS TRAVELLING with the kids', /WHO IS TRAVELLING/.test(meta) && /4/.test(meta.split('WHO IS TRAVELLING')[1].slice(0, 300)) && prompts.filter(p => /Create days/.test(p.prompt)).every(p => /WHO IS TRAVELLING/.test(p.prompt)));
  const b2 = prompts.find(p => /Create days 4, 5, 6 of/.test(p.prompt)).prompt;
  check('batch 4–6 knows Day 4 is in Kyoto and Day 5 is the travel day to Takayama', /Day 4: based in Kyoto/.test(b2) && /Day 5: TRAVEL DAY Kyoto → Takayama by train \(~3.5 h\)/.test(b2) && /Day 6: based in Takayama/.test(b2));
  const b3 = prompts.find(p => /Create days 7, 8, 9 of/.test(p.prompt)).prompt;
  check('unpinned picks placed on their base\'s days (Hida → Takayama day 6, Omicho → Kanazawa day 9/10)', /Day 6: Hida Folk Village/.test(b2) && /Day (9|10): Omicho Market/.test(b3 + prompts.find(p => /Create days 10 of/.test(p.prompt)).prompt));
  const row = (await db.query('select itinerary_data from itineraries where submission_id=$1', [id])).rows[0].itinerary_data;
  check('itinerary stores the route, stays, and tags each day with its base', row.route?.bases.length === 3 && row.stays?.[0]?.base === 'Takayama' && row.days[4].base === 'Takayama' && row.days[4].travelDay === true && row.days[0].travelDay === false);
  check('pick coverage clean', row.pickCoverage?.missing.length === 0 && row.pickCoverage?.wrongDay.length === 0, JSON.stringify(row.pickCoverage));

  // 3. Live progress (Nov 7): written by the generator, read by the owner only
  const prog = (await db.query('select progress from submissions where id=$1', [id])).rows[0].progress;
  check('generator recorded progress: route, all 10 days in order, last stage', prog?.route?.length === 3 && prog.route[0].name === 'Kyoto' && prog.days.length === 10 && prog.stage === 'finishing' && prog.days.find(d => d.day === 5)?.travelDay === true && prog.days.find(d => d.day === 6)?.base === 'Takayama', JSON.stringify({ stage: prog?.stage, days: prog?.days?.length }));
  const getProg = async (pathId, tok) => { quiet(); const res = await form.handler({ httpMethod: 'GET', path: `/itinerary/${pathId}/progress`, pathParameters: { id: pathId }, headers: tok ? { Authorization: `Bearer ${tok}` } : {}, requestContext: { identity: { sourceIp: '9.9.9.9' } } }); loud(); return { status: res.statusCode, body: JSON.parse(res.body) }; };
  let g = await getProg(id, token('uidOwner' + n, 'Route@Example.com'));
  check('GET progress as the owner → 200 with route + 10 sorted days', g.status === 200 && g.body.data.days.map(d => d.day).join() === '1,2,3,4,5,6,7,8,9,10' && g.body.data.route.length === 3 && g.body.data.status === 'itinerary_ready', `${g.status}`);
  g = await getProg(id, token('uidOther' + n, 'someone@example.com'));
  check('GET progress as another user → 404 (no leak)', g.status === 404 && !JSON.stringify(g.body).includes('Kyoto'));
  g = await getProg(id, null);
  check('GET progress without a token → 401', g.status === 401);
  g = await getProg('wz_bad', token('uidOwner' + n, 'route@example.com'));
  check('GET progress with a malformed id → 404, no DB query needed', g.status === 404);

  // 4. Preview outline follows the route day by day (Nov 7: "Hoi An farewell" on the Hue travel day)
  prompts.length = 0;
  quiet(); await form.handler({ httpMethod: 'POST', path: '/preview', headers: { Authorization: `Bearer ${token('uidPrev' + n, `prev${n}@example.com`)}` }, body: JSON.stringify({ destination: 'Vietnam', days: 6, route: { bases: [{ name: 'Da Nang', days: 1 }, { name: 'Hoi An', days: 3 }, { name: 'Hue', days: 2 }] } }), requestContext: { identity: { sourceIp: '9.9.9.10' } } }); loud();
  const pp = prompts.find(p => /day outline/.test(p.prompt))?.prompt || '';
  check('preview prompt lists each day\'s base, with travel days', /Day 1: Da Nang/.test(pp) && /Day 2: travel Da Nang → Hoi An/.test(pp) && /Day 4: Hoi An/.test(pp) && /Day 5: travel Hoi An → Hue/.test(pp), pp.slice(0, 300));

  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(1); });
