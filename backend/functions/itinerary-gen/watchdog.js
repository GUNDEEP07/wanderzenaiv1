'use strict';

/**
 * Generation watchdog (backlog P1-7, Nov 2026).
 *
 * The trip pipeline is three fire-and-forget Lambdas: itinerary-gen → pdf-builder →
 * email-sender. Their own try/catch handles ordinary failures (failure.js: mark failed,
 * give the itinerary back, email the traveller). This catches what a try/catch can't:
 *
 * 1. A crash — Lambda timeout, out of memory, a start-up error (like the Node 24 PDF crash of
 *    Nov 15). Lambda hands the failed invocation to this function (EventInvokeConfig
 *    OnFailure destination in template.yaml) with the original payload, so a crashed
 *    generation is still refunded and the traveller told, exactly once.
 * 2. A trip stuck unfinished — every 10 minutes, trips still pending/processing 20+ minutes
 *    after their last update (generation can't legitimately run past 15). Only the last
 *    24 hours, so old abandoned rows never trigger emails. Paid ones get a credit back.
 *
 * Every case is counted as a CloudWatch metric (metrics.js) that alarms email the operator.
 */

const { getDB, log } = require('/opt/nodejs/index');
const { countMetric } = require('/opt/nodejs/metrics');
const dayAdjust = require('/opt/nodejs/day-adjust');
const { handleGenerationFailure } = require('./failure');
const { sendEmail } = require('./mailer');

const STUCK_AFTER_MINUTES = 20;
const LOOK_BACK_HOURS = 24;

/** "arn:aws:lambda:…:function:wanderzenai-pdf-builder-prod[:$LATEST]" → "pdf-builder" */
function stageOf(functionArn = '') {
  const name = String(functionArn).split(':function:')[1]?.split(':')[0] || '';
  const m = /^wanderzenai-(.+)-[a-z0-9]+$/.exec(name);
  return m ? m[1] : name || 'unknown';
}

/** Is this an asynchronous-invocation failure record (Lambda destination)? */
const isDestinationRecord = (event) => !!(event && event.requestContext && event.requestContext.functionArn && 'requestPayload' in event);

/**
 * A crashed invocation of a chain Lambda.
 * @returns {Promise<object>} what was done (for logs and tests)
 */
async function handleCrash(event, { db, send = sendEmail, frontendUrl = process.env.FRONTEND_URL } = {}) {
  const fn = stageOf(event.requestContext.functionArn);
  const payload = event.requestPayload || {};
  const condition = event.requestContext.condition || 'unknown';
  const error = event.responsePayload?.errorMessage || event.responsePayload?.errorType || condition;
  const submissionId = typeof payload.submissionId === 'string' ? payload.submissionId : null;

  countMetric('AsyncCrash', { function: fn, condition, submissionId });
  log.error('Generation chain crash', { function: fn, condition, submissionId, error: String(error).slice(0, 300) });

  if (fn === 'itinerary-gen' && payload.mode === 'adjustDay') {
    if (payload.adjustmentId) await dayAdjust.finishAdjustment(db, payload.adjustmentId, 'failed', `crashed: ${error}`);
    return { function: fn, action: 'adjustment-failed' };
  }
  if (fn === 'itinerary-gen' && submissionId) {
    const outcome = await handleGenerationFailure({
      db, sendEmail: send, submissionId,
      creditSource: payload.creditSource || null,
      errorMessage: `crashed (${condition}): ${error}`,
      frontendUrl, log,
    });
    return { function: fn, action: 'trip-failed', ...outcome };
  }
  // pdf-builder / email-sender: the itinerary itself exists. Alert only; the operator decides
  // whether to rebuild (an "update" rebuild never touches a delivered trip anyway).
  return { function: fn, action: 'alerted' };
}

/** Trips stuck unfinished: fail them (refund where known + email) and alert. */
async function sweepStuck({ db, send = sendEmail, frontendUrl = process.env.FRONTEND_URL } = {}) {
  const { rows } = await db.query(
    `SELECT id, status, plan FROM submissions
     WHERE status IN ('pending', 'processing')
       AND updated_at < NOW() - ($1 || ' minutes')::interval
       AND updated_at > NOW() - ($2 || ' hours')::interval
     ORDER BY updated_at
     LIMIT 25`,
    [String(STUCK_AFTER_MINUTES), String(LOOK_BACK_HOURS)]
  );
  const results = [];
  for (const row of rows) {
    // Which allowance a paid trip used travels only in the invoke payload. Give a paid trip
    // back as a purchased credit (never expires), so the traveller is never out of pocket and
    // the email's "returned to your account" is true.
    const outcome = await handleGenerationFailure({
      db, sendEmail: send, submissionId: row.id, creditSource: row.plan === 'paid' ? 'credit' : null,
      errorMessage: `stuck in ${row.status} for ${STUCK_AFTER_MINUTES}+ minutes`, frontendUrl, log,
    }).catch((err) => ({ handled: false, error: err.message }));
    countMetric('StuckTrip', { submissionId: row.id, status: row.status, plan: row.plan });
    log.error('Stuck trip failed by watchdog', { submissionId: row.id, status: row.status, plan: row.plan, ...outcome });
    results.push({ id: row.id, ...outcome });
  }
  return results;
}

exports.handler = async (event) => {
  const db = getDB();
  if (isDestinationRecord(event)) return handleCrash(event, { db });
  const stuck = await sweepStuck({ db });
  if (stuck.length) log.info('Watchdog sweep', { stuck: stuck.length });
  return { stuck: stuck.length };
};

exports._internal = { stageOf, isDestinationRecord, handleCrash, sweepStuck, STUCK_AFTER_MINUTES };
