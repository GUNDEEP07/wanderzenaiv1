'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Blog photo upload rules: team only, real image bytes only, size and caption limits.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const HANDLER_DIR = path.join(__dirname, '../../functions/blog-handler');

// In-memory stand-ins for the DB module and S3.
const state = { rows: [], objects: new Map(), postExists: true };
const fakeDb = {
  MAX_PHOTOS_PER_POST: 12,
  postExists: async () => state.postExists,
  addPhoto: async (postId, key, caption) => {
    if (state.rows.filter(r => r.post_id === postId).length >= 12) return null;
    const row = { id: `00000000-0000-4000-8000-${String(state.rows.length).padStart(12, '0')}`, post_id: postId, s3_key: key, caption, display_order: state.rows.length };
    state.rows.push(row);
    return row;
  },
  listPhotos: async (postId) => state.rows.filter(r => r.post_id === postId),
  getPost: async (postId, userId, role) => (role === 'admin' ? { id: postId, status: 'draft' } : null),
  updatePhotoCaption: async (postId, id, caption) => {
    const r = state.rows.find(x => x.id === id && x.post_id === postId);
    if (r) r.caption = caption;
    return r || null;
  },
  deletePhoto: async (postId, id) => {
    const i = state.rows.findIndex(x => x.id === id && x.post_id === postId);
    return i < 0 ? null : state.rows.splice(i, 1)[0].s3_key;
  },
};
const fakeS3 = {
  putImage: async (key, buf, type) => { state.objects.set(key, { buf, type }); },
  deleteImage: async (key) => { state.objects.delete(key); },
  imageUrl: async (key) => `https://signed.example/${key}`,
};

const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === 'pg') return { Pool: class {} };
  if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  if (parent?.filename?.startsWith(HANDLER_DIR)) {
    if (request === '../db/blog') return fakeDb;
    if (request === '../utils/s3') return fakeS3;
  }
  return origLoad.call(this, request, parent, ...rest);
};
const photos = require(path.join(HANDLER_DIR, 'handlers/photos.js'));
const { sniffImage, decodeImage, cleanCaption } = photos._internal;

const POST = '11111111-1111-4111-8111-111111111111';
const ADMIN = { userId: 'a1', userRole: 'admin' };
const READER = { userId: 'r1', userRole: 'user' };
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(40)]);
const body = (res) => JSON.parse(res.body || '{}');

test.beforeEach(() => { state.rows = []; state.objects.clear(); state.postExists = true; });

test('image type comes from the bytes, not the name', () => {
  assert.equal(sniffImage(JPEG).contentType, 'image/jpeg');
  assert.equal(sniffImage(PNG).ext, 'png');
  assert.equal(sniffImage(WEBP).ext, 'webp');
  assert.equal(sniffImage(Buffer.from('<svg onload=alert(1)>')), null); // SVG can carry script
  assert.equal(sniffImage(Buffer.from('GIF89a')), null);
});

test('base64 decoding accepts data URLs and rejects junk', () => {
  assert.deepEqual(decodeImage(`data:image/jpeg;base64,${JPEG.toString('base64')}`), JPEG);
  assert.deepEqual(decodeImage(PNG.toString('base64')), PNG);
  assert.equal(decodeImage('not base64!!'), null);
  assert.equal(decodeImage(''), null);
  assert.equal(decodeImage(123), null);
  assert.equal(decodeImage('A'.repeat(6 * 1024 * 1024)), 'too_large');
});

test('captions are cleaned and capped', () => {
  assert.deepEqual(cleanCaption('  Rice  fields\u0000 at dawn '), { value: 'Rice fields at dawn' });
  assert.deepEqual(cleanCaption(''), { value: null });
  assert.deepEqual(cleanCaption(undefined), { value: null });
  assert.ok(cleanCaption('x'.repeat(201)).error);
  assert.ok(cleanCaption({}).error);
});

test('an admin uploads a photo: stored under blog/{post}/ with the sniffed type, URL returned', async () => {
  const res = await photos.uploadPhoto(POST, { image: JPEG.toString('base64'), caption: 'Tam Coc' }, ADMIN);
  assert.equal(res.statusCode, 201);
  const data = body(res).data;
  assert.equal(data.caption, 'Tam Coc');
  assert.match(data.url, new RegExp(`^https://signed.example/blog/${POST}/[0-9a-f-]{36}\\.jpg$`));
  assert.ok(!('s3_key' in data), 'the S3 key is not exposed');
  const [[, obj]] = [...state.objects];
  assert.equal(obj.type, 'image/jpeg');
});

test('non-admins, junk files and missing posts are refused', async () => {
  assert.equal((await photos.uploadPhoto(POST, { image: JPEG.toString('base64') }, READER)).statusCode, 403);
  assert.equal((await photos.uploadPhoto(POST, { image: JPEG.toString('base64') }, {})).statusCode, 401);
  assert.equal((await photos.uploadPhoto(POST, { image: Buffer.from('%PDF-1.7').toString('base64') }, ADMIN)).statusCode, 400);
  assert.equal((await photos.uploadPhoto('../../etc', { image: JPEG.toString('base64') }, ADMIN)).statusCode, 404);
  state.postExists = false;
  assert.equal((await photos.uploadPhoto(POST, { image: JPEG.toString('base64') }, ADMIN)).statusCode, 404);
  assert.equal(state.objects.size, 0, 'nothing was stored');
});

test('at most 12 photos; the 13th is refused and its object removed', async () => {
  for (let i = 0; i < 12; i++) assert.equal((await photos.uploadPhoto(POST, { image: PNG.toString('base64') }, ADMIN)).statusCode, 201);
  const res = await photos.uploadPhoto(POST, { image: PNG.toString('base64') }, ADMIN);
  assert.equal(res.statusCode, 400);
  assert.equal(state.objects.size, 12);
});

test('caption edit and delete are team only and remove the S3 object', async () => {
  const id = body(await photos.uploadPhoto(POST, { image: WEBP.toString('base64') }, ADMIN)).data.id;
  assert.equal((await photos.updatePhoto(POST, id, { caption: 'Hoi An at 6am' }, READER)).statusCode, 403);
  assert.equal(body(await photos.updatePhoto(POST, id, { caption: 'Hoi An at 6am' }, ADMIN)).data.caption, 'Hoi An at 6am');
  assert.equal((await photos.deletePhoto(POST, id, READER)).statusCode, 403);
  assert.equal((await photos.deletePhoto(POST, id, ADMIN)).statusCode, 204);
  assert.equal(state.objects.size, 0);
  assert.equal((await photos.deletePhoto(POST, id, ADMIN)).statusCode, 404);
});

test('listing follows post visibility', async () => {
  await photos.uploadPhoto(POST, { image: JPEG.toString('base64') }, ADMIN);
  assert.equal(body(await photos.listPhotos(POST, ADMIN)).data.length, 1);
  assert.equal((await photos.listPhotos(POST, READER)).statusCode, 404); // the fake post is a draft
});
