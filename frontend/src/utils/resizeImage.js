/**
 * Shrink a photo in the browser before upload (blog editor).
 *
 * - Longest side at most 1920 px, JPEG — a phone photo goes from ~5 MB to ~400 KB.
 * - Re-drawing on a canvas drops EXIF, so GPS location in phone photos is never published.
 * - Phone photos stored sideways are turned upright (EXIF orientation is applied first).
 */

export const MAX_SIDE = 1920;
const MAX_BYTES = 3.5 * 1024 * 1024; // the API takes up to 4 MB
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Target size keeping the aspect ratio; never upscales. */
export function fitWithin(width, height, maxSide = MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const toDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read the resized photo'));
  reader.readAsDataURL(blob);
});

/**
 * @param {File} file
 * @returns {Promise<string>} data:image/jpeg;base64,… ready for uploadPhoto()
 */
export async function resizeImage(file) {
  if (!file || !ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Use a JPEG, PNG or WebP photo (iPhone HEIC: export as JPEG first)');
  }
  const source = await decode(file);
  const w = source.width || source.naturalWidth;
  const h = source.height || source.naturalHeight;
  if (!w || !h) throw new Error('That photo could not be read');

  try {
    for (const [side, quality] of [[MAX_SIDE, 0.85], [1600, 0.75], [1280, 0.7]]) {
      const size = fitWithin(w, h, side);
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // transparent PNGs get a white, not black, background
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(source, 0, 0, size.width, size.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_BYTES) return toDataUrl(blob);
    }
  } finally {
    source.close?.(); // ImageBitmap memory
  }
  throw new Error('That photo is too large even after resizing');
}
