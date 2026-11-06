'use strict';

/**
 * What happens when an itinerary cannot be generated (Gundeep, Nov 6: "no filler days").
 *
 * Before: a day batch that failed twice was replaced by generic "Local Exploration" days
 * and shipped. Now the submission is marked failed, the itinerary the user paid with is
 * given back (monthly allowance or purchased credit — free-tier failures don't count
 * towards the free limit), and the user is emailed. The Confirmation page already shows
 * a "Something went wrong · Try again" state for status 'failed'.
 *
 * Exactly once: the status flip to 'failed' is conditional and the refund + email only
 * happen for the call that flipped it, so a Lambda retry can't refund twice.
 */

class GenerationFailed extends Error {
  constructor(message, { reason = 'generation_failed' } = {}) {
    super(message);
    this.name = 'GenerationFailed';
    this.reason = reason;
  }
}

/** Which column a paid entitlement came from (form-handler decideEntitlement). */
const REFUND_COLUMNS = Object.freeze({ monthly: 'monthly_remaining', credit: 'itineraries_remaining' });

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function failureEmail({ destination, refunded, frontendUrl }) {
  const dest = String(destination || 'your trip').slice(0, 120);
  const again = `${frontendUrl || 'https://www.wanderzenai.com'}/plan`;
  const refundLine = refunded
    ? 'The itinerary you used for this trip has been returned to your account, so trying again costs nothing.'
    : 'This attempt does not count towards your free itinerary, so you can try again straight away.';
  const text = `We're sorry — we couldn't finish your ${dest} itinerary.\n\n${refundLine}\n\nTry again: ${again}\n\nRather than send you a half-finished plan, we stopped. If it happens again, just reply to this email.\n\nWanderZenAI — wanderzenai.com`;
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;background:#f5f2ed;font-family:Georgia,serif">
<div style="max-width:600px;margin:40px auto;background:#faf7f2">
  <div style="background:#1a2e20;padding:32px 48px;text-align:center;color:#c8b89a;font-size:22px;letter-spacing:.08em">WanderZenAI</div>
  <div style="padding:40px 48px;color:#5a5040;font-size:15px;line-height:1.8">
    <p style="font-size:20px;color:#1a2e20">We couldn't finish your ${escapeHtml(dest)} itinerary</p>
    <p>${escapeHtml(refundLine)}</p>
    <p>Rather than send you a half-finished plan, we stopped. If it happens again, just reply to this email.</p>
    <p style="text-align:center;margin:32px 0"><a href="${escapeHtml(again)}" style="background:#1a2e20;color:#fff;padding:14px 32px;border-radius:4px;text-decoration:none">Try again</a></p>
  </div>
</div></body></html>`;
  return { subject: `We couldn't finish your ${dest} itinerary · WanderZenAI`, text, html };
}

/**
 * @param {object} args
 * @param {object} args.db       pg pool/client
 * @param {(msg: object) => Promise} args.sendEmail  { to, subject, text, html }
 * @param {string} args.submissionId
 * @param {'monthly'|'credit'|null} args.creditSource from the /submit invoke payload
 * @param {string} args.errorMessage stored on the submission (internal)
 * @returns {Promise<{ handled: boolean, refunded: boolean, emailed: boolean }>}
 */
async function handleGenerationFailure({ db, sendEmail, submissionId, creditSource, errorMessage, frontendUrl, log = console }) {
  const flipped = await db.query(
    `UPDATE submissions SET status = 'failed', error_message = $1, updated_at = NOW()
     WHERE id = $2 AND status NOT IN ('failed', 'itinerary_ready', 'pdf_ready', 'email_sent')
     RETURNING email, destination`,
    [String(errorMessage || 'generation failed').slice(0, 500), submissionId]
  );
  if (!flipped.rows.length) return { handled: false, refunded: false, emailed: false };
  const { email, destination } = flipped.rows[0];

  let refunded = false;
  const column = REFUND_COLUMNS[creditSource];
  if (column) {
    try {
      await db.query(`UPDATE users SET ${column} = ${column} + 1, updated_at = NOW() WHERE email = $1`, [email]);
      refunded = true;
      log.info?.('Itinerary refunded after failed generation', { submissionId, source: creditSource });
    } catch (err) {
      log.error?.('Refund after failed generation FAILED — refund by hand', { submissionId, source: creditSource, error: err.message });
    }
  }

  let emailed = false;
  try {
    await sendEmail({ to: email, ...failureEmail({ destination, refunded, frontendUrl }) });
    emailed = true;
  } catch (err) {
    log.error?.('Failure email not sent', { submissionId, error: err.message });
  }
  return { handled: true, refunded, emailed };
}

module.exports = { GenerationFailed, handleGenerationFailure, failureEmail, REFUND_COLUMNS };
