'use strict';

/**
 * Trip Pass (pricing design D, Nov 16 2026): a one-time purchase of N full trips to use within
 * a set number of days (Stripe product metadata: wz_plan=pass, trips, valid_days). No auto-renew.
 *
 * Passes live in their own table because, unlike purchased credits (users.itineraries_remaining),
 * they expire. Spending order everywhere (decideEntitlement, GET /entitlement, unlock):
 *   test account → Wanderer monthly (legacy subscribers) → Trip Pass (soonest expiry first)
 *   → purchased credit (never expires) → monthly free trip.
 * Spending is one atomic UPDATE on the chosen row (FOR UPDATE SKIP LOCKED), so parallel
 * submits can never take more trips than a pass holds.
 */

const ENSURE_TRIP_PASSES_SQL = `
CREATE TABLE IF NOT EXISTS trip_passes (
  id                SERIAL PRIMARY KEY,
  email             VARCHAR(255) NOT NULL,
  trips_total       INTEGER NOT NULL CHECK (trips_total > 0),
  trips_left        INTEGER NOT NULL CHECK (trips_left >= 0),
  expires_at        TIMESTAMPTZ NOT NULL,
  stripe_session_id VARCHAR(255) UNIQUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trip_passes_email ON trip_passes (email, expires_at);`;

let ensured = null;
/** Create trip_passes on first use (CI can't reach RDS; migration 012 documents it). */
function ensureTripPasses(db) {
  if (!ensured) ensured = db.query(ENSURE_TRIP_PASSES_SQL).catch((err) => { ensured = null; throw err; });
  return ensured;
}

/** Credit source string for a pass, carried in the /submit → generator payload for refunds. */
const passSource = (id) => `pass:${id}`;
const passIdOf = (source) => (typeof source === 'string' && /^pass:\d+$/.test(source) ? Number(source.slice(5)) : null);

/**
 * Add a pass for a paid checkout. Idempotent per Stripe session (a replayed webhook adds nothing).
 * @returns {Promise<{ created: boolean, id?: number }>}
 */
async function grantPass(db, { email, trips, validDays, sessionId }) {
  const n = Math.max(1, Math.min(50, Number.parseInt(trips, 10) || 0));
  const days = Math.max(1, Math.min(3650, Number.parseInt(validDays, 10) || 365));
  await ensureTripPasses(db);
  const r = await db.query(
    `INSERT INTO trip_passes (email, trips_total, trips_left, expires_at, stripe_session_id)
     VALUES ($1, $2, $2, NOW() + make_interval(days => $3), $4)
     ON CONFLICT (stripe_session_id) DO NOTHING
     RETURNING id`,
    [email, n, days, sessionId || null]
  );
  return r.rows.length ? { created: true, id: r.rows[0].id } : { created: false };
}

/**
 * Take one trip from the pass that expires soonest. Null when there is none.
 * @returns {Promise<null | { id: number, tripsLeft: number, expiresAt: string }>}
 */
async function spendPass(db, email) {
  await ensureTripPasses(db);
  const r = await db.query(
    `UPDATE trip_passes SET trips_left = trips_left - 1
     WHERE id = (
       SELECT id FROM trip_passes
       WHERE email = $1 AND trips_left > 0 AND expires_at > NOW()
       ORDER BY expires_at, id
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, trips_left, expires_at`,
    [email]
  );
  const row = r.rows[0];
  return row ? { id: row.id, tripsLeft: row.trips_left, expiresAt: new Date(row.expires_at).toISOString() } : null;
}

/** Give one trip back to a pass (failed generation or a submission that was never stored). */
async function refundPass(db, id) {
  await ensureTripPasses(db);
  const r = await db.query(
    'UPDATE trip_passes SET trips_left = LEAST(trips_left + 1, trips_total) WHERE id = $1 RETURNING id',
    [id]
  );
  return r.rows.length > 0;
}

/**
 * What the user's live passes hold, read-only.
 * @returns {Promise<{ tripsLeft: number, expiresAt: string|null }>} expiresAt = soonest live pass
 */
async function passSummary(db, email) {
  await ensureTripPasses(db);
  const r = await db.query(
    `SELECT COALESCE(SUM(trips_left), 0)::int AS trips_left, MIN(expires_at) AS expires_at
     FROM trip_passes WHERE email = $1 AND trips_left > 0 AND expires_at > NOW()`,
    [email]
  );
  const row = r.rows[0] || {};
  return { tripsLeft: row.trips_left || 0, expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null };
}

module.exports = {
  ENSURE_TRIP_PASSES_SQL, ensureTripPasses, grantPass, spendPass, refundPass, passSummary, passSource, passIdOf,
  _reset: () => { ensured = null; },
};
