const COUNTRY_TO_CURRENCY = {
  // South Asia
  IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR',
  // East Asia
  JP: 'JPY', CN: 'CNY', KR: 'KRW', HK: 'HKD', TW: 'TWD',
  // Southeast Asia
  SG: 'SGD', MY: 'MYR', TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND',
  // Middle East
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD',
  // Oceania
  AU: 'AUD', NZ: 'NZD',
  // Americas
  CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP',
  // UK
  GB: 'GBP',
  // Europe (EUR zone)
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', PT: 'EUR',
  BE: 'EUR', AT: 'EUR', GR: 'EUR', FI: 'EUR', IE: 'EUR', LU: 'EUR',
  // Europe (non-EUR)
  SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY',
  // Africa
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', EG: 'EGP', GH: 'GHS', ET: 'ETB',
  // Russia / CIS
  RU: 'RUB', UA: 'UAH',
  // US
  US: 'USD',
};

/**
 * Returns the ISO 4217 currency code for a given ISO 3166-1 alpha-2 country code.
 * Falls back to 'USD' for unknown codes.
 */
export function getCurrencyForCountry(countryCode) {
  if (!countryCode) return 'USD';
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] || 'USD';
}
