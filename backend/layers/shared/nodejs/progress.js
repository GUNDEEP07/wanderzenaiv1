'use strict';

/**
 * Live generation progress (Nov 7 2026 — "watch your trip being written").
 *
 * The itinerary generator records what it has finished in submissions.progress (JSONB);
 * GET /itinerary/{id}/progress returns it to the signed-in owner while the confirmation
 * page polls. Shape:
 *
 *   { stage: 'places'|'writing'|'checking'|'finishing',
 *     totalDays, startedAt,
 *     route: [{ name, lat, lng, days }] | null,
 *     days:  [{ day, theme, base, travelDay, stops: [activity…], eat }] }
 *
 * Progress is best-effort: a failed write is logged and never fails the generation.
 * The column creates itself on first use (CI cannot reach RDS to run migrations);
 * infra/migrations/005_add_submission_progress.sql documents it.
 */

const ENSURE_PROGRESS_COLUMN_SQL = 'ALTER TABLE submissions ADD COLUMN IF NOT EXISTS progress JSONB';
const UNDEFINED_COLUMN = '42703';
const STAGES = ['places', 'writing', 'checking', 'finishing'];

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
/** Shorten at a word boundary with "…" — never mid-word ("famo") or after an open bracket. */
function clipWords(v, n) {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (t.length <= n) return t;
  const cut = t.slice(0, n + 1).replace(/\s+\S*$/, '').replace(/[\s,;:(–—-]+$/, '');
  return `${cut || t.slice(0, n)}…`;
}

/** Route as the map and the progress page need it — no free text beyond the town names. */
function routeForProgress(route) {
  if (!route?.bases?.length) return null;
  return route.bases.slice(0, 8).map(b => ({
    name: clip(b.name, 80),
    lat: num(b.lat),
    lng: num(b.lng),
    days: num(b.days),
  }));
}

/** A finished day reduced to what the progress page shows. */
function daySummary(day, plan = null) {
  const stops = ['morningActivity', 'afternoonActivity', 'eveningActivity']
    .map(k => clipWords(day?.[k]?.venueName || day?.[k]?.activity, 70))
    .filter(Boolean);
  const p = plan?.find(x => x.day === day?.dayNumber);
  return {
    day: num(day?.dayNumber),
    theme: clipWords(day?.theme, 90),
    base: p ? clip(p.base?.name, 80) : clip(day?.base, 80) || null,
    travelDay: p ? !!p.travelDay : !!day?.travelDay,
    stops,
    eat: clipWords(day?.localEats?.venueName || day?.localEats?.name, 70) || null,
  };
}

async function withProgressColumn(db, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code !== UNDEFINED_COLUMN || !/progress/.test(err.message || '')) throw err;
    await db.query(ENSURE_PROGRESS_COLUMN_SQL);
    return fn();
  }
}

/** Run a progress write; never throw (progress must not break generation). */
async function safely(db, log, what, fn) {
  try {
    await withProgressColumn(db, fn);
  } catch (err) {
    log?.warn?.('Progress update failed (ignored)', { what, error: err.message });
  }
}

/**
 * Creates the progress recorder used by the generator.
 * @param {object} db pg pool/client
 * @param {string} submissionId
 * @param {object} [log]
 */
function progressRecorder(db, submissionId, log) {
  return {
    start: ({ totalDays, route }) => safely(db, log, 'start', () => db.query(
      'UPDATE submissions SET progress = $2::jsonb WHERE id = $1',
      [submissionId, JSON.stringify({ stage: 'places', totalDays, startedAt: new Date().toISOString(), route: routeForProgress(route), days: [] })],
    )),
    stage: (stage) => (STAGES.includes(stage) ? safely(db, log, `stage:${stage}`, () => db.query(
      `UPDATE submissions SET progress = jsonb_set(COALESCE(progress, '{}'::jsonb), '{stage}', to_jsonb($2::text)) WHERE id = $1`,
      [submissionId, stage],
    )) : Promise.resolve()),
    // Batches finish in parallel: one statement appends atomically (row lock), so no lost days.
    addDays: (summaries) => safely(db, log, 'addDays', () => db.query(
      `UPDATE submissions
          SET progress = jsonb_set(COALESCE(progress, '{}'::jsonb), '{days}',
                                   COALESCE(progress->'days', '[]'::jsonb) || $2::jsonb)
        WHERE id = $1`,
      [submissionId, JSON.stringify(summaries)],
    )),
    // After repairs: the final days, in order.
    setDays: (summaries) => safely(db, log, 'setDays', () => db.query(
      `UPDATE submissions SET progress = jsonb_set(COALESCE(progress, '{}'::jsonb), '{days}', $2::jsonb) WHERE id = $1`,
      [submissionId, JSON.stringify(summaries)],
    )),
  };
}

/**
 * What the owner's progress page gets. Not the owner, or no such submission → null
 * (callers answer 404 either way, so ids can't be probed).
 * @param {{ email: string }} user verified caller (requireUser)
 */
async function readProgress(db, submissionId, user) {
  const run = () => db.query(
    `SELECT id, email, status, destination, days, progress
       FROM submissions WHERE id = $1`,
    [submissionId],
  );
  const { rows } = await withProgressColumn(db, run);
  const row = rows[0];
  if (!row || !user?.email || String(row.email).toLowerCase() !== String(user.email).toLowerCase()) return null;
  const p = row.progress || {};
  const days = Array.isArray(p.days) ? [...p.days].sort((a, b) => (a.day || 0) - (b.day || 0)) : [];
  return {
    submissionId: row.id,
    status: row.status,
    destination: row.destination,
    totalDays: p.totalDays || row.days || null,
    stage: p.stage || null,
    startedAt: p.startedAt || null,
    route: p.route || null,
    days,
    failed: row.status === 'failed',
    // error_message holds internal error text — never shown to the user.
    message: row.status === 'failed' ? 'We could not finish this trip, and nothing was used up. Please try again.' : null,
  };
}

module.exports = {
  ENSURE_PROGRESS_COLUMN_SQL, STAGES, routeForProgress, daySummary, progressRecorder, readProgress,
};
