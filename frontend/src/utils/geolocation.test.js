import { getUserLocationFromIP } from './geolocation';

test('getUserLocationFromIP returns location object with country, city', async () => {
  const result = await getUserLocationFromIP();
  expect(result).toHaveProperty('country');
  expect(result).toHaveProperty('city');
  expect(result).toHaveProperty('countryCode');
  expect(typeof result.countryCode).toBe('string');
  expect(result.countryCode.length).toBe(2);
});

test('getUserLocationFromIP falls back gracefully on network error', async () => {
  global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
  const result = await getUserLocationFromIP();
  expect(result).toEqual({ country: 'Unknown', city: 'Unknown', countryCode: 'US', latitude: null, longitude: null });
});
