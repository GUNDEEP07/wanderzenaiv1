// src/utils/paymentLink.js
// Stripe Payment Links don't know who our user is. Without help, Checkout asks for an
// email, and the webhook has nothing reliable to match the payment to an account.
// We pass:
//   client_reference_id — the Firebase uid (Stripe accepts alphanumerics, '-' and '_',
//                          up to 200 chars; anything else is silently dropped)
//   prefilled_email     — the account email, so receipts and the webhook agree
// The webhook (backend/functions/form-handler/stripe-webhook.js) matches on the uid first.

const SAFE_REFERENCE = /^[A-Za-z0-9_-]{1,200}$/;

/**
 * @param {string} link Stripe Payment Link URL
 * @param {{ uid?: string, email?: string } | null} user Firebase user
 * @returns {string} link with identity params, or the original link if it can't be parsed
 */
export function withCheckoutIdentity(link, user) {
  if (!link) return link;
  try {
    const url = new URL(link);
    if (user?.uid && SAFE_REFERENCE.test(user.uid)) url.searchParams.set('client_reference_id', user.uid);
    if (user?.email) url.searchParams.set('prefilled_email', user.email);
    return url.toString();
  } catch {
    return link;
  }
}
