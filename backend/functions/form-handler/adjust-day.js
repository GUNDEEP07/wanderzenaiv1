'use strict';

/**
 * Itinerary owner → "Adjust this day" (option A, Nov 2026).
 *
 *   GET  /itinerary/{id}/adjustments          what's left / running / done (owner only)
 *   POST /itinerary/{id}/days/{day}/adjust    { note } → 202, rewrite runs in itinerary-gen
 *
 * Rewriting a day takes ~30–60 s with Opus — longer than API Gateway allows — so the request
 * only claims a slot and hands the work to the generator; the page polls the GET.
 * Anyone who isn't the owner gets 404 (as for progress), so share links reveal nothing.
 */

const { ok, badRequest, notFound, serverError, log, checkRateLimit, userSubject, tooManyRequests } = require('/opt/nodejs/index');
const adjust = require('/opt/nodejs/day-adjust');

const SUBMISSION_ID = /^wz_[a-z0-9]{6,12}_[A-Za-z0-9_-]{16}$/;
const FINISHED = new Set(['itinerary_ready', 'pdf_ready', 'email_sent']);

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  },
  body: JSON.stringify(body),
});

/** { id, day? , kind } from the path, or null if it isn't one of these routes. */
function adjustRouteOf(event) {
  const path = event.path || '';
  let m = path.match(/\/itinerary\/([^/]+)\/adjustments$/);
  if (m && event.httpMethod === 'GET') return SUBMISSION_ID.test(m[1]) ? { kind: 'list', id: m[1] } : { kind: 'bad' };
  m = path.match(/\/itinerary\/([^/]+)\/days\/([^/]+)\/adjust$/);
  if (m && event.httpMethod === 'POST') {
    const day = Number(m[2]);
    return SUBMISSION_ID.test(m[1]) && Number.isInteger(day) ? { kind: 'start', id: m[1], day } : { kind: 'bad' };
  }
  return null;
}

/** The caller's own finished trip, or null. */
async function ownTrip(db, submissionId, user) {
  const { rows } = await db.query(
    'SELECT id, days, status FROM submissions WHERE id = $1 AND email = $2',
    [submissionId, user.email]
  );
  return rows[0] || null;
}

async function handleList(db, submissionId, user) {
  try {
    const trip = await ownTrip(db, submissionId, user);
    if (!trip) return notFound('Trip not found');
    return ok(adjust.summarize(await adjust.listAdjustments(db, submissionId)));
  } catch (err) {
    log.error('Adjustments read failed', { submissionId, error: err.message });
    return serverError('Could not load adjustments');
  }
}

/**
 * @param {(payload: object) => Promise<void>} invokeGenerator async Lambda invoke
 */
async function handleStart(event, db, user, submissionId, dayNumber, invokeGenerator) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }
  const note = adjust.cleanNote(body?.note);
  if (note.error) return badRequest(note.error);

  try {
    const trip = await ownTrip(db, submissionId, user);
    if (!trip) return notFound('Trip not found');
    if (!FINISHED.has(trip.status)) return respond(409, { success: false, code: 'NOT_READY', message: 'This itinerary is still being written — try again when it is ready.' });
    if (dayNumber < 1 || dayNumber > trip.days) return badRequest(`Pick a day between 1 and ${trip.days}`);

    // A rewrite is an Opus call: limit per account on top of the per-trip cap.
    const blocked = await checkRateLimit(db, 'adjustDay', userSubject(user));
    if (blocked) {
      log.warn('Rate limited', { bucket: 'adjustDay', uid: user.uid });
      return tooManyRequests(blocked.retryAfterSeconds);
    }

    const claimed = await adjust.startAdjustment(db, submissionId, dayNumber, note.value);
    if (claimed.error === 'busy') {
      return respond(409, { success: false, code: 'ADJUST_IN_PROGRESS', message: 'Another day is being changed — wait for it to finish.' });
    }
    if (claimed.error === 'limit') {
      return respond(409, { success: false, code: 'ADJUST_LIMIT', message: `This trip has used its ${adjust.MAX_ADJUSTMENTS} day changes.` });
    }

    const adjustmentId = String(claimed.row.id);
    try {
      await invokeGenerator({ mode: 'adjustDay', submissionId, adjustmentId });
    } catch (err) {
      await adjust.finishAdjustment(db, adjustmentId, 'failed', 'could not start').catch(() => {});
      log.error('Adjust: generator invoke failed', { submissionId, adjustmentId, error: err.message });
      return serverError('Could not start the change — please try again');
    }

    log.info('Day adjustment started', { submissionId, adjustmentId, dayNumber, uid: user.uid });
    const summary = adjust.summarize(await adjust.listAdjustments(db, submissionId));
    return respond(202, { success: true, data: summary });
  } catch (err) {
    log.error('Adjust start failed', { submissionId, dayNumber, error: err.message });
    return serverError('Could not start the change');
  }
}

module.exports = { adjustRouteOf, handleList, handleStart };
