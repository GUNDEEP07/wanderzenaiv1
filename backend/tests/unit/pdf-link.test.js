'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Fresh PDF link (GET /itinerary/{id}/pdf) and the email that points at the trip page.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'pg') return { Pool: class {} };
  if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  return origLoad.call(this, request, ...rest);
};
const { pdfRouteOf, handlePdfLink, downloadName } = require(path.join(__dirname, '../../functions/form-handler/pdf-link.js'));
const { buildEmailHTML, buildEmailText } = require(path.join(__dirname, '../../functions/email-sender/index.js'))._internal;

const ID = 'wz_abc123_ABCDEFGHIJKLMNOP';
const deps = (signed = []) => ({
  ok: (data) => ({ statusCode: 200, data }),
  notFound: (m) => ({ statusCode: 404, m }),
  serverError: (m) => ({ statusCode: 500, m }),
  sign: async (key, name) => { signed.push({ key, name }); return `https://signed.example/${encodeURIComponent(key)}`; },
});
const db = (row) => ({ query: async (sql, params) => { assert.deepEqual(params, [ID]); return { rows: row ? [row] : [] }; } });
const ROW = { email: 'Owner@Example.com', destination: 'Việt Nam', days: 6, pdf_s3_key: 'itineraries/owner@example.com/it_1.pdf' };

test('route: only GET /itinerary/{id}/pdf with a well-formed id', () => {
  assert.equal(pdfRouteOf({ httpMethod: 'GET', path: `/itinerary/${ID}/pdf`, pathParameters: { id: ID } }), ID);
  assert.equal(pdfRouteOf({ httpMethod: 'GET', path: '/itinerary/not-an-id/pdf', pathParameters: { id: 'not-an-id' } }), 'bad');
  assert.equal(pdfRouteOf({ httpMethod: 'POST', path: `/itinerary/${ID}/pdf` }), null);
  assert.equal(pdfRouteOf({ httpMethod: 'GET', path: `/itinerary/${ID}/progress` }), null);
});

test('owner gets a fresh link (email compared case-insensitively) with a clean file name', async () => {
  const signed = [];
  const r = await handlePdfLink(db(ROW), ID, { email: 'owner@example.com' }, deps(signed));
  assert.equal(r.statusCode, 200);
  assert.equal(signed[0].key, ROW.pdf_s3_key);
  assert.equal(r.data.fileName, 'WanderZen-Viet-Nam-6-days.pdf');
  assert.ok(r.data.url.startsWith('https://signed.example/'));
});

test('someone else, or an unknown trip, or no PDF yet → 404 and nothing signed', async () => {
  const signed = [];
  assert.equal((await handlePdfLink(db(ROW), ID, { email: 'other@example.com' }, deps(signed))).statusCode, 404);
  assert.equal((await handlePdfLink(db(null), ID, { email: 'owner@example.com' }, deps(signed))).statusCode, 404);
  assert.equal((await handlePdfLink(db({ ...ROW, pdf_s3_key: null }), ID, { email: 'owner@example.com' }, deps(signed))).statusCode, 404);
  assert.equal(signed.length, 0);
});

test('file name never carries header-breaking characters', () => {
  assert.equal(downloadName('Kyoto "x"\r\nSet-Cookie: a', 3), 'WanderZen-Kyoto-x-Set-Cookie-a-3-days.pdf');
  assert.equal(downloadName('東京', null), 'WanderZen-trip.pdf');
});

test('email: main button opens the trip page; the direct link is labelled as short-lived; values escaped', () => {
  const html = buildEmailHTML({ destination: 'Hội An <b>', days: 6, downloadUrl: 'https://s3/x?a=1&b=2', tripUrl: `https://wanderzenai.com/itinerary/${ID}?download=1`, isPaid: true });
  assert.match(html, /href="https:\/\/wanderzenai\.com\/itinerary\/wz_abc123_ABCDEFGHIJKLMNOP\?download=1" class="download-btn">Open your trip/);
  assert.match(html, /download the PDF now<\/a> \(this direct link only works for a few hours\)/);
  assert.match(html, /href="https:\/\/s3\/x\?a=1&amp;b=2"/);
  assert.doesNotMatch(html, /<b>/);
  assert.doesNotMatch(html, /expires in 7 days/i);
  assert.match(html, /<table role="presentation"/);
});

test('plain-text email: links the trip page, never promises days for the raw S3 link', () => {
  const tripUrl = `https://wanderzenai.com/itinerary/${ID}?download=1`;
  const t = buildEmailText({ destination: 'Queenstown', days: 5, tripUrl, signedUrl: 'https://s3/x?sig=1' });
  assert.match(t, /Queenstown \(5 days\) is ready/);
  assert.ok(t.includes(tripUrl));
  assert.ok(!t.includes('https://s3/x'), 'no raw S3 link when the trip page exists');
  assert.doesNotMatch(t, /7 days/);
  const fallback = buildEmailText({ destination: 'Queenstown', days: 5, tripUrl: null, signedUrl: 'https://s3/x?sig=1' });
  assert.ok(fallback.includes('https://s3/x?sig=1'));
  assert.match(fallback, /few hours/);
  const locked = buildEmailText({ destination: 'Kyoto', days: 7, locked: true, unlockUrl: 'https://w/u', tripUrl, signedUrl: 's' });
  assert.match(locked, /Day 1 of your WanderZenAI trip for Kyoto is ready/);
  assert.match(locked, /Unlock every day: https:\/\/w\/u/);
});
