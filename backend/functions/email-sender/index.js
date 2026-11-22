'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getDB, log } = require('/opt/nodejs/index');
const { countMetric } = require('/opt/nodejs/metrics');

const ses = new SESClient({ region: 'ap-southeast-2' });
const s3 = new S3Client({ region: 'ap-southeast-2' });

const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "Day 1 is ready" (a locked free trip), "updated" (adjust / unlock) or "ready". */
const greetingOf = (update, locked) => {
  if (update?.unlocked) return 'Your full trip is unlocked ✦';
  if (update) return 'Your itinerary is updated ✦';
  return locked ? 'Day 1 of your trip is ready ✦' : 'Your itinerary is ready ✦';
};

const buildEmailHTML = ({ itineraryTitle, destination, days, downloadUrl, tripUrl = null, isPaid, update = null, locked = false, unlockUrl = null }) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; background: #f5f2ed; font-family: Georgia, 'Times New Roman', serif; }
  .wrapper { max-width: 600px; margin: 40px auto; background: #faf7f2; }
  .header { background: #1a2e20; padding: 40px 48px 32px; text-align: center; }
  .logo { font-size: 24px; color: #c8b89a; letter-spacing: 0.08em; margin-bottom: 6px; }
  .logo-sub { font-size: 11px; color: rgba(200,184,154,0.7); letter-spacing: 0.2em; text-transform: uppercase; }
  .body { padding: 48px; }
  .greeting { font-size: 22px; color: #1a2e20; margin-bottom: 20px; line-height: 1.3; }
  .intro { font-size: 15px; color: #5a5040; line-height: 1.8; margin-bottom: 32px; }
  .destination-pill {
    display: inline-block;
    background: #4a7c59;
    color: white;
    font-size: 13px;
    padding: 6px 18px;
    border-radius: 20px;
    margin-bottom: 32px;
    letter-spacing: 0.05em;
  }
  .download-section { text-align: center; margin: 40px 0; }
  .download-btn {
    display: inline-block;
    background: #1a2e20;
    color: white !important;
    text-decoration: none;
    padding: 18px 48px;
    font-size: 15px;
    letter-spacing: 0.08em;
    border-radius: 4px;
    font-family: Georgia, serif;
  }
  .download-note { font-size: 12px; color: #9a8c78; margin-top: 14px; font-style: italic; }
  .divider { border: none; border-top: 1px solid #e0d8cc; margin: 32px 0; }
  .what-inside { margin-bottom: 32px; }
  .section-title { font-size: 14px; font-weight: bold; color: #1a2e20; margin-bottom: 14px; letter-spacing: 0.05em; }
  /* Tables, not flexbox: Gmail and Outlook drop display:flex, which misaligned the list. */
  .feature-dot { width: 22px; color: #4a7c59; font-weight: bold; font-size: 13px; line-height: 1.6; padding: 0 0 10px; }
  .feature-text { font-size: 13px; color: #5a5040; line-height: 1.6; padding: 0 0 10px; }
  @media (max-width: 620px) { .wrapper { margin: 0 auto !important; } .body { padding: 28px 22px !important; } .header, .footer { padding-left: 22px !important; padding-right: 22px !important; } .download-btn { padding: 16px 28px !important; } }
  .upgrade-box {
    background: #e8f0ea;
    border-left: 3px solid #4a7c59;
    padding: 20px 24px;
    margin: 32px 0;
    border-radius: 0 4px 4px 0;
  }
  .upgrade-title { font-size: 14px; font-weight: bold; color: #1a2e20; margin-bottom: 8px; }
  .upgrade-text { font-size: 13px; color: #5a5040; line-height: 1.6; margin-bottom: 14px; }
  .upgrade-link { color: #4a7c59; font-weight: bold; font-size: 13px; }
  .footer { background: #1a2e20; padding: 28px 48px; text-align: center; }
  .footer-text { font-size: 11px; color: rgba(200,184,154,0.6); line-height: 1.8; }
  .footer-link { color: #c8b89a; }
  .social-row { margin: 16px 0 0; }
  .social-link { color: #c8b89a; font-size: 11px; margin: 0 8px; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">WanderZenAI</div>
    <div class="logo-sub">Your slow travel companion</div>
  </div>

  <div class="body">
    <div class="greeting">${greetingOf(update, locked)}</div>
    <div class="destination-pill">${escapeHtml(destination)} · ${escapeHtml(days)} days</div>

    <div class="intro">
      ${update?.unlocked
        ? `Every day of your ${escapeHtml(destination)} trip is now open, with where to stay, slow travel tips and the tourist traps to skip. Here is the full guide.`
        : update
        ? `Day ${update.dayNumber} has been rewritten the way you asked. The rest of your trip is unchanged — here is the full guide with the new day in it.`
        : locked
        ? `Your whole ${escapeHtml(days)}-day trip is written. Day 1 is open now; unlock the full trip to see every day, where to stay, slow travel tips and the tourist traps to skip.`
        : `We've crafted a slow travel itinerary tailored to how you actually want to travel —
      hidden cafes, local guesthouses, morning markets, and scenic walks away from the crowds.
      No tourist traps. Just the real ${escapeHtml(destination)}.`}
    </div>

    <div class="download-section">
      ${tripUrl ? `
      <a href="${escapeHtml(tripUrl)}" class="download-btn">Open your trip →</a>
      <div class="download-note">Day by day on your phone, add it to your calendar, and download the PDF any time.<br>Sign in with this email address to download.</div>
      <div class="download-note" style="margin-top:10px;font-style:normal">Or <a href="${escapeHtml(downloadUrl)}" style="color:#4a7c59">download the PDF now</a> (this direct link only works for a few hours).</div>` : `
      <a href="${escapeHtml(downloadUrl)}" class="download-btn">Download Your Itinerary →</a>
      <div class="download-note">PDF format · Print-friendly · This link only works for a few hours</div>`}
    </div>

    <hr class="divider">

    <div class="what-inside">
      <div class="section-title">What's inside your plan</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td class="feature-dot" valign="top">→</td><td class="feature-text">Day-by-day schedule with morning, afternoon and evening activities</td></tr>
        <tr><td class="feature-dot" valign="top">→</td><td class="feature-text">One hidden gem per day — places most tourists never find</td></tr>
        <tr><td class="feature-dot" valign="top">→</td><td class="feature-text">Local food recommendations with specific dishes to order</td></tr>
        <tr><td class="feature-dot" valign="top">→</td><td class="feature-text">Insider tips on best times to visit each spot</td></tr>
        <tr><td class="feature-dot" valign="top">→</td><td class="feature-text">Where to stay — neighbourhoods over city-centre hotels</td></tr>
        <tr><td class="feature-dot" valign="top">→</td><td class="feature-text">Tourist traps to skip — honest and specific</td></tr>
        <tr><td class="feature-dot" valign="top">→</td><td class="feature-text">Budget by day — activities, food and other costs in your currency</td></tr>
      </table>
    </div>

    ${locked && unlockUrl ? `
    <div class="upgrade-box">
      <div class="upgrade-title">Days 2–${escapeHtml(days)} are ready and waiting</div>
      <div class="upgrade-text">Unlock the full trip with one itinerary — a single plan, a credit or your Wanderer allowance.</div>
      <a href="${escapeHtml(unlockUrl)}" class="upgrade-link">Unlock the full trip →</a>
    </div>` : !isPaid && !update ? `
    <div class="upgrade-box">
      <div class="upgrade-title">Get 5 itineraries every month</div>
      <div class="upgrade-text">
        Enjoyed this plan? The Wanderer subscription gives you 5 personalised itineraries per month,
        plus priority generation and longer detailed plans — for just $9/month.
      </div>
      <a href="${process.env.FRONTEND_URL}/pricing" class="upgrade-link">See plans →</a>
    </div>` : ''}

    <div style="font-size:12px;color:#9a8c78;line-height:1.8;font-style:italic;">
      Travel slowly. The best moments happen when you stop rushing.
    </div>
  </div>

  <div class="footer">
    <div class="footer-text">
      WanderZenAI · <a href="${process.env.FRONTEND_URL}" class="footer-link">wanderzenai.com</a><br>
      You're receiving this because you requested an itinerary.<br>
      <a href="${process.env.FRONTEND_URL}/unsubscribe" class="footer-link">Unsubscribe</a> ·
      <a href="${process.env.FRONTEND_URL}/privacy" class="footer-link">Privacy Policy</a>
    </div>
    <div class="social-row">
      <a href="https://instagram.com/wanderzenai" class="social-link">Instagram</a>
      <a href="https://pinterest.com/wanderzenai" class="social-link">Pinterest</a>
    </div>
  </div>
</div>
</body>
</html>`;

/**
 * Plain-text email body. Links to the trip page (which signs a fresh PDF link on every download)
 * whenever we have one: the raw S3 link dies with the Lambda's temporary credentials, often within
 * hours, so it is only a fallback and never promised for days.
 */
function buildEmailText({ destination, days, update, locked, unlockUrl, tripUrl, signedUrl }) {
  const head = update?.unlocked ? `Your full WanderZenAI trip for ${destination} is unlocked.`
    : update ? `Day ${update.dayNumber} of your WanderZenAI itinerary for ${destination} has been updated.`
    : locked ? `Day 1 of your WanderZenAI trip for ${destination} is ready.`
    : `Your WanderZenAI itinerary for ${destination} (${days} days) is ready.`;
  const lines = [head, ''];
  if (tripUrl) {
    lines.push(`Open your trip and download the PDF: ${tripUrl}`, 'This link keeps working; sign in with this email address.');
  } else {
    lines.push(`Download the PDF: ${signedUrl}`, 'This download link works for a few hours.');
  }
  if (locked && unlockUrl) lines.push('', `Unlock every day: ${unlockUrl}`);
  lines.push('', 'WanderZenAI — wanderzenai.com');
  return lines.join('\n');
}

exports.handler = async (event) => {
  const { itineraryId, submissionId, email, s3Key, destination, days, isPaid, itineraryTitle } = event;
  const locked = event.locked === true;
  // After "Adjust this day" or an unlock: a different subject/intro, and the trip status is left alone.
  const update = Number.isInteger(event.update?.dayNumber) ? { dayNumber: event.update.dayNumber }
    : event.update?.unlocked === true ? { unlocked: true } : null;
  log.info('Email send started', { itineraryId, email });

  const db = getDB();

  try {
    // ─── Links ───────────────────────────────────────────────────────────────
    // The signed URL dies with the Lambda's temporary credentials (often within hours), so
    // the main button opens the trip page, which signs a fresh link on every download.
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.PDF_BUCKET, Key: s3Key }),
      { expiresIn: 24 * 60 * 60 }
    );
    const tripUrl = process.env.FRONTEND_URL && submissionId
      ? `${process.env.FRONTEND_URL}/itinerary/${encodeURIComponent(submissionId)}?download=1`
      : null;

    // ─── Send email via SES ──────────────────────────────────────────────────
    const unlockUrl = locked && process.env.FRONTEND_URL && submissionId
      ? `${process.env.FRONTEND_URL}/itinerary/${encodeURIComponent(submissionId)}?unlock=1`
      : null;
    const htmlBody = buildEmailHTML({ itineraryTitle, destination, days, downloadUrl: signedUrl, tripUrl, isPaid, update, locked, unlockUrl });

    await ses.send(new SendEmailCommand({
      Source: `WanderZenAI <${process.env.FROM_EMAIL}>`,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: update?.unlocked
            ? `Your full ${destination} trip is unlocked · WanderZenAI`
            : update
            ? `Your ${destination} itinerary is updated (day ${update.dayNumber}) · WanderZenAI`
            : locked
            ? `Day 1 of your ${destination} trip is ready · WanderZenAI`
            : `Your ${destination} itinerary is ready · WanderZenAI`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: {
            Data: buildEmailText({ destination, days, update, locked, unlockUrl, tripUrl, signedUrl }),
            Charset: 'UTF-8',
          },
        },
      },
    }));

    // ─── Update DB ───────────────────────────────────────────────────────────
    if (!update) {
      await db.query(
        `UPDATE submissions SET status = 'email_sent', email_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [submissionId]
      );
    }

    await db.query(
      `INSERT INTO email_log (submission_id, itinerary_id, email, sent_at, signed_url_expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '24 hours')`, // at most; the Lambda's credentials can end it sooner
      [submissionId, itineraryId, email]
    );

    log.info('Email sent successfully', { itineraryId, email });

  } catch (err) {
    log.error('Email send failed', { itineraryId, update, error: err.message });
    countMetric('EmailFailed', { itineraryId, submissionId, update: !!update });
    if (update) return; // the trip was already delivered; don't mark it failed

    await db.query(
      `UPDATE submissions SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, submissionId]
    ).catch(() => {});
  }
};

// Exported for unit tests.
exports._internal = { buildEmailHTML, buildEmailText };
