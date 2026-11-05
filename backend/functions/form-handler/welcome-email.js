'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const {
  getDB, log, requireUser, AuthError, authErrorBody, checkRateLimit, userSubject, rateLimitBody,
} = require('/opt/nodejs/index');

const ses = new SESClient({ region: 'ap-southeast-2' });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

const json = (statusCode, body, extra = {}) => ({ statusCode, headers: { ...CORS, ...extra }, body: JSON.stringify(body) });

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

/**
 * First name for the greeting. Taken from the request body (the Firebase token may predate
 * updateProfile), so it is attacker-controlled: strip control characters (header injection
 * in the subject line), cap the length, and HTML-escape before it touches the template.
 */
function firstNameFrom(raw) {
  if (typeof raw !== 'string') return '';
  const first = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().split(/\s+/)[0] || '';
  return first.slice(0, 40);
}

// `safeFirstName` must already be HTML-escaped.
const buildWelcomeHTML = (safeFirstName) => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { margin: 0; padding: 0; background: #f5f2ed; font-family: Georgia, 'Times New Roman', serif; }
  .wrapper { max-width: 600px; margin: 40px auto; background: #faf7f2; }
  .header { background: #1a2e20; padding: 40px 48px 36px; text-align: center; }
  .logo { font-size: 26px; color: #c8b89a; letter-spacing: 0.08em; margin-bottom: 6px; }
  .logo-sub { font-size: 11px; color: rgba(200,184,154,0.6); letter-spacing: 0.2em; text-transform: uppercase; }
  .body { padding: 48px; }
  .greeting { font-size: 26px; color: #1a2e20; margin-bottom: 18px; line-height: 1.3; }
  .intro { font-size: 15px; color: #5a5040; line-height: 1.85; margin-bottom: 32px; }
  .cta-section { text-align: center; margin: 40px 0; }
  .cta-btn {
    display: inline-block;
    background: #1a2e20;
    color: white !important;
    text-decoration: none;
    padding: 18px 52px;
    font-size: 15px;
    letter-spacing: 0.06em;
    border-radius: 4px;
    font-family: Georgia, serif;
  }
  .divider { border: none; border-top: 1px solid #e0d8cc; margin: 36px 0; }
  .section-title { font-size: 13px; font-weight: bold; color: #1a2e20; margin-bottom: 16px; letter-spacing: 0.08em; text-transform: uppercase; }
  .feature-item { display: flex; gap: 14px; margin-bottom: 14px; font-size: 14px; color: #5a5040; line-height: 1.7; }
  .feature-dot { color: #4a7c59; font-weight: bold; flex-shrink: 0; margin-top: 3px; font-size: 16px; }
  .tip-box {
    background: #e8f0ea;
    border-left: 3px solid #4a7c59;
    padding: 18px 22px;
    margin: 32px 0;
    border-radius: 0 4px 4px 0;
    font-size: 13px;
    color: #3a5040;
    line-height: 1.7;
    font-style: italic;
  }
  .footer { background: #1a2e20; padding: 28px 48px; text-align: center; }
  .footer-text { font-size: 11px; color: rgba(200,184,154,0.6); letter-spacing: 0.1em; line-height: 1.8; }
  .footer-link { color: #c8b89a; text-decoration: none; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <div class="logo">WanderZenAI</div>
    <div class="logo-sub">Your slow travel companion</div>
  </div>

  <div class="body">
    <div class="greeting">Welcome${safeFirstName ? `, ${safeFirstName}` : ''} ✦</div>
    <p class="intro">
      You're now part of a community of slow travelers who believe the best journeys aren't on any top-10 list.
      We're here to help you find the hidden cafés, early-morning trails, and village markets that most tourists never see.
    </p>

    <div class="cta-section">
      <a href="https://www.wanderzenai.com/plan" class="cta-btn">Plan your first trip →</a>
      <p style="font-size: 12px; color: #9a8c78; margin-top: 14px; font-style: italic;">
        Free to start · your itinerary arrives in under 3 minutes
      </p>
    </div>

    <hr class="divider" />

    <div class="section-title">What you'll get with every itinerary</div>

    <div class="feature-item">
      <div class="feature-dot">◈</div>
      <div><strong>Zero tourist traps</strong> — every recommendation avoids the top-10 lists and finds the spots locals actually go</div>
    </div>
    <div class="feature-item">
      <div class="feature-dot">◈</div>
      <div><strong>One hidden gem per day</strong> — a specific place, lane or experience most visitors never discover</div>
    </div>
    <div class="feature-item">
      <div class="feature-dot">◈</div>
      <div><strong>Insider tips included</strong> — best time to arrive, what to order, which entrance to use</div>
    </div>
    <div class="feature-item">
      <div class="feature-dot">◈</div>
      <div><strong>Beautiful PDF to keep</strong> — day-by-day with costs, maps links, local eats and your personal style</div>
    </div>

    <div class="tip-box">
      Pro tip: tell us your travel style (nature, foodie, cultural…) and we'll tailor every single recommendation to how <em>you</em> actually travel — not the average tourist.
    </div>

    <hr class="divider" />

    <p style="font-size: 13px; color: #7a6c58; line-height: 1.8;">
      Your free plan includes <strong>1 itinerary per month</strong>. Need more?
      <a href="https://www.wanderzenai.com/pricing" style="color: #4a7c59;">Upgrade any time →</a>
    </p>
  </div>

  <div class="footer">
    <div class="footer-text">
      WanderZenAI · <a href="https://www.wanderzenai.com" class="footer-link">wanderzenai.com</a><br/>
      Questions? <a href="mailto:travel@wanderzenai.com" class="footer-link">travel@wanderzenai.com</a><br/>
      <a href="https://www.wanderzenai.com/privacy" class="footer-link">Privacy Policy</a> ·
      <a href="https://www.wanderzenai.com/terms" class="footer-link">Terms</a>
    </div>
  </div>
</div>
</body>
</html>`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  }

  // The recipient is the signed-in user's own address, taken from the verified token.
  // Previously the address came from the request body, which let anyone send our branded
  // email (with injected HTML) to any inbox from our SES identity.
  // Email verification is not required: this is sent right after sign-up, before the user
  // has clicked the verification link, and it only ever goes to the token's own address.
  let user;
  try {
    user = await requireUser(event, { requireEmailVerified: false });
  } catch (err) {
    if (err instanceof AuthError) return json(err.statusCode, authErrorBody(err));
    log.error('Welcome email auth misconfigured', { error: err.message });
    return json(500, { ok: false, error: 'Authentication is temporarily unavailable' });
  }
  if (!user.email) return json(400, { ok: false, error: 'Account has no email address' });

  const blocked = await checkRateLimit(getDB(), 'welcome', userSubject(user));
  if (blocked) {
    return json(429, rateLimitBody(blocked.retryAfterSeconds), { 'Retry-After': String(blocked.retryAfterSeconds) });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* name is optional */ }
  const firstName = firstNameFrom(body.name);

  try {
    const fromEmail = process.env.FROM_EMAIL || 'travel@wanderzenai.com';

    await ses.send(new SendEmailCommand({
      Source: `WanderZenAI <${fromEmail}>`,
      Destination: { ToAddresses: [user.email] },
      Message: {
        Subject: {
          Data: `Welcome to WanderZenAI, ${firstName || 'explorer'} ✦`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: { Data: buildWelcomeHTML(escapeHtml(firstName)), Charset: 'UTF-8' },
          Text: {
            Data: `Welcome to WanderZenAI${firstName ? `, ${firstName}` : ''}!\n\nYou're now part of a community of slow travelers.\n\nPlan your first trip: https://www.wanderzenai.com/plan\n\nYour free plan includes 1 itinerary per month.\n\nQuestions? travel@wanderzenai.com`,
            Charset: 'UTF-8',
          },
        },
      },
    }));

    log.info('Welcome email sent', { uid: user.uid });
    return json(200, { ok: true });
  } catch (err) {
    // Non-blocking — don't fail signup if welcome email fails
    log.error('Welcome email failed', { error: err.message, uid: user.uid });
    return json(200, { ok: false });
  }
};

// Exported for unit tests.
exports._internal = { firstNameFrom, escapeHtml, buildWelcomeHTML };
