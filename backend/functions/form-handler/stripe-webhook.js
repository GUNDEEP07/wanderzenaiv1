'use strict';

const crypto = require('crypto');
const { getDB, log } = require('/opt/nodejs/index');

const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verify a Stripe-Signature header (https://docs.stripe.com/webhooks#verify-manually).
 * Accepts any of the v1 signatures — Stripe sends more than one while a secret is rotating.
 */
const verifyStripeSignature = (payload, signature, secret, nowSeconds = Date.now() / 1000) => {
  if (!secret) throw new Error('Webhook secret not configured');
  if (typeof signature !== 'string' || !signature) throw new Error('Missing signature');
  if (typeof payload !== 'string') throw new Error('Missing payload');

  let timestamp = null;
  const v1 = [];
  for (const part of signature.split(',')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key === 't') timestamp = val;
    if (key === 'v1') v1.push(val);
  }
  if (!timestamp || !v1.length) throw new Error('Invalid signature format');

  if (Math.abs(nowSeconds - parseInt(timestamp, 10)) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp too old');
  }

  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
  );
  const ok = v1.some(sig => {
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!ok) throw new Error('Signature mismatch');
};

// ─── Idempotency ─────────────────────────────────────────────────────────────
// Stripe retries any delivery it doesn't see a 2xx for, and may deliver an event twice.
// Without this, a retry would grant credits again. Same self-creating pattern as the
// rate limiter (CI can't reach RDS to run migrations); see migration 003.
const ENSURE_EVENTS_SQL = `
  CREATE TABLE IF NOT EXISTS stripe_events (
    id          VARCHAR(255) PRIMARY KEY,
    type        VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );`;
let ensureEventsPromise = null;
const ensureEventsTable = (db) => {
  if (!ensureEventsPromise) {
    ensureEventsPromise = db.query(ENSURE_EVENTS_SQL).catch((err) => { ensureEventsPromise = null; throw err; });
  }
  return ensureEventsPromise;
};

/** @returns {Promise<boolean>} true if this event id was already processed */
async function alreadyProcessed(client, event) {
  const { rows } = await client.query(
    `INSERT INTO stripe_events (id, type) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [event.id, event.type]
  );
  return rows.length === 0;
}

// ─── Fulfilment ──────────────────────────────────────────────────────────────
const SUBSCRIPTION_CREDITS = 5; // Pricing page: "5 itineraries per month" — see open decision in Notion
const SINGLE_PLAN_CREDITS = 1;  // Pricing page: "1 premium itinerary"

/**
 * Work out which account a completed Checkout Session belongs to.
 * Payment Links carry the Firebase uid in client_reference_id (frontend paymentLink.js).
 * customer_email is only set when the email was prefilled, so the email the customer
 * actually typed is read from customer_details.email.
 * @returns {Promise<{ email: string|null, matchedBy: string }>}
 */
async function resolveAccount(client, session) {
  const uid = session.client_reference_id;
  if (uid) {
    const { rows } = await client.query('SELECT email FROM users WHERE firebase_uid = $1 LIMIT 1', [uid]);
    if (rows.length) return { email: rows[0].email, matchedBy: 'client_reference_id' };
  }
  const email = session.customer_details?.email || session.customer_email || session.metadata?.email || null;
  return { email: email ? String(email).trim() : null, matchedBy: email ? 'checkout_email' : 'none' };
}

async function grantReferralReward(client, email) {
  const userRow = await client.query(`SELECT referred_by, referral_rewarded FROM users WHERE email = $1`, [email]);
  const user = userRow.rows[0];
  if (!user?.referred_by || user.referral_rewarded) return;

  const referrerRow = await client.query(`SELECT email FROM users WHERE referral_code = $1`, [user.referred_by]);
  if (!referrerRow.rows.length) return;
  const referrerEmail = referrerRow.rows[0].email;

  await client.query(
    `UPDATE users SET itineraries_remaining = itineraries_remaining + 1, updated_at = NOW() WHERE email = $1`,
    [referrerEmail]
  );
  await client.query(
    `UPDATE users SET itineraries_remaining = itineraries_remaining + 1, referral_rewarded = TRUE, updated_at = NOW() WHERE email = $1`,
    [email]
  );
  log.info('Referral reward granted', { referrerEmail, refereeEmail: email });
}

async function fulfilCheckout(client, session) {
  // Async payment methods complete the session before the money arrives; those are
  // fulfilled on checkout.session.async_payment_succeeded instead.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    log.info('Checkout completed but not paid yet — waiting for async payment', { sessionId: session.id, status: session.payment_status });
    return { fulfilled: false, reason: 'not_paid' };
  }

  const { email, matchedBy } = await resolveAccount(client, session);
  if (!email) {
    // Returning 200 stops Stripe retrying an event we can never match; the ERROR log is the alert.
    log.error('Paid checkout could not be matched to an account', { sessionId: session.id, customer: session.customer });
    return { fulfilled: false, reason: 'no_account' };
  }

  const isSubscription = session.mode === 'subscription';
  const plan = isSubscription ? 'subscriber' : 'paid_once';
  const credits = isSubscription ? SUBSCRIPTION_CREDITS : SINGLE_PLAN_CREDITS;

  await client.query(
    `INSERT INTO users (email, plan, itineraries_remaining, stripe_customer_id, stripe_subscription_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (email) DO UPDATE
     SET plan = CASE WHEN users.plan = 'subscriber' AND EXCLUDED.plan = 'paid_once' THEN 'subscriber' ELSE EXCLUDED.plan END,
         itineraries_remaining = users.itineraries_remaining + $3,
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, users.stripe_customer_id),
         stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, users.stripe_subscription_id),
         updated_at = NOW()`,
    [email, plan, credits, session.customer || null, session.subscription || null]
  );
  log.info('User plan upgraded', { email, plan, credits, matchedBy, sessionId: session.id });

  try {
    await grantReferralReward(client, email);
  } catch (refErr) {
    log.warn('Referral reward failed', { error: refErr.message });
  }
  return { fulfilled: true, email, plan, credits, matchedBy };
}

exports.handler = async (event) => {
  const headers = event.headers || {};
  const signature = headers['Stripe-Signature'] || headers['stripe-signature'];
  // API Gateway may base64-encode the body; Stripe signs the raw bytes.
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body;

  try {
    verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    log.warn('Stripe webhook signature verification failed', { error: err.message });
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payload' }) };
  }
  log.info('Stripe event received', { type: stripeEvent.type, id: stripeEvent.id });

  const db = getDB();
  const client = await db.connect();
  try {
    await ensureEventsTable(client);
    await client.query('BEGIN');

    if (await alreadyProcessed(client, stripeEvent)) {
      await client.query('ROLLBACK');
      log.info('Duplicate Stripe event ignored', { id: stripeEvent.id, type: stripeEvent.type });
      return { statusCode: 200, body: JSON.stringify({ received: true, duplicate: true }) };
    }

    switch (stripeEvent.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await fulfilCheckout(client, stripeEvent.data.object);
        break;

      case 'checkout.session.async_payment_failed':
        log.warn('Async checkout payment failed', { sessionId: stripeEvent.data.object.id });
        break;

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        await client.query(
          `UPDATE users SET plan = 'free', updated_at = NOW() WHERE stripe_customer_id = $1`,
          [sub.customer]
        );
        log.info('Subscription cancelled', { customerId: sub.customer });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        log.warn('Payment failed', { customerId: invoice.customer });
        break;
      }

      default:
        log.info('Unhandled Stripe event type', { type: stripeEvent.type });
    }

    // Event id and its effects commit together: a failure rolls back both, so Stripe's
    // retry is processed cleanly rather than being treated as a duplicate.
    await client.query('COMMIT');
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    log.error('Stripe webhook processing error', { error: err.message, type: stripeEvent.type, id: stripeEvent.id });
    return { statusCode: 500, body: JSON.stringify({ error: 'Processing failed' }) };
  } finally {
    client.release();
  }
};

// Exported for unit tests.
exports._internal = { verifyStripeSignature, resolveAccount, fulfilCheckout };
