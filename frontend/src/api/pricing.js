// GET /pricing — plans, prices and payment links from Stripe (pricing design D, Nov 16 2026).
// Nothing about prices is hard-coded in the app: change them in Stripe and the site follows.
const API_URL = import.meta.env.VITE_API_URL;

/** Rough country from the browser time zone — only to pick the display currency. */
const TZ_COUNTRY = {
  Australia: 'AU', 'Pacific/Auckland': 'NZ', 'Asia/Singapore': 'SG', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Tokyo': 'JP', 'Asia/Hong_Kong': 'HK', 'Asia/Dubai': 'AE', 'Europe/London': 'GB', 'Europe/Dublin': 'IE',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', America: 'US',
  'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
  'Europe/Lisbon': 'PT', 'Europe/Vienna': 'AT', 'Europe/Brussels': 'BE', 'Europe/Helsinki': 'FI', 'Europe/Athens': 'GR',
};
export function visitorCountry(timeZone) {
  let tz = timeZone;
  if (!tz) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = ''; } }
  return TZ_COUNTRY[tz] || TZ_COUNTRY[String(tz).split('/')[0]] || '';
}

/** "A$19 AUD", "US$13 USD", "¥1,900 JPY" — the currency is always written out. */
export function formatPrice(amount, currency) {
  if (typeof amount !== 'number' || !currency) return '';
  try {
    const n = new Intl.NumberFormat('en-US', {
      style: 'currency', currency, currencyDisplay: 'symbol',
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2,
    }).format(amount);
    return `${n} ${currency}`;
  } catch {
    return `${amount} ${currency}`;
  }
}

/** @returns {Promise<{ country: string|null, plans: Array<{ plan: 'trip'|'pass', name: string, description: string, trips: number, validDays: number|null, currency: string, amount: number, url: string }> }>} */
export async function fetchPricing(country = visitorCountry()) {
  const qs = country ? `?country=${encodeURIComponent(country)}` : '';
  const res = await fetch(`${API_URL}/pricing${qs}`);
  if (!res.ok) throw new Error(`Pricing unavailable (${res.status})`);
  const json = await res.json();
  return json.data;
}
