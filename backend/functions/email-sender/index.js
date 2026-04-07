'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getDB, log } = require('/opt/nodejs/index');

const ses = new SESClient({ region: 'ap-southeast-2' });
const s3 = new S3Client({ region: 'ap-southeast-2' });

const buildEmailHTML = ({ itineraryTitle, destination, days, downloadUrl, isPaid }) => `
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
  .feature-item { display: flex; gap: 14px; margin-bottom: 12px; font-size: 13px; color: #5a5040; line-height: 1.6; }
  .feature-dot { color: #4a7c59; font-weight: bold; flex-shrink: 0; margin-top: 2px; }
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
    <div class="greeting">Your itinerary is ready ✦</div>
    <div class="destination-pill">${destination} · ${days} days</div>

    <div class="intro">
      We've crafted a slow travel itinerary tailored to how you actually want to travel —
      hidden cafes, local guesthouses, morning markets, and scenic walks away from the crowds.
      No tourist traps. Just the real ${destination}.
    </div>

    <div class="download-section">
      <a href="${downloadUrl}" class="download-btn">Download Your Itinerary →</a>
      <div class="download-note">Link expires in 7 days · PDF format · Print-friendly</div>
    </div>

    <hr class="divider">

    <div class="what-inside">
      <div class="section-title">What's inside your plan</div>
      <div class="feature-item"><span class="feature-dot">→</span><span>Day-by-day schedule with morning, afternoon and evening activities</span></div>
      <div class="feature-item"><span class="feature-dot">→</span><span>One hidden gem per day — places most tourists never find</span></div>
      <div class="feature-item"><span class="feature-dot">→</span><span>Local food recommendations with specific dishes to order</span></div>
      <div class="feature-item"><span class="feature-dot">→</span><span>Insider tips on best times to visit each spot</span></div>
      <div class="feature-item"><span class="feature-dot">→</span><span>Where to stay — neighbourhoods over city-centre hotels</span></div>
      <div class="feature-item"><span class="feature-dot">→</span><span>Tourist traps to skip — honest and specific</span></div>
      <div class="feature-item"><span class="feature-dot">→</span><span>Daily cost breakdown in your currency</span></div>
    </div>

    ${!isPaid ? `
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

exports.handler = async (event) => {
  const { itineraryId, submissionId, email, s3Key, destination, days, isPaid, itineraryTitle } = event;
  log.info('Email send started', { itineraryId, email });

  const db = getDB();

  try {
    // ─── Generate signed URL (7-day expiry) ─────────────────────────────────
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.PDF_BUCKET, Key: s3Key }),
      { expiresIn: 7 * 24 * 60 * 60 } // 7 days
    );

    // ─── Send email via SES ──────────────────────────────────────────────────
    const htmlBody = buildEmailHTML({ itineraryTitle, destination, days, downloadUrl: signedUrl, isPaid });

    await ses.send(new SendEmailCommand({
      Source: `WanderZenAI <${process.env.FROM_EMAIL}>`,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: {
          Data: `Your ${destination} itinerary is ready · WanderZenAI`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: {
            Data: `Your WanderZenAI itinerary for ${destination} (${days} days) is ready.\n\nDownload it here: ${signedUrl}\n\nThis link expires in 7 days.\n\nWanderZenAI — wanderzenai.com`,
            Charset: 'UTF-8',
          },
        },
      },
    }));

    // ─── Update DB ───────────────────────────────────────────────────────────
    await db.query(
      `UPDATE submissions SET status = 'email_sent', email_sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [submissionId]
    );

    await db.query(
      `INSERT INTO email_log (submission_id, itinerary_id, email, sent_at, signed_url_expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + INTERVAL '7 days')`,
      [submissionId, itineraryId, email]
    );

    log.info('Email sent successfully', { itineraryId, email });

  } catch (err) {
    log.error('Email send failed', { itineraryId, email, error: err.message });

    await db.query(
      `UPDATE submissions SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, submissionId]
    ).catch(() => {});
  }
};
