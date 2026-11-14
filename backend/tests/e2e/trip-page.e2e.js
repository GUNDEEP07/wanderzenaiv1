'use strict';
// Trip page ("On the road", Nov 2026): GET /itinerary?id= gives the owner their travel date
// and PDF flag (share-link viewers get neither), and GET /itinerary/{id}/pdf signs a fresh
// link for the owner only. Local Postgres; S3 signing runs for real with dummy credentials.
const crypto = require('crypto');
Object.assign(process.env, { DB_HOST: process.env.E2E_DB_HOST || '127.0.0.1', DB_NAME: process.env.E2E_DB_NAME || 'wz', DB_USER: process.env.E2E_DB_USER || 'postgres', DB_PASSWORD: process.env.E2E_DB_PASSWORD || '', STAGE: 'test', AWS_REGION: 'ap-southeast-2', FIREBASE_PROJECT_ID: 'wanderzenai-9c343', FRONTEND_URL: 'https://www.wanderzenai.com', PDF_BUCKET: 'wanderzenai-pdfs-test', AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE', AWS_SECRET_ACCESS_KEY: 'example-secret' });
const REPO = require('path').resolve(__dirname, '../../..');
const auth = require('/opt/nodejs/auth.js');
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
auth.__setCertsForTesting({ k: publicKey.export({ type: 'spki', format: 'pem' }) });
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sub, email) => { const t = Math.floor(Date.now() / 1000); const h = b64({ alg: 'RS256', kid: 'k' }), p = b64({ iss: 'https://securetoken.google.com/wanderzenai-9c343', aud: 'wanderzenai-9c343', sub, iat: t - 5, exp: t + 3600, email, email_verified: true }); return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`; };
const { getDB } = require('/opt/nodejs/index');
const form = require(`${REPO}/backend/functions/form-handler/index.js`);
const profile = require(`${REPO}/backend/functions/profile/handler.js`);
const out = []; const check = (n, c, d = '') => out.push(`${c ? 'PASS' : 'FAIL'}  ${n}${d && !c ? '  — ' + d : ''}`);
const ol = console.log, ow = console.warn, oe = console.error; const quiet = () => { console.log = console.warn = console.error = () => {}; }; const loud = () => { console.log = ol; console.warn = ow; console.error = oe; };
const run = async (handler, method, path, tok, extra = {}) => {
  quiet(); const res = await handler({ httpMethod: method, path, headers: tok ? { Authorization: `Bearer ${tok}` } : {}, requestContext: { identity: { sourceIp: '9.9.9.8' } }, ...extra }); loud();
  let json = {}; try { json = JSON.parse(res.body); } catch { /* empty */ } return { status: res.statusCode, json };
};

(async () => {
  const db = getDB();
  const n = Date.now(), email = `trip${n}@example.com`, tok = token('uT' + n, email), other = token('uX' + n, `x${n}@example.com`);
  const id = `wz_trp${String(n).slice(-6)}_${'B'.repeat(16)}`;
  const key = `itineraries/${email}/it_${n}.pdf`;
  await db.query(`INSERT INTO submissions (id,email,destination,days,budget,currency,traveler_type,travel_style,travel_date,plan,status) VALUES ($1,$2,'Việt Nam',6,3000,'AUD','Couple','["Nature"]','2026-11-16','paid','email_sent')`, [id, email]);
  await db.query(`INSERT INTO itineraries (id, submission_id, email, destination, itinerary_data, currency, pdf_s3_key, pdf_generated_at) VALUES ($1,$2,$3,'Việt Nam',$4,'AUD',$5,NOW())`, [`it_${n}`, id, email, JSON.stringify({ title: 'T', days: [{ dayNumber: 1, theme: 'x' }] }), key]);

  // Public trip data
  let r = await run(profile.handler, 'GET', '/itinerary', tok, { queryStringParameters: { id } });
  check('owner: travel date (calendar day, not shifted), currency, PDF flag', r.status === 200 && r.json.isOwner === true && r.json.travelDate === '2026-11-16' && r.json.currency === 'AUD' && r.json.hasPdf === true, JSON.stringify({ ...r.json, itinerary: undefined }));
  r = await run(profile.handler, 'GET', '/itinerary', null, { queryStringParameters: { id } });
  check('share link (signed out): the plan, but no travel date or PDF', r.status === 200 && r.json.isOwner === false && r.json.travelDate === null && r.json.hasPdf === false && r.json.itinerary?.days?.length === 1, JSON.stringify({ ...r.json, itinerary: undefined }));
  r = await run(profile.handler, 'GET', '/itinerary', other, { queryStringParameters: { id } });
  check('someone else signed in: no travel date', r.status === 200 && r.json.isOwner === false && r.json.travelDate === null, JSON.stringify({ ...r.json, itinerary: undefined }));
  r = await run(profile.handler, 'GET', '/itinerary', 'garbage.token.here', { queryStringParameters: { id } });
  check('a bad token still sees the public plan', r.status === 200 && r.json.isOwner === false, `${r.status}`);

  // Fresh PDF link
  const path = `/itinerary/${id}/pdf`;
  r = await run(form.handler, 'GET', path, tok, { pathParameters: { id } });
  const url = r.json?.data?.url ? new URL(r.json.data.url) : null;
  check('owner gets a signed link to their PDF', r.status === 200 && url && decodeURIComponent(url.pathname).endsWith(`/${key}`) && url.searchParams.get('X-Amz-Expires') === '900', JSON.stringify(r.json));
  check('…which downloads with a clean file name', r.json?.data?.fileName === 'WanderZen-Viet-Nam-6-days.pdf' && /attachment/.test(url?.searchParams.get('response-content-disposition') || ''), r.json?.data?.fileName);
  r = await run(form.handler, 'GET', path, other, { pathParameters: { id } });
  check("someone else's trip → 404, no link", r.status === 404 && !r.json?.data, `${r.status}`);
  r = await run(form.handler, 'GET', path, null, { pathParameters: { id } });
  check('signed out → 401', r.status === 401, `${r.status}`);
  r = await run(form.handler, 'GET', '/itinerary/not-an-id/pdf', tok, { pathParameters: { id: 'not-an-id' } });
  check('malformed id → 404', r.status === 404, `${r.status}`);

  // Dashboard list says which trips have a PDF (no broken pre-signed links any more)
  r = await run(profile.handler, 'GET', '/profile', tok);
  const t = (r.json.pastTrips || []).find(x => x.id === id);
  check('dashboard: hasPdf flag, no pdfUrl', r.status === 200 && t?.hasPdf === true && !('pdfUrl' in t), JSON.stringify(t));

  await db.query('DELETE FROM itineraries WHERE submission_id = $1', [id]);
  await db.query('DELETE FROM submissions WHERE id = $1', [id]);
  console.log(out.join('\n')); console.log(`\n${out.filter(x => x.startsWith('PASS')).length}/${out.length} passed`);
  process.exit(out.some(x => x.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { loud(); console.error(e); process.exit(1); });
