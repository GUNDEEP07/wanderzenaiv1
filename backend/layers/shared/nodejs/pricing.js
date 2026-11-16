'use strict';

/**
 * Prices come from Stripe, not from code (pricing design D, Nov 16 2026: "keep it dynamic, and
 * different prices by location in future"). The catalog is every ACTIVE product whose metadata
 * has wz_plan ('trip' | 'pass') plus its active payment link with the same wz_plan:
 *   product.metadata: wz_plan, trips, valid_days      default_price: amount + currency (AUD today)
 *   default_price.currency_options: per-currency amounts → location pricing, no code change
 * Change a price in the Stripe dashboard (new default price) and the site follows within
 * CACHE_MS. Stripe Payment Links show the same multi-currency price in the buyer's currency.
 */

const STRIPE_API = 'https://api.stripe.com/v1';
const CACHE_MS = 10 * 60 * 1000;
const PLANS = ['trip', 'pass'];

/** Country (ISO 3166-1 alpha-2) → the currency we'd like to show there, if Stripe has it. */
const EURO = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
const COUNTRY_CURRENCY = {
  AU: 'aud', NZ: 'nzd', US: 'usd', GB: 'gbp', CA: 'cad', SG: 'sgd', IN: 'inr', JP: 'jpy', HK: 'hkd', AE: 'aed',
  ...Object.fromEntries(EURO.map(c => [c, 'eur'])),
};
const ZERO_DECIMAL = new Set(['jpy', 'krw', 'vnd', 'clp', 'pyg', 'ugx', 'xaf', 'xof']);

let cache = null; // { at, catalog }

async function stripeGet(path, params, { secretKey, fetchImpl }) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetchImpl(`${STRIPE_API}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    let reason = '';
    try { reason = (await res.json())?.error?.message || ''; } catch { /* not JSON */ }
    throw new Error(`Stripe ${path} ${res.status}${reason ? `: ${reason.slice(0, 160)}` : ''}`);
  }
  return res.json();
}

/** Pure: Stripe products + payment links → our plan list (only plans that can be bought). */
function buildCatalog(products = [], links = []) {
  const plans = [];
  for (const p of products) {
    const plan = p?.metadata?.wz_plan;
    const price = p?.default_price;
    if (!p.active || !PLANS.includes(plan) || !price || typeof price !== 'object' || !price.active) continue;
    const link = links.find(l => l.active && l.metadata?.wz_plan === plan);
    if (!link?.url) continue;
    const options = {};
    for (const [cur, opt] of Object.entries(price.currency_options || {})) {
      if (Number.isInteger(opt?.unit_amount)) options[cur] = opt.unit_amount;
    }
    options[price.currency] = price.unit_amount;
    plans.push({
      plan,
      name: p.name,
      description: p.description || '',
      trips: Math.max(1, Number.parseInt(p.metadata.trips, 10) || 1),
      validDays: plan === 'pass' ? Math.max(1, Number.parseInt(p.metadata.valid_days, 10) || 365) : null,
      currency: price.currency,
      amounts: options,
      url: link.url,
    });
  }
  return plans.sort((a, b) => PLANS.indexOf(a.plan) - PLANS.indexOf(b.plan));
}

/** The catalog, from Stripe at most every CACHE_MS; the last good copy if Stripe is down. */
async function getCatalog({ secretKey, fetchImpl = fetch, now = Date.now(), log = console } = {}) {
  if (cache && now - cache.at < CACHE_MS) return cache.catalog;
  try {
    const opts = { secretKey, fetchImpl };
    const [products, links] = await Promise.all([
      stripeGet('/products/search', {
        // Stripe search can't mix AND with OR (or use brackets): match the plans, filter active in code.
        query: PLANS.map(p => `metadata['wz_plan']:'${p}'`).join(' OR '),
        'expand[]': 'data.default_price.currency_options',
        limit: '20',
      }, opts),
      stripeGet('/payment_links', { active: 'true', limit: '100' }, opts),
    ]);
    const catalog = buildCatalog(products.data, links.data);
    cache = { at: now, catalog };
    return catalog;
  } catch (err) {
    log.warn?.('Pricing: Stripe unavailable', { error: err.message });
    if (cache) return cache.catalog;
    throw err;
  }
}

/** Minor units → a display number (2 decimals unless the currency has none). */
const toMajor = (amount, currency) => (ZERO_DECIMAL.has(currency) ? amount : amount / 100);

/**
 * The plans for a visitor's country: their currency when Stripe has a price in it,
 * otherwise each price's own currency (AUD today). Always says which currency.
 */
function priceFor(catalog, country) {
  const wanted = COUNTRY_CURRENCY[String(country || '').toUpperCase()] || null;
  return catalog.map(p => {
    const currency = wanted && Number.isInteger(p.amounts[wanted]) ? wanted : p.currency;
    return {
      plan: p.plan, name: p.name, description: p.description, trips: p.trips, validDays: p.validDays,
      currency: currency.toUpperCase(),
      amount: toMajor(p.amounts[currency], currency),
      url: p.url,
    };
  });
}

module.exports = {
  buildCatalog, getCatalog, priceFor, COUNTRY_CURRENCY, CACHE_MS,
  _reset: () => { cache = null; },
};
