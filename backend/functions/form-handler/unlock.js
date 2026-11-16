'use strict';

const tripPass = require('/opt/nodejs/trip-pass');

/**
 * POST /itinerary/{id}/unlock — open every day of a free trip (Nov 16 2026).
 *
 * Free trips show Day 1 only (layers/shared/nodejs/trip-access.js). The owner unlocks the rest
 * with one paid itinerary, taken in the same order as /submit (decideEntitlement): a test
 * account costs nothing, then this month's Wanderer allowance, then a purchased credit. The
 * free allowance can't unlock (the trip already used it). With nothing to spend → 402
 * NEEDS_ITINERARY, and the trip page sends the owner to Pricing.
 *
 * One transaction with the trip row locked (FOR UPDATE), so two clicks can never spend twice.
 * Afterwards the PDF is rebuilt with every day and emailed ("Your full trip is unlocked").
 * Anyone who isn't the owner gets 404, as for progress and adjustments.
 */

const { log } = require('/opt/nodejs/index');
const { ensureUnlockColumn, isLocked } = require('/opt/nodejs/trip-access');

const SUBMISSION_ID = /^wz_[a-z0-9]{6,12}_[A-Za-z0-9_-]{16}$/;
const FINISHED = new Set(['pdf_ready', 'email_sent']);

/** The trip id when this is POST /itinerary/{id}/unlock, else null ('bad' for a malformed id). */
function unlockRouteOf(event) {
  if (event.httpMethod !== 'POST') return null;
  const m = (event.path || '').match(/\/itinerary\/([^/]+)\/unlock$/);
  if (!m) return null;
  const id = event.pathParameters?.id || m[1];
  return SUBMISSION_ID.test(id) ? id : 'bad';
}

/**
 * Spend one paid itinerary on unlocking the trip.
 * @returns {Promise<{ outcome: 'unlocked'|'already'|'not_found'|'failed'|'needs_itinerary', source?: string, remaining?: number|null, status?: string }>}
 */
async function unlockTrip(db, submissionId, user) {
  await ensureUnlockColumn(db);
  const client = await db.connect();
  const email = String(user.email).toLowerCase();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, email, plan, unlocked_at, status FROM submissions WHERE id = $1 FOR UPDATE',
      [submissionId]
    );
    const trip = rows[0];
    if (!trip || String(trip.email).toLowerCase() !== email) {
      await client.query('ROLLBACK');
      return { outcome: 'not_found' };
    }
    if (!isLocked(trip)) {
      await client.query('COMMIT');
      return { outcome: 'already', status: trip.status };
    }
    if (trip.status === 'failed') {
      await client.query('ROLLBACK');
      return { outcome: 'failed' };
    }

    let source = null;
    let remaining = null;
    const test = await client.query('SELECT 1 FROM test_accounts WHERE email = $1', [trip.email]);
    if (test.rows.length) {
      source = 'test';
    } else {
      const monthly = await client.query(
        `UPDATE users SET monthly_remaining = monthly_remaining - 1, updated_at = NOW()
         WHERE email = $1 AND plan = 'subscriber' AND monthly_remaining > 0
         RETURNING monthly_remaining`,
        [trip.email]
      );
      const pass = monthly.rows.length ? null : await tripPass.spendPass(client, trip.email);
      if (monthly.rows.length) {
        source = 'monthly';
        remaining = monthly.rows[0].monthly_remaining;
      } else if (pass) {
        source = 'pass';
        remaining = pass.tripsLeft;
      } else {
        const credit = await client.query(
          `UPDATE users SET itineraries_remaining = itineraries_remaining - 1, updated_at = NOW()
           WHERE email = $1 AND itineraries_remaining > 0
           RETURNING itineraries_remaining`,
          [trip.email]
        );
        if (credit.rows.length) {
          source = 'credit';
          remaining = credit.rows[0].itineraries_remaining;
        }
      }
    }
    if (!source) {
      await client.query('ROLLBACK');
      return { outcome: 'needs_itinerary' };
    }

    await client.query('UPDATE submissions SET unlocked_at = NOW(), updated_at = NOW() WHERE id = $1', [submissionId]);
    await client.query('COMMIT');
    return { outcome: 'unlocked', source, remaining, status: trip.status };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * @param {object} deps { ok, notFound, serverError, respond(statusCode, body), rebuildPdf(submissionId) }
 */
async function handleUnlock(db, submissionId, user, deps) {
  try {
    const r = await unlockTrip(db, submissionId, user);
    if (r.outcome === 'not_found') return deps.notFound('Trip not found');
    if (r.outcome === 'failed') return deps.respond(409, { success: false, code: 'TRIP_FAILED', message: 'This trip could not be finished, so there is nothing to unlock.' });
    if (r.outcome === 'needs_itinerary') {
      return deps.respond(402, {
        success: false,
        code: 'NEEDS_ITINERARY',
        message: 'Unlocking uses one itinerary. Get a single plan or Wanderer, then come back to this trip.',
      });
    }
    if (r.outcome === 'unlocked') {
      log.info('Trip unlocked', { submissionId, source: r.source });
      // A delivered trip gets a full PDF and email; one still being written picks up the
      // unlock when its PDF is built.
      if (FINISHED.has(r.status)) {
        await deps.rebuildPdf(submissionId).catch((err) => log.error('Unlock PDF rebuild not started', { submissionId, error: err.message }));
      }
    }
    return deps.ok({ unlocked: true, source: r.source || null, remaining: r.remaining ?? null });
  } catch (err) {
    log.error('Unlock failed', { submissionId, error: err.message });
    return deps.serverError('Could not unlock this trip — nothing was used. Please try again.');
  }
}

module.exports = { unlockRouteOf, unlockTrip, handleUnlock, SUBMISSION_ID };
