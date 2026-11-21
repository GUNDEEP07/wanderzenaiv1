import { formatPrice, visitorCountry } from '../api/pricing';
import { passTerm } from '../hooks/usePricing';
import { plansFrom, priceLines } from './plans';
import { entitlementLine } from '../components/plantrip/StepReview';
jest.mock('../api/itinerary', () => ({ fetchPreview: jest.fn() }));

const trip = { plan: 'trip', name: 'One trip', trips: 1, validDays: null, currency: 'AUD', amount: 19, url: 'https://buy.stripe.com/test_trip' };
const pass = { plan: 'pass', name: 'Trip Pass', trips: 6, validDays: 365, currency: 'AUD', amount: 59, url: 'https://buy.stripe.com/test_pass' };

test('prices always name their currency', () => {
  expect(formatPrice(19, 'AUD')).toBe('A$19 AUD');
  expect(formatPrice(13, 'USD')).toBe('$13 USD');
  expect(formatPrice(12.5, 'EUR')).toBe('€12.50 EUR');
  expect(formatPrice(1900, 'JPY')).toBe('¥1,900 JPY');
  expect(formatPrice(undefined, 'AUD')).toBe('');
});

test('visitor country from the time zone, only to pick a display currency', () => {
  expect(visitorCountry('Australia/Sydney')).toBe('AU');
  expect(visitorCountry('America/Chicago')).toBe('US');
  expect(visitorCountry('America/Toronto')).toBe('CA');
  expect(visitorCountry('Asia/Kolkata')).toBe('IN');
  expect(visitorCountry('Antarctica/Troll')).toBe('');
});

test('plans come from Stripe data; nothing to buy until prices load', () => {
  const loading = plansFrom({ trip: null, pass: null, loading: true });
  expect(loading.map(p => p.price)).toEqual(['Free', '…', '…']);
  expect(loading.filter(p => p.buy).every(p => p.link === null)).toBe(true);
  const ready = plansFrom({ trip, pass, loading: false });
  expect(ready[1]).toMatchObject({ name: 'One trip', price: 'A$19 AUD', priceParts: { main: 'A$19', code: 'AUD' }, link: trip.url, featured: true });
  expect(ready[2]).toMatchObject({ name: 'Trip Pass', price: 'A$59 AUD', link: pass.url, period: 'one-time · 6 trips · use within 12 months' });
  expect(JSON.stringify(ready)).not.toMatch(/Wanderer|\/mo/);
});

test('pass term and the Review step line', () => {
  expect(passTerm({ trips: 3, validDays: 180 })).toBe('3 trips · use within 6 months');
  expect(entitlementLine({ allowed: true, source: 'pass', remaining: 4 })).toBe('Uses 1 of the 4 trips on your Trip Pass.');
  expect(entitlementLine({ allowed: true, source: 'pass', remaining: 1 })).toBe('Uses the last trip on your Trip Pass.');
});

test('price lines for the hero and planner come from Stripe, never invented', () => {
  expect(priceLines({ trip: null, pass: null })).toBeNull();
  expect(priceLines()).toBeNull();
  const p = priceLines({ trip, pass });
  expect(p.hero).toBe('Full trip A$19 AUD, or 6 trips for A$59 AUD');
  expect(p.trip).toBe('A$19 AUD');
  expect(p.passTerm).toBe('6 trips · use within 12 months');
  expect(priceLines({ trip, pass: null }).hero).toBe('Full trip A$19 AUD');
});
