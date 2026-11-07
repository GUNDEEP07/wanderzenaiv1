import { fitWithin, resizeImage } from './resizeImage';

test('fitWithin keeps the aspect ratio and never upscales', () => {
  expect(fitWithin(4032, 3024)).toEqual({ width: 1920, height: 1440 });
  expect(fitWithin(3024, 4032)).toEqual({ width: 1440, height: 1920 });
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  expect(fitWithin(4000, 1000, 1600)).toEqual({ width: 1600, height: 400 });
});

test('rejects types the API does not take (HEIC, SVG, GIF)', async () => {
  await expect(resizeImage(new File(['x'], 'a.heic', { type: 'image/heic' }))).rejects.toThrow(/JPEG, PNG or WebP/);
  await expect(resizeImage(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))).rejects.toThrow(/JPEG, PNG or WebP/);
  await expect(resizeImage(null)).rejects.toThrow();
});
