'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { searchVideos, normaliseVideoQuery, toVideo } = require(path.join(__dirname, '../../functions/recommendations/videos.js'));

const quiet = { warn() {}, info() {} };
function fakeDb(rows = {}) {
  const writes = [];
  return {
    writes,
    async query(sql, params) {
      if (sql.includes('CREATE TABLE')) return { rows: [] };
      if (sql.startsWith('SELECT videos')) return { rows: params[0] in rows ? [{ videos: rows[params[0]] }] : [] };
      if (sql.startsWith('INSERT INTO video_cache')) { writes.push(params); return { rows: [] }; }
      throw new Error('unexpected sql ' + sql);
    },
  };
}
const item = (id, title = 'Hiking the Kumano Kodo &amp; more') => ({
  id: { kind: 'youtube#video', videoId: id },
  snippet: { title, channelTitle: 'Slow Trails', publishedAt: '2026-03-01T00:00:00Z', thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } } },
});

test('normaliseVideoQuery: needs activity + destination; keeps the town; validates region', () => {
  assert.deepEqual(normaliseVideoQuery({ activity: ' Hiking ', destination: 'Kyoto, Japan', region: 'jp' }), { activity: 'hiking', destination: 'kyoto', region: 'JP' });
  assert.equal(normaliseVideoQuery({ activity: 'Hiking', destination: '' }), null);
  assert.equal(normaliseVideoQuery({ activity: '', destination: 'Kyoto' }), null);
  assert.equal(normaliseVideoQuery({ activity: 'Hiking', destination: 'Kyoto', region: 'JPN' }).region, null);
  assert.equal(normaliseVideoQuery({ activity: 'x'.repeat(61), destination: 'Kyoto' }), null);
});

test('toVideo unescapes titles, drops bad ids', () => {
  assert.equal(toVideo(item('abc123XYZ_-')).title, 'Hiking the Kumano Kodo & more');
  assert.equal(toVideo(item('abc123XYZ_-')).creator, 'Slow Trails');
  assert.equal(toVideo({ id: { videoId: '"><script>' } }), null);
  assert.equal(toVideo({}), null);
});

test('cache hit: no YouTube call', async () => {
  let calls = 0;
  const q = normaliseVideoQuery({ activity: 'hiking', destination: 'kyoto' });
  const r = await searchVideos(q, { db: fakeDb({ 'kyoto|hiking|': [{ id: 'v1' }] }), apiKey: 'k', fetchImpl: async () => { calls++; }, log: quiet });
  assert.deepEqual(r, { videos: [{ id: 'v1' }], cached: true });
  assert.equal(calls, 0);
});

test('cache miss: one search (embeddable, safe), cached 7 days', async () => {
  const db = fakeDb(); let url;
  const q = normaliseVideoQuery({ activity: 'Hiking', destination: 'Kyoto, Japan', region: 'JP' });
  const r = await searchVideos(q, { db, apiKey: 'yt-key', log: quiet, fetchImpl: async (u) => { url = new URL(u); return { ok: true, status: 200, json: async () => ({ items: [item('aaaaaaaaaaa'), item('bbbbbbbbbbb')] }) }; } });
  assert.equal(r.videos.length, 2);
  assert.equal(url.searchParams.get('q'), 'kyoto hiking');
  assert.equal(url.searchParams.get('videoEmbeddable'), 'true');
  assert.equal(url.searchParams.get('safeSearch'), 'strict');
  assert.equal(url.searchParams.get('regionCode'), 'JP');
  assert.deepEqual([db.writes[0][0], db.writes[0][2]], ['kyoto|hiking|JP', '7 days']);
});

test('quota used up (403/429): nothing cached, empty list', async () => {
  const db = fakeDb();
  for (const status of [403, 429]) {
    const r = await searchVideos(normaliseVideoQuery({ activity: 'hiking', destination: 'kyoto' }), { db, apiKey: 'k', log: quiet, fetchImpl: async () => ({ ok: false, status }) });
    assert.deepEqual(r, { videos: [], cached: false });
  }
  assert.equal(db.writes.length, 0);
});

test('no key: no call, empty; no results cached 1 day', async () => {
  let calls = 0;
  const q = normaliseVideoQuery({ activity: 'hiking', destination: 'kyoto' });
  assert.deepEqual(await searchVideos(q, { db: fakeDb(), apiKey: '', fetchImpl: async () => { calls++; }, log: quiet }), { videos: [], cached: false });
  assert.equal(calls, 0);
  const db = fakeDb();
  await searchVideos(q, { db, apiKey: 'k', log: quiet, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ items: [] }) }) });
  assert.equal(db.writes[0][2], '1 day');
});
