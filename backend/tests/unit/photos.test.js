'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { searchPhoto, normaliseQuery, toPhoto } = require(path.join(__dirname, '../../functions/recommendations/photos.js'));

const quiet = { warn() {}, info() {} };

function fakeDb(rows = {}) {
  const writes = [];
  return {
    writes,
    async query(sql, params) {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.startsWith('SELECT photo')) return { rows: params[0] in rows ? [{ photo: rows[params[0]] }] : [] };
      if (sql.startsWith('INSERT INTO photo_cache')) { writes.push(params); return { rows: [] }; }
      throw new Error('unexpected sql ' + sql);
    },
  };
}

const unsplashResult = {
  alt_description: 'tea field at dawn',
  urls: { regular: 'https://images.unsplash.com/photo-1?ixid=abc&w=1080' },
  links: { html: 'https://unsplash.com/photos/abc' },
  user: { name: 'Aiko Tan', links: { html: 'https://unsplash.com/@aiko' } },
};

test('normaliseQuery: lowercases, strips punctuation, keeps non-Latin letters, bounds length', () => {
  assert.equal(normaliseQuery('  Munnar   TEA estate!! '), 'munnar tea estate');
  assert.equal(normaliseQuery('京都 寺'), '京都 寺');
  assert.equal(normaliseQuery("Côte d'Azur"), "côte d'azur");
  assert.equal(normaliseQuery('<script>'), 'script');
  assert.equal(normaliseQuery('a'), '');
  assert.equal(normaliseQuery('x'.repeat(81)), '');
  assert.equal(normaliseQuery(undefined), '');
});

test('toPhoto keeps the hotlink URL and adds UTM to every link back to Unsplash', () => {
  const p = toPhoto(unsplashResult);
  assert.equal(p.url, unsplashResult.urls.regular);
  assert.equal(p.photographer, 'Aiko Tan');
  assert.equal(p.photographerUrl, 'https://unsplash.com/@aiko?utm_source=wanderzenai&utm_medium=referral');
  assert.equal(p.photoUrl, 'https://unsplash.com/photos/abc?utm_source=wanderzenai&utm_medium=referral');
  assert.equal(p.unsplashUrl, 'https://unsplash.com/?utm_source=wanderzenai&utm_medium=referral');
  assert.equal(toPhoto({}), null);
});

test('cache hit: no Unsplash call', async () => {
  let calls = 0;
  const r = await searchPhoto('kyoto', { db: fakeDb({ kyoto: { url: 'u' } }), accessKey: 'k', fetchImpl: async () => { calls++; }, log: quiet });
  assert.deepEqual(r, { photo: { url: 'u' }, cached: true });
  assert.equal(calls, 0);
});

test('cache miss: one call with the key in the header (never the URL), result cached 30 days', async () => {
  const db = fakeDb();
  let seen;
  const r = await searchPhoto('munnar tea', {
    db, accessKey: 'secret-key', log: quiet,
    fetchImpl: async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ results: [unsplashResult] }) }; },
  });
  assert.equal(r.photo.photographer, 'Aiko Tan');
  assert.equal(r.cached, false);
  assert.ok(!seen.url.includes('secret-key'));
  assert.equal(seen.init.headers.Authorization, 'Client-ID secret-key');
  assert.match(seen.url, /query=munnar\+tea/);
  assert.equal(db.writes[0][0], 'munnar tea');
  assert.equal(db.writes[0][2], '30 days');
});

test('no result is cached briefly (1 day) so the same miss is not re-queried all day', async () => {
  const db = fakeDb();
  const r = await searchPhoto('zzqx place', { db, accessKey: 'k', log: quiet, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ results: [] }) }) });
  assert.equal(r.photo, null);
  assert.deepEqual([db.writes[0][1], db.writes[0][2]], [null, '1 day']);
});

test('rate limited by Unsplash (demo key, 50/h): nothing cached, null returned', async () => {
  const db = fakeDb();
  for (const status of [403, 429]) {
    const r = await searchPhoto('bled', { db, accessKey: 'k', log: quiet, fetchImpl: async () => ({ ok: false, status, headers: new Map() }) });
    assert.deepEqual(r, { photo: null, cached: false });
  }
  assert.equal(db.writes.length, 0);
});

test('no key configured: no call, null', async () => {
  let calls = 0;
  const r = await searchPhoto('bled', { db: fakeDb(), accessKey: '', fetchImpl: async () => { calls++; }, log: quiet });
  assert.deepEqual(r, { photo: null, cached: false });
  assert.equal(calls, 0);
});

test('other Unsplash errors throw (the route answers { photo: null })', async () => {
  await assert.rejects(searchPhoto('bled', { db: fakeDb(), accessKey: 'k', log: quiet, fetchImpl: async () => ({ ok: false, status: 500 }) }), /Unsplash 500/);
});
