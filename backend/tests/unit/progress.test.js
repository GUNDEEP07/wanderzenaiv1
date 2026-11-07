'use strict';

// Run: node --test backend/tests/unit/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const pr = require(path.join(__dirname, '../../layers/shared/nodejs/progress.js'));

/** Minimal fake pg: records queries; can fail the first call with "column does not exist". */
function fakeDb({ rows = [], missingColumnOnce = false, fail = false } = {}) {
  const calls = [];
  let missing = missingColumnOnce;
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (fail) throw new Error('db down');
      if (missing && !/ALTER TABLE/.test(sql)) {
        missing = false;
        const e = new Error('column "progress" does not exist'); e.code = '42703'; throw e;
      }
      return { rows };
    },
  };
}

test('daySummary keeps only what the page shows, venue names first', () => {
  const day = {
    dayNumber: 2, theme: 'Lanterns and rice fields',
    morningActivity: { activity: 'Cycle to Tra Que', venueName: 'Tra Que Village' },
    afternoonActivity: { activity: 'Cooking class' },
    eveningActivity: { activity: '' },
    localEats: { name: 'Banh mi', venueName: 'Banh Mi Phuong' },
    hiddenGem: 'secret', dailyCost: 40,
  };
  assert.deepEqual(pr.daySummary(day, [{ day: 2, base: { name: 'Hoi An' }, travelDay: true }]), {
    day: 2, theme: 'Lanterns and rice fields', base: 'Hoi An', travelDay: true,
    stops: ['Tra Que Village', 'Cooking class'], eat: 'Banh Mi Phuong',
  });
  assert.equal(pr.daySummary({ dayNumber: 1 }).base, null);
});

test('routeForProgress: names, coordinates and days only', () => {
  assert.equal(pr.routeForProgress(null), null);
  assert.deepEqual(pr.routeForProgress({ bases: [{ name: 'Hanoi', lat: 21.03, lng: 105.85, days: 2, why: 'x', stayType: 'y' }, { name: 'Sapa', lat: 'bad', days: 3 }] }), [
    { name: 'Hanoi', lat: 21.03, lng: 105.85, days: 2 },
    { name: 'Sapa', lat: null, lng: null, days: 3 },
  ]);
});

test('recorder: start, stage, atomic append; creates the column once if missing', async () => {
  const db = fakeDb({ missingColumnOnce: true });
  const rec = pr.progressRecorder(db, 'wz_x', null);
  await rec.start({ totalDays: 6, route: { bases: [{ name: 'Hanoi', lat: 1, lng: 2, days: 6 }] } });
  assert.match(db.calls[1].sql, /ALTER TABLE submissions ADD COLUMN IF NOT EXISTS progress JSONB/);
  const started = JSON.parse(db.calls[2].params[1]);
  assert.equal(started.stage, 'places'); assert.equal(started.totalDays, 6); assert.deepEqual(started.days, []);
  await rec.stage('writing');
  assert.equal(db.calls.at(-1).params[1], 'writing');
  await rec.stage('nonsense'); // ignored
  assert.equal(db.calls.at(-1).params[1], 'writing');
  await rec.addDays([{ day: 1 }]);
  assert.match(db.calls.at(-1).sql, /COALESCE\(progress->'days', '\[\]'::jsonb\) \|\| \$2::jsonb/);
});

test('recorder never throws (progress must not break generation)', async () => {
  const warned = [];
  const rec = pr.progressRecorder(fakeDb({ fail: true }), 'wz_x', { warn: (m, d) => warned.push(d.what) });
  await rec.start({ totalDays: 3 });
  await rec.addDays([{ day: 1 }]);
  assert.deepEqual(warned, ['start', 'addDays']);
});

test('readProgress: owner only; days sorted; internal errors not exposed', async () => {
  const row = {
    id: 'wz_x', email: 'Gundeep07@gmail.com', status: 'processing', destination: 'Vietnam', days: 6,
    progress: { stage: 'writing', totalDays: 6, route: [{ name: 'Hanoi' }], days: [{ day: 4 }, { day: 1 }] },
  };
  assert.equal(await pr.readProgress(fakeDb({ rows: [row] }), 'wz_x', { email: 'someone@else.com' }), null);
  assert.equal(await pr.readProgress(fakeDb({ rows: [] }), 'wz_x', { email: 'gundeep07@gmail.com' }), null);
  const mine = await pr.readProgress(fakeDb({ rows: [row] }), 'wz_x', { email: 'gundeep07@gmail.com' });
  assert.deepEqual(mine.days.map(d => d.day), [1, 4]);
  assert.equal(mine.stage, 'writing');
  const failed = await pr.readProgress(fakeDb({ rows: [{ ...row, status: 'failed', error_message: 'TypeError at line 12' }] }), 'wz_x', { email: 'gundeep07@gmail.com' });
  assert.equal(failed.failed, true);
  assert.doesNotMatch(JSON.stringify(failed), /TypeError/);
  // before the generator started: no progress yet
  const fresh = await pr.readProgress(fakeDb({ rows: [{ ...row, status: 'pending', progress: null }] }), 'wz_x', { email: 'gundeep07@gmail.com' });
  assert.deepEqual([fresh.days, fresh.totalDays, fresh.stage], [[], 6, null]);
});
