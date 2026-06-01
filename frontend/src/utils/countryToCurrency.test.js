import { getCurrencyForCountry } from './countryToCurrency';

test('returns INR for India', () => {
  expect(getCurrencyForCountry('IN')).toBe('INR');
});

test('returns GBP for UK', () => {
  expect(getCurrencyForCountry('GB')).toBe('GBP');
});

test('returns AUD for Australia', () => {
  expect(getCurrencyForCountry('AU')).toBe('AUD');
});

test('returns EUR for Germany', () => {
  expect(getCurrencyForCountry('DE')).toBe('EUR');
});

test('returns EUR for France', () => {
  expect(getCurrencyForCountry('FR')).toBe('EUR');
});

test('returns SGD for Singapore', () => {
  expect(getCurrencyForCountry('SG')).toBe('SGD');
});

test('returns JPY for Japan', () => {
  expect(getCurrencyForCountry('JP')).toBe('JPY');
});

test('returns USD for unknown country code', () => {
  expect(getCurrencyForCountry('ZZ')).toBe('USD');
});

test('returns USD for US', () => {
  expect(getCurrencyForCountry('US')).toBe('USD');
});

test('returns USD for null/undefined', () => {
  expect(getCurrencyForCountry(null)).toBe('USD');
  expect(getCurrencyForCountry(undefined)).toBe('USD');
  expect(getCurrencyForCountry('')).toBe('USD');
});
