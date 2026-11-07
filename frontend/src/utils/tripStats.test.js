import { timeAgo, lastPlanHeadline, extractCountry } from './tripStats';

const NOW = Date.parse('2026-11-07T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();

test('timeAgo: today / yesterday instead of "0 days ago"', () => {
  expect(timeAgo(daysAgo(0), NOW)).toBe('today');
  expect(timeAgo(daysAgo(1), NOW)).toBe('yesterday');
  expect(timeAgo(daysAgo(3), NOW)).toBe('3 days ago');
  expect(timeAgo(daysAgo(14), NOW)).toBe('2 weeks ago');
  expect(timeAgo(daysAgo(400), NOW)).toBe('1 year ago');
  expect(timeAgo(null)).toBeNull();
});

test('headline talks about planning, with correct grammar', () => {
  expect(lastPlanHeadline(daysAgo(0), 'Vietnam', NOW)).toBe('You planned Vietnam today.');
  expect(lastPlanHeadline(daysAgo(12), 'Kyoto, Japan', NOW)).toBe("It's been 1 week since you planned Kyoto.");
  expect(lastPlanHeadline(null, 'Vietnam', NOW)).toBeNull();
});

test('countries from destinations as typed; towns alone are not countries', () => {
  expect(extractCountry('Hoi An')).toBe('Vietnam');
  expect(extractCountry('sydney')).toBe('Australia');
  expect(extractCountry('Slovenia')).toBe('Slovenia');
  expect(extractCountry('Kyoto, Japan')).toBe('Japan');
  expect(extractCountry('triund')).toBe('India');
  expect(extractCountry('Huế, Vietnam')).toBe('Vietnam');
  expect(extractCountry('Somewhere Unknown')).toBeNull();
  expect(extractCountry('Tromsø, norway')).toBe('Norway');
  expect(extractCountry('Splitville')).toBeNull(); // "split" must match a whole word only
});
