import { getCountryFlag, isValidCountryCode } from './countryFlags';

test('getCountryFlag returns flag emoji for valid country code', () => {
  expect(getCountryFlag('TH')).toBe('🇹🇭');
  expect(getCountryFlag('US')).toBe('🇺🇸');
  expect(getCountryFlag('FR')).toBe('🇫🇷');
});

test('getCountryFlag returns globe emoji for invalid country code', () => {
  expect(getCountryFlag('XX')).toBe('🌍');
  expect(getCountryFlag(null)).toBe('🌍');
  expect(getCountryFlag('')).toBe('🌍');
});

test('getCountryFlag handles lowercase country codes', () => {
  expect(getCountryFlag('th')).toBe('🇹🇭');
  expect(getCountryFlag('us')).toBe('🇺🇸');
});

test('isValidCountryCode validates correctly', () => {
  expect(isValidCountryCode('TH')).toBe(true);
  expect(isValidCountryCode('th')).toBe(true);
  expect(isValidCountryCode('XX')).toBe(false);
  expect(isValidCountryCode(null)).toBe(false);
});
