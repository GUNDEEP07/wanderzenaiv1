import { companionTrip, tripPlace, tripSuggestions } from './companion';

const NOW = new Date('2026-11-22T03:00:00Z');
const t = (id, o = {}) => ({ id, status: 'email_sent', days: 5, travelDate: null, createdAt: '2026-11-20T00:00:00Z', destination: 'Queenstown, New Zealand', ...o });

test('upcoming or under-way trip, soonest first', () => {
  expect(companionTrip([t('later', { travelDate: '2027-03-01' }), t('soon', { travelDate: '2026-12-10' }), t('over', { travelDate: '2026-10-01' })], NOW).id).toBe('soon');
  expect(companionTrip([t('now', { travelDate: '2026-11-20' })], NOW).id).toBe('now');
});

test('else the newest undated trip from the last 120 days; nothing otherwise', () => {
  expect(companionTrip([t('a', { createdAt: '2026-10-01T00:00:00Z' }), t('b')], NOW).id).toBe('b');
  expect(companionTrip([t('old', { createdAt: '2026-05-01T00:00:00Z' })], NOW)).toBeNull();
  expect(companionTrip([t('x', { status: 'processing' })], NOW)).toBeNull();
  expect(companionTrip(undefined, NOW)).toBeNull();
});

test('place name and starters', () => {
  expect(tripPlace(t('a'))).toBe('Queenstown');
  expect(tripSuggestions(t('a'))).toContain('What should I pack for this trip?');
  expect(tripSuggestions(t('a', { locked: true }))).toContain('What do I get if I unlock every day?');
});
