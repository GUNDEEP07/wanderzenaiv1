'use strict';

// Run: node --test backend/tests/unit/*.test.js
// Google Places (New) client: quality bar, name matching, must-see ideas, photos. Fake fetch only.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

process.env.GOOGLE_PLACES_API_KEY = 'test-key';
const gp = require(path.join(__dirname, '../../layers/shared/nodejs/google-places.js'));

const place = (o) => ({
  id: `ChIJ${(o.n || 'x').replace(/\W/g, '')}0000000`, displayName: { text: o.n }, businessStatus: o.s || 'OPERATIONAL',
  rating: o.r, userRatingCount: o.c, primaryType: o.t, types: [o.t], location: o.loc || { latitude: -45.03, longitude: 168.66 },
  googleMapsUri: `https://maps.google.com/?cid=${o.n}`, primaryTypeDisplayName: { text: o.t },
  photos: o.photo ? [{ name: `places/ChIJ${o.n.replace(/\W/g, '')}0000000/photos/AbCdEfGhIjKlMn`, authorAttributions: [{ displayName: 'Kyle Zhou', uri: 'https://maps.google.com/contrib/1' }] }] : undefined,
});
const fakeFetch = (handler) => {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts, body: opts?.body ? JSON.parse(opts.body) : null });
    const out = await handler(url, opts, calls.at(-1));
    return { ok: true, status: 200, json: async () => out, text: async () => JSON.stringify(out) };
  };
  fn.calls = calls;
  return fn;
};

test('quality bar: food/paid ≥4.2★ from 30+ reviews; free sights only need to be open', () => {
  const n = (o) => gp.normalize(place(o));
  assert.equal(gp.passesBar(n({ n: 'Aosta', t: 'italian_restaurant', r: 4.6, c: 596 })), true);
  assert.equal(gp.passesBar(n({ n: 'Kea Cafe', t: 'cafe', r: 3.3, c: 122 })), false);
  assert.equal(gp.passesBar(n({ n: 'New cafe', t: 'cafe', r: 5, c: 4 })), false);
  assert.equal(gp.passesBar(n({ n: 'Lake Hayes Walkway', t: 'hiking_area', r: 4.1, c: 14 })), true);
  assert.equal(gp.passesBar(n({ n: 'Shut', t: 'park', s: 'CLOSED_PERMANENTLY' })), false);
  assert.match(gp.barReason(n({ n: 'Kea Cafe', t: 'cafe', r: 3.3, c: 122 })), /rated 3.3 from 122/);
  assert.equal(gp.barReason(null), 'not found on Google');
});

test('name matching tolerates Google naming, rejects a different place', () => {
  assert.equal(gp.sameName('Onsen Hot Pools', 'Onsen Hot Pools & Day Spa'), true);
  assert.equal(gp.sameName('Te Anau Glowworm Caves', 'RealNZ | Te Anau Glowworm Caves'), true);
  assert.equal(gp.sameName('Marble Mountains', 'The Marble Mountains'), true);
  assert.equal(gp.sameName("Henry's Park", 'Henry Creek Campsite'), false);
  assert.equal(gp.sameName('Glenorchy Cafe (The GY Cafe)', "Mrs Glen's Cafe"), false);
});

test('checkPlace: found + good, invented, and low-rated', async () => {
  const f = fakeFetch((url, opts, c) => {
    const q = c.body.textQuery;
    if (q.startsWith('Aosta')) return { places: [place({ n: 'Aosta', t: 'italian_restaurant', r: 4.6, c: 596 })] };
    if (q.startsWith("Henry's Park")) return { places: [place({ n: 'Henry Creek Campsite', t: 'campground', r: 4.1, c: 194 })] };
    if (q.startsWith('Kea Cafe')) return { places: [place({ n: 'Kea Cafe', t: 'cafe', r: 3.3, c: 122 })] };
    return {};
  });
  const a = await gp.checkPlace('Aosta', 'Arrowtown, New Zealand', { fetchImpl: f });
  assert.equal(a.ok, true); assert.match(a.place.placeId, /^ChIJ/);
  const h = await gp.checkPlace("Henry's Park", 'Te Anau, New Zealand', { fetchImpl: f });
  assert.deepEqual([h.ok, h.place, h.reason], [false, null, 'not found on Google']);
  const k = await gp.checkPlace('Kea Cafe', 'Te Anau, New Zealand', { fetchImpl: f });
  assert.equal(k.ok, false); assert.match(k.reason, /rated 3.3/);
  // key in a header, never in the URL; field mask set
  assert.equal(f.calls[0].opts.headers['X-Goog-Api-Key'], 'test-key');
  assert.ok(!f.calls[0].url.includes('test-key'));
  assert.match(f.calls[0].opts.headers['X-Goog-FieldMask'], /places\.rating/);
});

test('ideasNear: three theme searches near the stop, bar applied, far and duplicate places dropped, mixed', async () => {
  const far = { latitude: -43.53, longitude: 172.63 }; // Christchurch, ~330 km
  const f = fakeFetch((url, opts, c) => {
    const q = c.body.textQuery;
    if (q.startsWith('scenic walks')) return { places: [place({ n: 'Queenstown Hill Track', t: 'hiking_area', r: 4.8, c: 1236, photo: true }), place({ n: 'Far Walk', t: 'hiking_area', r: 5, c: 900, loc: far }), place({ n: 'Bobs Cove Track', t: 'hiking_area', r: 4.7, c: 507 })] };
    if (q.startsWith('local cafes')) return { places: [place({ n: 'Fergbaker', t: 'bakery', r: 4.6, c: 2346 }), place({ n: 'Kea Cafe', t: 'cafe', r: 3.3, c: 122 }), place({ n: 'Queenstown Hill Track', t: 'hiking_area', r: 4.8, c: 1236 })] };
    return { places: [place({ n: 'Queenstown', t: 'locality', r: 4.9, c: 9999 }), place({ n: 'Lakes District Museum', t: 'museum', r: 4.5, c: 1243 })] };
  });
  const ideas = await gp.ideasNear({ name: 'Queenstown', country: 'New Zealand', lat: -45.03, lng: 168.66 }, { fetchImpl: f });
  assert.equal(f.calls.length, 3);
  assert.ok(f.calls.every((c) => c.body.locationBias?.circle?.radius === 40000));
  assert.deepEqual(ideas.map((p) => p.name), ['Queenstown Hill Track', 'Fergbaker', 'Lakes District Museum', 'Bobs Cove Track']);
  assert.equal(ideas[0].photo.authors[0].name, 'Kyle Zhou');
});

test('photoUri: validates the resource name and the returned host; key in a header', async () => {
  const f = fakeFetch(() => ({ photoUri: 'https://lh3.googleusercontent.com/places/abc=s480' }));
  const name = 'places/ChIJabcdefghij/photos/AbCdEfGhIjKlMn';
  assert.equal(await gp.photoUri(name, { fetchImpl: f }), 'https://lh3.googleusercontent.com/places/abc=s480');
  assert.match(f.calls[0].url, /media\?maxWidthPx=480&skipHttpRedirect=true$/);
  await assert.rejects(gp.photoUri('../../etc/passwd', { fetchImpl: f }), /bad photo name/);
  const evil = fakeFetch(() => ({ photoUri: 'https://evil.example.com/x.jpg' }));
  await assert.rejects(gp.photoUri(name, { fetchImpl: evil }), /unexpected photo url/);
});

test('maps link uses the place ID scheme when we have one', () => {
  assert.equal(gp.mapsUrlFor('Aosta', 'ChIJabcdefghij123'), 'https://www.google.com/maps/search/?api=1&query=Aosta&query_place_id=ChIJabcdefghij123');
  assert.equal(gp.mapsUrlFor('Aosta', 'bad id!'), 'https://www.google.com/maps/search/?api=1&query=Aosta');
});
