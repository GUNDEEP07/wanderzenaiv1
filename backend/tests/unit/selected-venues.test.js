'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const sv = require(path.join(__dirname, '../../layers/shared/nodejs/selected-venues.js'));

const v2 = (picks, interests = []) => ({ version: 2, picks, interests });

test('sanitize keeps well-formed picks and strips junk', () => {
  const out = sv.sanitizeSelectedVenues(v2([
    { name: '  Fushimi Inari Taisha ', address: '68 Fukakusa', lat: 34.967, lng: 135.772, category: 'Temple', day: 2 },
    { name: '' },                                  // no name → dropped
    { name: 'fushimi inari taisha' },              // duplicate (case-insensitive) → dropped
    { name: 'Nishiki Market', lat: 999, lng: 135 }, // invalid coords → both nulled
    { name: 'Philosopher\u0000s Path', day: 9 },    // control char stripped; day out of range → null
    'not an object',
  ], ['Hiking', 'hiking', 'Food']), 5);

  assert.equal(out.version, 2);
  assert.deepEqual(out.picks.map(p => p.name), ['Fushimi Inari Taisha', 'Nishiki Market', 'Philosopher s Path']);
  assert.equal(out.picks[0].day, 2);
  assert.equal(out.picks[1].lat, null);
  assert.equal(out.picks[1].lng, null);
  assert.equal(out.picks[2].day, null);
  assert.deepEqual(out.interests, ['Hiking', 'Food']);
});

test('sanitize caps the number of picks and field lengths', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ name: `Place ${i}`, address: 'x'.repeat(500) }));
  const out = sv.sanitizeSelectedVenues(v2(many), 7);
  assert.equal(out.picks.length, sv.MAX_PICKS);
  assert.equal(out.picks[0].address.length, 200);
});

test('legacy ID-only shape is kept as-is and plans to nothing', () => {
  const legacy = { 'Kyoto/Hiking': ['4bf58dd8d48988d159941735'] };
  assert.deepEqual(sv.sanitizeSelectedVenues(legacy, 5), legacy);
  assert.deepEqual(sv.planPicks(legacy, 5), { picks: [], interests: [], route: null });
  assert.deepEqual(sv.planPicks(null, 5), { picks: [], interests: [], route: null });
});

test('planPicks keeps pinned days and spreads unpinned picks to the least-loaded days', () => {
  const plan = sv.planPicks(v2([
    { name: 'A', day: 1 },
    { name: 'B', day: 1 },
    { name: 'C' },
    { name: 'D' },
    { name: 'E' },
  ]), 3);
  const byName = Object.fromEntries(plan.picks.map(p => [p.name, p]));
  assert.equal(byName.A.day, 1); assert.equal(byName.A.pinned, true);
  assert.equal(byName.B.day, 1);
  assert.equal(byName.C.day, 2); assert.equal(byName.C.pinned, false);
  assert.equal(byName.D.day, 3);
  assert.equal(byName.E.day, 2); // days 2 and 3 now tie at 1 → earliest
  assert.deepEqual(plan.picks.map(p => p.day), [...plan.picks.map(p => p.day)].sort((a, b) => a - b));
});

test('formatPicksForDays includes only that batch\'s picks, marked required with exact names', () => {
  const plan = sv.planPicks(v2([
    { name: 'Fushimi Inari Taisha', category: 'Temple', address: '68 Fukakusa', lat: 34.9671, lng: 135.7727, day: 2 },
    { name: 'Kurama-dera', day: 5 },
  ], ['Hiking']), 6);
  const text = sv.formatPicksForDays(plan, [1, 2, 3]);
  assert.match(text, /REQUIRED/);
  assert.match(text, /- Day 2: Fushimi Inari Taisha \(Temple\) — 68 Fukakusa \[34\.9671, 135\.7727\] — the traveller chose this day/);
  assert.doesNotMatch(text, /Kurama-dera/);
  assert.match(text, /venueName to the place name exactly/);
  assert.match(text, /Hiking/);
});

test('formatPicksForDays with only interests still mentions them; with nothing returns empty', () => {
  assert.match(sv.formatPicksForDays(sv.planPicks(v2([], ['Food']), 3), [1, 2, 3]), /Food/);
  assert.equal(sv.formatPicksForDays(sv.planPicks(v2([]), 3), [1, 2, 3]), '');
  assert.equal(sv.formatPicksOverview(sv.planPicks(v2([]), 3)), '');
});

test('formatPicksOverview lists every pick with its day', () => {
  const text = sv.formatPicksOverview(sv.planPicks(v2([{ name: 'A', day: 3 }, { name: 'B' }]), 4));
  assert.match(text, /Day 3: A/);
  assert.match(text, /Day 1: B/);
});

test('findMissingPicks matches loosely and flags missing and wrong-day picks', () => {
  const plan = sv.planPicks(v2([
    { name: 'Fushimi Inari Taisha', day: 1 },
    { name: 'Café Kosci', day: 2 },
    { name: 'Nishiki Market', day: 2 },
  ]), 3);
  const days = [
    { dayNumber: 1, morningActivity: { venueName: 'Fushimi Inari Taisha (伏見稲荷大社)' } },
    { dayNumber: 2, afternoonActivity: { activity: 'Coffee at cafe kosci' } },
    { dayNumber: 3, eveningActivity: { location: 'Nishiki Market, central Kyoto' } },
  ];
  const { missing, wrongDay } = sv.findMissingPicks(days, plan);
  assert.deepEqual(missing.map(p => p.name), []);
  assert.deepEqual(wrongDay.map(p => p.name), ['Nishiki Market']);

  const none = sv.findMissingPicks([{ dayNumber: 1, theme: 'Arrival' }], plan);
  assert.equal(none.missing.length, 3);
});

test('unpinned picks are never reported as wrong-day', () => {
  const plan = sv.planPicks(v2([{ name: 'Gion' }]), 3); // planned to day 1, not pinned
  const { wrongDay } = sv.findMissingPicks([{ dayNumber: 3, eveningActivity: { activity: 'Evening walk in Gion' } }], plan);
  assert.equal(wrongDay.length, 0);
});
