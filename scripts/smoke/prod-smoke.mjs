// Post-deployment smoke tests against the live API.
//
// Read-only by design: every check either hits a public GET or is expected to be REJECTED
// before any handler logic runs (no token / forged token), so nothing is written to the
// database, no email is sent and no Claude tokens are spent.
//
// Usage: API_URL=https://<id>.execute-api.<region>.amazonaws.com/prod node scripts/smoke/prod-smoke.mjs
// Exit code 1 if any check fails.

const API_URL = (process.env.API_URL || '').replace(/\/$/, '');
const FRONTEND_URL = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
if (!API_URL) {
  console.error('API_URL is required');
  process.exit(2);
}

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
// The exact forgery the old decode-only handlers accepted.
const FORGED = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ email: 'smoke-victim@example.com', email_verified: true })}.`;

const results = [];

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Origin: FRONTEND_URL || 'https://www.wanderzenai.com',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, json, text };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ ok: true, name, detail });
  } catch (err) {
    results.push({ ok: false, name, detail: err.message });
  }
}

function expectStatus(r, expected, code) {
  const okStatus = Array.isArray(expected) ? expected.includes(r.status) : r.status === expected;
  if (!okStatus) throw new Error(`expected ${expected}, got ${r.status}: ${r.text.slice(0, 160)}`);
  if (code && r.json?.code !== code) throw new Error(`expected code ${code}, got ${r.json?.code} (${r.text.slice(0, 160)})`);
  return `${r.status}${r.json?.code ? ' ' + r.json.code : ''}`;
}

const submitBody = {
  destination: 'Kyoto', days: 3, budget: 1000, currency: 'AUD', travelerType: 'Solo',
  email: 'tester@example.com', // must be ignored — identity only comes from a verified token
};

// ── Identity: forged / missing tokens are rejected everywhere ─────────────────
await check('GET /profile without token → 401 AUTH_REQUIRED',
  async () => expectStatus(await call('GET', '/profile'), 401, 'AUTH_REQUIRED'));
await check('GET /profile with forged token → 401 TOKEN_INVALID',
  async () => expectStatus(await call('GET', '/profile', { token: FORGED }), 401, 'TOKEN_INVALID'));
await check('PUT /profile with forged token → 401',
  async () => expectStatus(await call('PUT', '/profile', { token: FORGED, body: { name: 'x' } }), 401));
await check('POST /customer-portal with forged token → 401',
  async () => expectStatus(await call('POST', '/customer-portal', { token: FORGED, body: {} }), 401));
await check('GET /itinerary without id (public share endpoint) → 400, no data',
  async () => expectStatus(await call('GET', '/itinerary', { token: FORGED }), 400));
await check('POST /submit without token (body email) → 401',
  async () => expectStatus(await call('POST', '/submit', { body: submitBody }), 401, 'AUTH_REQUIRED'));
await check('POST /submit with forged token → 401',
  async () => expectStatus(await call('POST', '/submit', { token: FORGED, body: submitBody }), 401, 'TOKEN_INVALID'));
await check('POST /route-plan without token → 401 (routed, sign-in required)',
  async () => expectStatus(await call('POST', '/route-plan', { body: { destination: 'Japan', days: 7 } }), 401, 'AUTH_REQUIRED'));
await check('POST /preview without token → 401',
  async () => expectStatus(await call('POST', '/preview', { body: { destination: 'Kyoto', days: 3 } }), 401));
await check('POST /recommendations/chat with forged token → 401',
  async () => expectStatus(await call('POST', '/recommendations/chat', { token: FORGED, body: { message: 'hi' } }), 401));
await check('GET /recommendations/personalised with forged token → 401',
  async () => expectStatus(await call('GET', '/recommendations/personalised', { token: FORGED }), 401));
await check('POST /welcome-email with forged token → 401 (no longer an open relay)',
  async () => expectStatus(await call('POST', '/welcome-email', { token: FORGED, body: { email: 'smoke-victim@example.com' } }), 401));
await check('GET /admin/stats with forged token → 403',
  async () => expectStatus(await call('GET', '/admin/stats', { token: FORGED }), 403));
await check('POST /blog without token → 401',
  async () => expectStatus(await call('POST', '/blog', { body: { title: 'x' } }), 401));
await check('POST /blog/{id}/approve routed (401, not API Gateway 403/404)',
  async () => expectStatus(await call('POST', '/blog/00000000-0000-0000-0000-000000000000/approve', { body: {} }), 401));

// ── Public endpoints still work ───────────────────────────────────────────────
await check('GET /blog (public) → 200',
  async () => expectStatus(await call('GET', '/blog'), 200));
await check('GET /recommendations/public/stats (public) → 200',
  async () => expectStatus(await call('GET', '/recommendations/public/stats'), 200));
await check('GET /recommendations/categories (public) → 200',
  async () => expectStatus(await call('GET', '/recommendations/categories'), 200));
await check('GET /itinerary/{unknown id} status (public) → 404',
  async () => expectStatus(await call('GET', '/itinerary/wz_smoke_doesnotexist'), 404));

// ── Photos (Unsplash via backend proxy) and destination insights ──────────────
await check('GET /photos/search → 200 with a credited photo (or null without a key)',
  async () => {
    const r = await call('GET', '/photos/search?query=kyoto');
    expectStatus(r, 200);
    if (!r.json || !('photo' in r.json)) throw new Error(`no photo field: ${r.text.slice(0, 160)}`);
    const p = r.json.photo;
    if (p && !(p.url && p.photographer && /utm_source=wanderzenai/.test(p.unsplashUrl))) throw new Error(`credit fields missing: ${r.text.slice(0, 200)}`);
    return p ? `photo by ${p.photographer}` : 'photo: null (no key or Unsplash limit)';
  });
await check('GET /videos/search → 200 with a list (empty until YOUTUBE_API_KEY is set)',
  async () => {
    const r = await call('GET', '/videos/search?activity=hiking&destination=Kyoto');
    expectStatus(r, 200);
    if (!Array.isArray(r.json?.videos)) throw new Error(`no videos array: ${r.text.slice(0, 160)}`);
    return `${r.json.videos.length} videos`;
  });
await check('GET /photos/search rejects an empty query → 400',
  async () => expectStatus(await call('GET', '/photos/search?query=%20'), 400));
// Fixed dates → served from the 30-day cache after the first run (one Haiku call a month).
await check('GET /destination-insights → things to do grounded in Foursquare places',
  async () => {
    const q = new URLSearchParams({ destination: 'Kyoto, Japan', startDate: '2027-04-05', endDate: '2027-04-12', travelStyles: 'Nature' });
    const r = await call('GET', `/destination-insights?${q}`);
    expectStatus(r, 200);
    const ins = r.json?.insights;
    if (!ins?.placesSource) throw new Error(`no placesSource: ${r.text.slice(0, 200)}`);
    const things = ins.thingsToDo || [];
    const verified = things.filter(t => t.verified).length;
    return `source ${ins.placesSource}, ${verified}/${things.length} verified${r.json.cached ? ' (cached)' : ''}`;
  });

// ── CORS preflight allows the methods the app uses ────────────────────────────
await check('OPTIONS /profile allows PUT',
  async () => {
    const r = await call('OPTIONS', '/profile', {
      headers: { 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    const allow = r.headers.get('access-control-allow-methods') || '';
    if (!/PUT/.test(allow)) throw new Error(`Allow-Methods was "${allow}" (status ${r.status})`);
    return allow;
  });
await check('OPTIONS /blog/{id} allows DELETE',
  async () => {
    const r = await call('OPTIONS', '/blog/abc', { headers: { 'Access-Control-Request-Method': 'DELETE' } });
    const allow = r.headers.get('access-control-allow-methods') || '';
    if (!/DELETE/.test(allow)) throw new Error(`Allow-Methods was "${allow}" (status ${r.status})`);
    return allow;
  });

// ── Frontend ──────────────────────────────────────────────────────────────────
if (FRONTEND_URL) {
  await check('Frontend home page → 200 HTML',
    async () => {
      const res = await fetch(FRONTEND_URL, { signal: AbortSignal.timeout(20000) });
      const html = await res.text();
      if (res.status !== 200 || !/<div id="root">/.test(html)) throw new Error(`status ${res.status}`);
      return '200';
    });
  await check('Frontend SPA route /plan → 200 (CloudFront fallback)',
    async () => {
      const res = await fetch(`${FRONTEND_URL}/plan`, { signal: AbortSignal.timeout(20000) });
      if (res.status !== 200) throw new Error(`status ${res.status}`);
      return '200';
    });
}

const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  —  ${r.detail}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
