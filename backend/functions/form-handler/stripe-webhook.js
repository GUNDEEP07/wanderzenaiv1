'use strict';

const crypto = require('crypto');
const { getDB, log } = require('/opt/nodejs/index');

const verifyStripeSignature = (payload, signature, secret) => {
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    acc[key] = val;
    return acc;
  }, {});

  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) throw new Error('Invalid signature format');

  // Reject webhooks older than 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) {
    throw new Error('Webhook timestamp too old');
  }

  const signedPayload = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedSig))) {
    throw new Error('Signature mismatch');
  }
};

exports.handler = async (event) => {
  const signature = event.headers['Stripe-Signature'] || event.headers['stripe-signature'];
  const rawBody = event.body;

  try {
    verifyStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    log.warn('Stripe webhook signature verification failed', { error: err.message });
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  const stripeEvent = JSON.parse(rawBody);
  log.info('Stripe event received', { type: stripeEvent.type });

  const db = getDB();

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const email = session.customer_email || session.metadata?.email;
        const plan = session.mode === 'subscription' ? 'subscriber' : 'paid_once';
        const itinerariesGranted = session.mode === 'subscription' ? 5 : 1;

        await db.query(
          `INSERT INTO users (email, plan, itineraries_remaining, stripe_customer_id, created_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (email) DO UPDATE
           SET plan = EXCLUDED.plan,
               itineraries_remaining = users.itineraries_remaining + $3,
               stripe_customer_id = EXCLUDED.stripe_customer_id,
               updated_at = NOW()`,
          [email, plan, itinerariesGranted, session.customer]
        );

        log.info('User plan upgraded', { email, plan, itinerariesGranted });

        // ── Referral reward ──────────────────────────────────────────────
        // If this is the purchaser's first paid transaction, reward both them and their referrer
        try {
          const userRow = await db.query(
            `SELECT referred_by, referral_rewarded FROM users WHERE email = $1`,
            [email]
          );
          const user = userRow.rows[0];
          if (user?.referred_by && !user?.referral_rewarded) {
            // Find referrer by their referral_code
            const referrerRow = await db.query(
              `SELECT email FROM users WHERE referral_code = $1`,
              [user.referred_by]
            );
            if (referrerRow.rows.length > 0) {
              const referrerEmail = referrerRow.rows[0].email;
              // Give referrer 1 free itinerary
              await db.query(
                `UPDATE users SET itineraries_remaining = itineraries_remaining + 1, updated_at = NOW() WHERE email = $1`,
                [referrerEmail]
              );
              // Give referee 1 free itinerary bonus
              await db.query(
                `UPDATE users SET itineraries_remaining = itineraries_remaining + 1, referral_rewarded = TRUE, updated_at = NOW() WHERE email = $1`,
                [email]
              );
              log.info('Referral reward granted', { referrerEmail, refereeEmail: email });
            }
          }
        } catch (refErr) {
          log.warn('Referral reward failed', { error: refErr.message });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        await db.query(
          `UPDATE users SET plan = 'free', updated_at = NOW()
           WHERE stripe_customer_id = $1`,
          [sub.customer]
        );
        log.info('Subscription cancelled', { customerId: sub.customer });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = stripeEvent.data.object;
        log.warn('Payment failed', { customerId: invoice.customer });
        // Could trigger a dunning email here via SES
        break;
      }

      default:
        log.info('Unhandled Stripe event type', { type: stripeEvent.type });
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };

  } catch (err) {
    log.error('Stripe webhook processing error', { error: err.message, type: stripeEvent.type });
    return { statusCode: 500, body: JSON.stringify({ error: 'Processing failed' }) };
  }
};
