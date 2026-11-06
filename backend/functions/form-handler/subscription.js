'use strict';

/**
 * Wanderer subscription = 5 itineraries per billing month (Pricing page), no rollover.
 *
 * users.monthly_remaining holds what is left this billing month. It is set to 5 when the
 * subscription starts (checkout.session.completed) and reset to 5 on every renewal
 * (invoice.paid with billing_reason 'subscription_cycle'). Purchased Single Plan and
 * referral credits stay in users.itineraries_remaining and are spent only after the
 * monthly allowance, so they never expire.
 *
 * The column creates itself on first use (CI cannot reach RDS to run migrations);
 * infra/migrations/004_add_monthly_remaining.sql documents it.
 */

const SUBSCRIPTION_MONTHLY_ITINERARIES = 5;

const ENSURE_MONTHLY_COLUMN_SQL =
  'ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_remaining INTEGER NOT NULL DEFAULT 0';

const UNDEFINED_COLUMN = '42703';

/**
 * Run fn(db); if it fails because monthly_remaining does not exist yet, add the column
 * and run fn once more. Not for use inside an open transaction (the error aborts it).
 */
async function withMonthlyColumn(db, fn) {
  try {
    return await fn(db);
  } catch (err) {
    if (err?.code !== UNDEFINED_COLUMN || !/monthly_remaining/.test(err.message || '')) throw err;
    await db.query(ENSURE_MONTHLY_COLUMN_SQL);
    return fn(db);
  }
}

module.exports = {
  SUBSCRIPTION_MONTHLY_ITINERARIES, ENSURE_MONTHLY_COLUMN_SQL, withMonthlyColumn, UNDEFINED_COLUMN,
};
