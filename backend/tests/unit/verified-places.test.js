'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { groundThingsToDo, formatVenueChoices, matchVenue } = require(
  path.join(__dirname, '../../layers/shared/nodejs/venue-enrichment/verified.js')
);

const venues = [
  { name: 'Philosopher’s Path', category: 'Trail', area: 'Sakyo', address: 'Tetsugaku-no-michi, Kyoto', mapsUrl: 'https://maps.google.com/?q=p', fsqPlaceId: 'a1' },
  { name: 'Weekenders Coffee Tominokoji', category: 'Coffee Shop', area: 'Nakagyo', address: '', mapsUrl: 'https://maps.google.com/?q=w', fsqPlaceId: 'a2' },
  { name: 'Kurama-dera', category: 'Temple', area: 'Kurama', address: '', mapsUrl: 'https://maps.google.com/?q=k', fsqPlaceId: 'a3' },
];

test('verified picks take the real name, address, map link and id', () => {
  const out = groundThingsToDo([{ name: "philosopher's path", reason: 'quiet canal walk' }], venues);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'Philosopher’s Path');
  assert.equal(out[0].verified, true);
  assert.equal(out[0].source, 'foursquare');
  assert.equal(out[0].fsqPlaceId, 'a1');
  assert.equal(out[0].mapsUrl, 'https://maps.google.com/?q=p');
  assert.equal(out[0].reason, 'quiet canal walk', 'Claude-written fields are kept');
});

test('partial names match (Claude shortens or extends names)', () => {
  assert.equal(matchVenue('Weekenders Coffee', venues).fsqPlaceId, 'a2');
  assert.equal(matchVenue('Kurama-dera Temple (鞍馬寺)', venues).fsqPlaceId, 'a3');
  assert.equal(matchVenue('Ok', venues), null, 'too short to match');
});

test('invented places are labelled suggestions and come after verified ones', () => {
  const out = groundThingsToDo([
    { name: 'Secret Bamboo Teahouse' },
    { name: 'Kurama-dera' },
    { name: 'Weekenders Coffee Tominokoji' },
  ], venues);
  assert.deepEqual(out.map(t => [t.name, t.verified, t.source]), [
    ['Kurama-dera', true, 'foursquare'],
    ['Weekenders Coffee Tominokoji', true, 'foursquare'],
    ['Secret Bamboo Teahouse', false, 'ai_suggestion'],
  ]);
});

test('the same venue chosen twice is kept once; output capped at 3', () => {
  const out = groundThingsToDo([
    { name: 'Kurama-dera' }, { name: 'kurama dera' }, { name: 'Philosopher’s Path' },
    { name: 'Weekenders Coffee Tominokoji' }, { name: 'Made Up Place' },
  ], venues);
  assert.equal(out.length, 3);
  assert.equal(new Set(out.map(t => t.name)).size, 3);
  assert.ok(out.every(t => t.verified));
});

test('no venues (Foursquare down): everything is a labelled suggestion; junk ignored', () => {
  const out = groundThingsToDo([{ name: 'Somewhere' }, null, { foo: 1 }], []);
  assert.deepEqual(out.map(t => t.source), ['ai_suggestion']);
  assert.deepEqual(groundThingsToDo(undefined, venues), []);
});

test('formatVenueChoices numbers the list for the prompt', () => {
  assert.equal(formatVenueChoices(venues.slice(0, 2)),
    '1. Philosopher’s Path — Trail, Sakyo\n2. Weekenders Coffee Tominokoji — Coffee Shop, Nakagyo');
  assert.equal(formatVenueChoices([]), '');
});
