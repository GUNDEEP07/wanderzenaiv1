'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const LAYER = path.join(__dirname, '../../layers/shared/nodejs');
const rp = require(path.join(LAYER, 'route-plan.js'));
const sv = require(path.join(LAYER, 'selected-venues.js'));

const japan = {
  bases: [
    { name: 'Kyoto', country: 'Japan', lat: 35.01, lng: 135.77, days: 4, stayType: 'machiya guesthouse', dayTrips: [{ name: 'Kurama' }, { name: 'Ohara' }] },
    { name: 'Takayama', country: 'Japan', lat: 36.14, lng: 137.25, days: 3, transferIn: { mode: 'Train', hours: 3.5, note: 'via Nagoya' } },
    { name: 'Kanazawa', country: 'Japan', lat: 36.56, lng: 136.66, days: 3, transferIn: { mode: 'bus', hours: 2.25 } },
  ],
};

test('sanitizeRoute keeps valid bases, normalises transfer mode, drops transferIn on the first base', () => {
  const r = rp.sanitizeRoute({ bases: [{ ...japan.bases[0], transferIn: { mode: 'car' } }, ...japan.bases.slice(1)] }, 10);
  assert.deepEqual(r.bases.map(b => [b.name, b.days]), [['Kyoto', 4], ['Takayama', 3], ['Kanazawa', 3]]);
  assert.equal(r.bases[0].transferIn, null);
  assert.deepEqual(r.bases[1].transferIn, { mode: 'train', hours: 3.5, note: 'via Nagoya' });
  assert.deepEqual(r.bases[0].dayTrips.map(d => d.name), ['Kurama', 'Ohara']);
});

test('sanitizeRoute rejects junk; caps bases; bad coordinates become null', () => {
  assert.equal(rp.sanitizeRoute(null, 5), null);
  assert.equal(rp.sanitizeRoute({ bases: [] }, 5), null);
  assert.equal(rp.sanitizeRoute({ bases: [{ name: '' }, { foo: 1 }] }, 5), null);
  const many = rp.sanitizeRoute({ bases: Array.from({ length: 9 }, (_, i) => ({ name: `Town ${i}`, days: 1 })) }, 30);
  assert.equal(many.bases.length, rp.MAX_BASES);
  const bad = rp.sanitizeRoute({ bases: [{ name: 'X', lat: 200, lng: 10, days: 2 }] }, 2);
  assert.equal(bad.bases[0].lat, null);
  assert.equal(bad.bases[0].lng, null);
  const mode = rp.sanitizeRoute({ bases: [{ name: 'A', days: 1 }, { name: 'B', days: 1, transferIn: { mode: 'teleport' } }] }, 2);
  assert.equal(mode.bases[1].transferIn.mode, 'other');
});

test('days always add up to the trip length (too many, too few, more bases than days)', () => {
  const sum = (r) => r.bases.reduce((a, b) => a + b.days, 0);
  const tooMany = rp.sanitizeRoute({ bases: [{ name: 'A', days: 6 }, { name: 'B', days: 6 }] }, 7);
  assert.equal(sum(tooMany), 7);
  assert.ok(tooMany.bases.every(b => b.days >= 1));
  const tooFew = rp.sanitizeRoute({ bases: [{ name: 'A', days: 1 }, { name: 'B', days: 2 }] }, 9);
  assert.equal(sum(tooFew), 9);
  const crowded = rp.sanitizeRoute({ bases: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }] }, 2);
  assert.deepEqual(crowded.bases.map(b => b.name), ['A', 'B']);
  assert.equal(sum(crowded), 2);
});

test('dayPlan maps days to bases; the first day at each later base is a travel day', () => {
  const plan = rp.dayPlan(rp.sanitizeRoute(japan, 10));
  assert.equal(plan.length, 10);
  assert.deepEqual(plan.filter(d => d.travelDay).map(d => d.day), [5, 8]);
  assert.equal(plan[4].base.name, 'Takayama');
  assert.deepEqual(rp.daysForBase(rp.sanitizeRoute(japan, 10), 'kanazawa, Japan'), [8, 9, 10]);
});

test('prompt blocks: overview lists day ranges; batch lines name the base and the travel day', () => {
  const r = rp.sanitizeRoute(japan, 10);
  const overview = rp.formatRouteOverview(r);
  assert.match(overview, /Days 1–4: Kyoto, Japan \(stay: machiya guesthouse\)/);
  assert.match(overview, /Days 5–7: Takayama, Japan — arrive by train \(~3.5 h\) — via Nagoya/);
  const batch = rp.formatRouteForDays(r, [4, 5, 6]);
  assert.match(batch, /Day 4: based in Kyoto, Japan.*Day-trip options from here: Kurama, Ohara/);
  assert.match(batch, /Day 5: TRAVEL DAY Kyoto → Takayama by train/);
  assert.match(batch, /Day 6: based in Takayama/);
  assert.equal(rp.formatRouteForDays(null, [1]), '');
  assert.deepEqual(rp.basesForDays(r, [3, 4, 5]).map(b => b.name), ['Kyoto', 'Takayama']);
});

test('parseRouteOptions: several options, text around the JSON, days balanced, junk options dropped', () => {
  const text = 'Here you go:\n' + JSON.stringify({ options: [
    { name: 'Temples and Alps', summary: 'Temples, then mountains', bases: japan.bases.map(b => ({ ...b, days: 5 })) },
    { name: 'Empty', bases: [] },
    { name: 'Kyoto only', bases: [{ name: 'Kyoto', days: 2 }] },
  ] });
  const opts = rp.parseRouteOptions(text, 10);
  assert.deepEqual(opts.map(o => o.name), ['Temples and Alps', 'Kyoto only']);
  assert.ok(opts.every(o => o.bases.reduce((a, b) => a + b.days, 0) === 10 && o.source === 'ai'));
  assert.equal(opts[0].longestTransferHours, 3.5);
  assert.equal(opts[1].longestTransferHours, 0);
  // a single-route answer (old shape) still works
  assert.equal(rp.parseRouteOptions(JSON.stringify(japan), 10).length, 1);
  assert.throws(() => rp.parseRouteOptions('no json here', 10), /No JSON/);
  assert.throws(() => rp.parseRouteOptions('{"options":[{"bases":[]}]}', 10), /no usable options/);
});

test('buildRouteOptionsPrompt carries the trip length, stop cap, kids, travel-time limit and routes to avoid', () => {
  const prefs = rp.sanitizePrefs({ adults: 2, kids: [5, 8], transferComfort: 'short', notes: 'must see Sapa' });
  const p = rp.buildRouteOptionsPrompt({ destination: 'Vietnam', days: 10, travelStyle: ['Nature'], prefs, count: 3, avoid: ['Central coast, easy pace'] });
  assert.match(p, /Suggest 3 different ROUTES/);
  assert.match(p, /must add up to exactly 10/);
  assert.match(p, /At most 4 stops/);
  assert.match(p, /2 adults and children aged 5, 8; no more than ~2.5 hours between stops; no overnight journeys/);
  assert.match(p, /must see Sapa/);
  assert.match(p, /keep it easy for the children/);
  assert.match(p, /Do not repeat these routes they already saw: Central coast, easy pace/);
  assert.match(rp.buildRouteOptionsPrompt({ destination: 'Bled', days: 3, prefs: rp.sanitizePrefs({}) }), /4 days or less: 1 base/);
});

test('sanitizePrefs: sensible defaults, bounds, no overnight with under-6s', () => {
  assert.deepEqual(rp.sanitizePrefs(null), { adults: 2, kids: [], transferComfort: 'medium', overnightOk: false, notes: null });
  const p = rp.sanitizePrefs({ adults: 40, kids: [3, 'x', 25, 7.6, -1], transferComfort: 'teleport', overnightOk: true, notes: '  see   rice terraces ' });
  assert.equal(p.adults, 2); // out of range → default
  assert.deepEqual(p.kids, [3, 7]);
  assert.equal(p.transferComfort, 'medium');
  assert.equal(p.overnightOk, false, 'a 3-year-old means no overnight journeys');
  assert.equal(p.notes, 'see rice terraces');
  assert.equal(rp.sanitizePrefs({ kids: [9], overnightOk: true }).overnightOk, true);
});

test('formatPrefsForItinerary: kid rules only when there are kids', () => {
  const kids = rp.formatPrefsForItinerary(rp.sanitizePrefs({ kids: [4] }));
  assert.match(kids, /WHO IS TRAVELLING/);
  assert.match(kids, /youngest 4/);
  assert.match(kids, /nap window/);
  const adults = rp.formatPrefsForItinerary(rp.sanitizePrefs({ adults: 1 }));
  assert.match(adults, /1 adult;/);
  assert.ok(!/Children/.test(adults));
  assert.equal(rp.formatPrefsForItinerary(null), '');
});

test('repeat visits (Hanoi → Sapa → Hanoi) keep separate stops; days for the base cover both visits', () => {
  const r = rp.sanitizeRoute({ bases: [
    { name: 'Hanoi', days: 2 }, { name: 'Sapa', days: 3, transferIn: { mode: 'bus', hours: 5.5 } },
    { name: 'Hanoi', days: 1, transferIn: { mode: 'bus', hours: 5.5 } },
  ] }, 6);
  assert.deepEqual(r.bases.map(b => b.name), ['Hanoi', 'Sapa', 'Hanoi']);
  assert.deepEqual(rp.daysForBase(r, 'Hanoi'), [1, 2, 6]);
  assert.match(rp.formatRouteForDays(r, [6]), /Day 6: TRAVEL DAY Sapa → Hanoi by bus/);
});

test('selected_venues keeps a sanitised route; unpinned picks land on their base\'s non-travel days', () => {
  const raw = {
    version: 2,
    route: japan,
    picks: [
      { name: 'Hida Folk Village', destination: 'Takayama, Japan' },
      { name: 'Omicho Market', destination: 'Kanazawa' },
      { name: 'Philosopher’s Path', destination: 'Kyoto', day: 2 },
      { name: 'Somewhere Else', destination: 'Osaka' },
    ],
    interests: [],
  };
  const clean = sv.sanitizeSelectedVenues(raw, 10);
  assert.equal(clean.route.bases.length, 3);
  const plan = sv.planPicks(raw, 10);
  const day = (n) => plan.picks.find(p => p.name === n).day;
  assert.ok([6, 7].includes(day('Hida Folk Village')), `Takayama non-travel day, got ${day('Hida Folk Village')}`);
  assert.ok([9, 10].includes(day('Omicho Market')), `Kanazawa non-travel day, got ${day('Omicho Market')}`);
  assert.equal(day('Philosopher’s Path'), 2, 'pinned day kept');
  assert.ok(day('Somewhere Else') >= 1 && day('Somewhere Else') <= 10, 'unknown base → anywhere');
  assert.equal(plan.route.bases[1].name, 'Takayama');
});

test('a submission without a route behaves exactly as before', () => {
  const plan = sv.planPicks({ version: 2, picks: [{ name: 'A place' }], interests: [] }, 3);
  assert.equal(plan.route, null);
  assert.equal(plan.picks[0].day, 1);
  assert.equal('route' in sv.sanitizeSelectedVenues({ version: 2, picks: [], interests: [], route: { bases: [] } }, 3), false);
});
