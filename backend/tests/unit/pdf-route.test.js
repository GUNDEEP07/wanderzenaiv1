'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Renders the PDF HTML (no browser) to check the route-first sections.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'pg') return { Pool: class {} };
  if (request === '@sparticuz/chromium' || request === 'puppeteer-core') return {};
  if (request.startsWith('@aws-sdk/')) return new Proxy({}, { get: () => class {} });
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  return origLoad.call(this, request, ...rest);
};
const { buildHTML } = require(path.join(__dirname, '../../functions/pdf-builder/index.js'))._internal;

const submission = { destination: 'Japan', days: 5, budget: 3000, travelerType: 'Couple', language: 'English' };
const day = (n, extra = {}) => ({ dayNumber: n, theme: `Day ${n}`, dailyCost: 100, ...extra });

test('route itineraries show "Your route" with day ranges, transfers, stays and day trips', () => {
  const html = buildHTML({
    title: 'T', summary: 'S',
    route: { bases: [
      { name: 'Kyoto', country: 'Japan', days: 3, dayTrips: [{ name: 'Kurama' }] },
      { name: 'Takayama', country: 'Japan', days: 2, transferIn: { mode: 'train', hours: 3.5 } },
    ] },
    stays: [{ base: 'Takayama', type: 'ryokan', priceTier: 'mid', why: 'hot spring' }],
    accommodation: { recommendation: 'single stay', why: 'x' },
    days: [day(1, { base: 'Kyoto', travelDay: false }), day(4, { base: 'Takayama', travelDay: true })],
  }, submission, '$');
  assert.match(html, /Your route/);
  assert.match(html, /Days 1–3 — Kyoto, Japan/);
  assert.match(html, /Days 4–5 — Takayama, Japan.*arrive by train \(~3.5 h\)/s);
  assert.match(html, /Stay: ryokan \(mid\)/);
  assert.match(html, /search-pill">Kurama/);
  assert.match(html, /Travel day → Takayama · Daily budget/);
  assert.ok(!html.includes('single stay'), 'per-base stays replace the single "Where to stay" box');
});

test('itineraries without a route render as before', () => {
  const html = buildHTML({ title: 'T', summary: 'S', accommodation: { recommendation: 'Guesthouse in Gion', why: 'quiet' }, days: [day(1)] }, submission, '$');
  assert.ok(!html.includes('Your route'));
  assert.match(html, /Guesthouse in Gion/);
  assert.match(html, /<div class="day-budget">Daily budget/);
});

test('route names are HTML-escaped', () => {
  const html = buildHTML({ route: { bases: [{ name: '<script>x</script>', days: 1 }] }, days: [] }, { ...submission, days: 1 }, '$');
  assert.ok(!html.includes('<script>x'));
});
