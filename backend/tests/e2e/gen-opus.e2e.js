'use strict';
// Real itinerary-gen handler, Claude stubbed: 10-day trip on Opus defaults.
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', CLAUDE_API_KEY: 'sk-test', FOURSQUARE_API_KEY: '', AWS_REGION: 'ap-southeast-2' });
delete process.env.CLAUDE_MODEL_FAST; delete process.env.CLAUDE_MODEL_STRONG; delete process.env.CLAUDE_ITINERARY_EFFORT;
const REPO = require('path').resolve(__dirname, '../../..');
const bodies = []; let inFlight = 0, maxInFlight = 0;
const act = (v) => ({ time: '9', activity: 'x', location: 'Kyoto', venueName: v, why: '', cost: 0, isFree: true, insiderTip: '' });
const mkDay = (n) => ({ dayNumber: n, theme: `D${n}`, morningActivity: act(`Spot ${n}a`), afternoonActivity: act(`Spot ${n}b`), eveningActivity: act(null), hiddenGem: 'g', dailyCost: 10, localEats: { name: 'e', dish: 'd', cost: 5, venueName: null, vibe: 'v' } });
let truncatedOnce = false;
global.fetch = async (url, opts) => {
  if (!String(url).includes('anthropic')) return { ok: true, status: 200, json: async () => ({ results: [] }), text: async () => '{}' };
  const body = JSON.parse(opts.body); bodies.push(body);
  inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
  await new Promise(r => setTimeout(r, 150));
  inFlight--;
  const prompt = body.messages[0].content;
  let out, stop = 'end_turn';
  if (/overview section/.test(prompt)) out = { title: 't', summary: 's', accommodation: {}, practicalTips: [], totalEstimatedCost: 900, avoidList: [] };
  else {
    const nums = /Create days ([\d, ]+) of/.exec(prompt)[1].split(',').map(s => +s.trim());
    // Days 4-6: first answer cut off at max_tokens (thinking used the room) → must retry bigger.
    if (nums[0] === 4 && !truncatedOnce) { truncatedOnce = true; return resp('{"days":[{"dayNum', 'max_tokens'); }
    out = { days: nums.map(mkDay) };
  }
  return resp(JSON.stringify(out), stop);
};
const resp = (text, stop) => ({ ok: true, status: 200, headers: new Map(), json: async () => ({
  // Opus 5.5: thinking block first (empty at default display), then text
  content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'text', text }],
  usage: { input_tokens: 100, output_tokens: 200 }, stop_reason: stop }) });
const lambdaSdk = require('/opt/nodejs/node_modules/@aws-sdk/client-lambda');
lambdaSdk.LambdaClient.prototype.send = async () => ({});
const { getDB } = require('/opt/nodejs/index');
const gen = require(`${REPO}/backend/functions/itinerary-gen/index.js`);
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  — ' + d : ''}`);
(async () => {
  const db = getDB(); const id = 'wz_opus_' + Date.now();
  await db.query(`insert into submissions (id,email,destination,days,budget,currency,traveler_type,travel_style,plan,status,selected_venues)
    values ($1,'opus@example.com','Kyoto',10,3000,'AUD','Couple','["Nature"]','free','pending',$2)`, [id, JSON.stringify({ version: 2, interests: [], picks: [] })]);
  const ol = console.log, ow = console.warn; console.log = () => {}; console.warn = () => {};
  const t0 = Date.now(); await gen.handler({ submissionId: id, isPaid: false }); const ms = Date.now() - t0;
  console.log = ol; console.warn = ow;
  const row = (await db.query('select status from submissions where id=$1', [id])).rows[0];
  const it = (await db.query('select itinerary_data from itineraries where submission_id=$1', [id])).rows[0].itinerary_data;
  check('every call uses claude-opus-5-5', bodies.every(b => b.model === 'claude-opus-5-5'), [...new Set(bodies.map(b => b.model))].join());
  check('effort medium on first attempts', bodies.filter(b => b.output_config?.effort === 'medium').length >= 5);
  check('no temperature/top_p/top_k/thinking/prefill in any request', bodies.every(b => !('temperature' in b) && !('top_p' in b) && !('top_k' in b) && !('thinking' in b) && b.messages.at(-1).role === 'user'));
  const batchMax = bodies.find(b => /Create days 1, 2, 3 of/.test(b.messages[0].content)).max_tokens;
  check('3-day batch max_tokens leaves thinking room', batchMax === Math.round((1800 * 3 + 400) * 1.5) + 4000, String(batchMax));
  const retry = bodies.filter(b => /Create days 4, 5, 6 of/.test(b.messages[0].content));
  check('truncated batch retried with double the room', retry.length === 2 && retry[1].max_tokens > retry[0].max_tokens, retry.map(b => b.max_tokens).join(' → '));
  check('overview + batches run in parallel (≤ 5 in flight)', maxInFlight >= 3 && maxInFlight <= 5, `max in flight ${maxInFlight}, ${ms} ms`);
  check('10 days stored in order, none filler, status advanced', it.days.length === 10 && it.days.every((d, i) => d.dayNumber === i + 1 && !d.isFallback) && row.status !== 'failed', `status ${row.status}`);
  check('thinking block before text did not break parsing', it.days[0].morningActivity.venueName === 'Spot 1a');
  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  await db.end(); process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
