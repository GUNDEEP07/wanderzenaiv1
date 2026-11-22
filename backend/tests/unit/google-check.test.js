'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Finished-trip Google check: keep good places (placeId only), swap invented/closed/low-rated ones.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Module = require('module');

// CI's unit job has no /opt/nodejs (the Lambda layer path): map it to the repo's layer folder.
const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request.startsWith('/opt/nodejs/')) request = path.join(LAYER, request.slice('/opt/nodejs/'.length));
  return origLoad.call(this, request, ...rest);
};

process.env.GOOGLE_PLACES_API_KEY = 'test-key';
const { checkItineraryPlaces, slotsOf, kindOf } = require(path.join(__dirname, '../../functions/itinerary-gen/google-check.js'));

const g = (n, t, r, c, extra = {}) => ({ id: `ChIJ${n.replace(/\W/g, '')}000000`, displayName: { text: n }, businessStatus: 'OPERATIONAL', rating: r, userRatingCount: c, primaryType: t, types: [t], ...extra });
const DB = {
  'Aosta, Arrowtown': [g('Aosta', 'italian_restaurant', 4.6, 596)],
  "Henry's Park, Te Anau": [g('Henry Creek Campsite', 'campground', 4.1, 194)],
  'Kea Cafe, Te Anau': [g('Kea Cafe', 'cafe', 3.3, 122)],
  'Old Mill, Te Anau': [g('Old Mill', 'restaurant', 4.5, 300, { businessStatus: 'CLOSED_PERMANENTLY' })],
  'best local cafes in Te Anau': [g('Kea Cafe', 'cafe', 3.3, 122), g('Sprig & Thistle', 'cafe', 4.9, 173), g('Sandfly Cafe', 'cafe', 4.6, 2432)],
  'best local restaurants in Te Anau': [g('Redcliff Restaurant and bar', 'restaurant', 4.6, 1633)],
  'scenic walks and nature spots near Te Anau': [g('Te Anau Bird Sanctuary', 'tourist_attraction', 4.4, 1637), g('Lakefront Track', 'hiking_area', 4.7, 300)],
};
const fetchImpl = async (url, opts) => {
  const q = JSON.parse(opts.body).textQuery;
  const hit = Object.entries(DB).find(([k]) => q.startsWith(k));
  return { ok: true, status: 200, json: async () => ({ places: hit ? hit[1] : [] }) };
};
const act = (activity, location, extra = {}) => ({ time: '9:00', activity, location, venueName: null, localName: 'ローカル', insiderTip: `Go early to ${location}.`, ...extra });
const trip = () => ({
  days: [
    { dayNumber: 1, base: 'Arrowtown', morningActivity: act('Walk the Sawpit Gully loop', 'Your hotel'), eveningActivity: act('Dinner at Aosta', 'Aosta') },
    {
      dayNumber: 2, base: 'Te Anau',
      morningActivity: act("Stroll through Henry's Park by the lake", "Henry's Park"),
      afternoonActivity: act('Coffee at Kea Cafe', 'Kea Cafe'),
      eveningActivity: act('Dinner at Old Mill', 'Old Mill'),
      localEats: { name: 'Kea Cafe', dish: 'flat white', venueName: 'Kea Cafe' },
    },
  ],
});
const opts = { townOf: (d) => d.base, fetchImpl, log: { warn() {} } };

test('slots skip generic names; kinds come from the activity text', () => {
  const s = slotsOf(trip().days).map((x) => x.name);
  assert.ok(!s.includes('Your hotel'));
  assert.equal(kindOf(act('Coffee at Kea Cafe', 'Kea Cafe'), 'afternoonActivity'), 'cafe');
  assert.equal(kindOf(act("Stroll by the lake", 'x'), 'morningActivity'), 'nature');
  assert.equal(kindOf(act('Visit the museum', 'x'), 'eveningActivity'), 'food');
});

test('good places keep their text and gain a placeId; bad ones are swapped with reasons', async () => {
  const it = trip();
  const s = await checkItineraryPlaces(it, opts);
  const [d1, d2] = it.days;
  assert.equal(d1.eveningActivity.placeId, 'ChIJAosta000000');
  assert.equal(d1.eveningActivity.activity, 'Dinner at Aosta');
  // invented park → a real nature spot; text and tip follow, local-script name cleared
  assert.equal(d2.morningActivity.location, 'Te Anau Bird Sanctuary');
  assert.match(d2.morningActivity.activity, /Te Anau Bird Sanctuary/);
  assert.match(d2.morningActivity.insiderTip, /Te Anau Bird Sanctuary/);
  assert.equal(d2.morningActivity.localName, null);
  // 3.3★ café (used twice) → the same good café both times, never the low-rated one again
  assert.equal(d2.afternoonActivity.location, 'Sprig & Thistle');
  assert.equal(d2.localEats.name, 'Sprig & Thistle');
  assert.equal(d2.localEats.venueName, 'Sprig & Thistle');
  // closed restaurant → a different, open one
  assert.equal(d2.eveningActivity.location, 'Redcliff Restaurant and bar');
  assert.deepEqual(s.swapped.map((x) => [x.from, x.to, x.reason]), [
    ["Henry's Park", 'Te Anau Bird Sanctuary', 'not found on Google'],
    ['Kea Cafe', 'Sprig & Thistle', 'rated 3.3 from 122 reviews'],
    ['Kea Cafe', 'Sprig & Thistle', 'rated 3.3 from 122 reviews'],
    ['Old Mill', 'Redcliff Restaurant and bar', 'permanently closed'],
  ]);
  assert.equal(s.ok, 1);
  // nothing from Google but the place ID is stored
  assert.ok(!JSON.stringify(it).match(/rating|userRatingCount|"reviews"/));
});

test('no good swap → kept and marked unverified', async () => {
  const it = { days: [{ dayNumber: 1, base: 'Nowhere', morningActivity: act('See the Ghost Tower', 'Ghost Tower') }] };
  const s = await checkItineraryPlaces(it, opts);
  assert.equal(it.days[0].morningActivity.unverified, true);
  assert.equal(it.days[0].morningActivity.location, 'Ghost Tower');
  assert.deepEqual(s.unverified, [{ day: 1, name: 'Ghost Tower', reason: 'not found on Google' }]);
});

test('Google down → nothing changes', async () => {
  const it = trip(); const before = JSON.stringify(it);
  const broken = async () => { throw new Error('ECONNRESET'); };
  const s = await checkItineraryPlaces(it, { ...opts, fetchImpl: broken });
  assert.equal(s.ok, 0);
  assert.equal(JSON.stringify(it), before);
});
