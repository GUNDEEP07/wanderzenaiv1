import { getFallbackPhoto } from './destinationPhotos';

test('photos are requested wide enough for retina screens and never pre-cropped short', () => {
  const u = new URL(getFallbackPhoto('card'));
  expect(Number(u.searchParams.get('w'))).toBeGreaterThanOrEqual(900);
  expect(u.searchParams.has('h')).toBe(false);
  expect(u.searchParams.get('fit')).toBe('max');
  expect(Number(new URL(getFallbackPhoto('hero')).searchParams.get('w'))).toBeGreaterThanOrEqual(1800);
});
