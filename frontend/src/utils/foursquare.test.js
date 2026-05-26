import { formatRating } from './foursquare.js';

test('formatRating formats rating correctly', () => {
  expect(formatRating(4.8)).toBe('⭐ 4.8');
  expect(formatRating(4.0)).toBe('⭐ 4.0');
  expect(formatRating(3.55)).toBe('⭐ 3.5');
  expect(formatRating(null)).toBe(null);
});
