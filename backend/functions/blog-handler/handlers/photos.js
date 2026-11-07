'use strict';

/**
 * Blog photos (Nov 2026). Only the WanderZen team writes stories, so only admins add or
 * remove photos. The editor resizes each image in the browser (which also drops EXIF/GPS
 * data) and sends it as base64; this handler checks the real file type from its bytes,
 * stores it privately in S3 and serves it through short-lived signed URLs.
 *
 * Replaces the old request/confirm flow, which never worked: the function had no S3
 * permission and the signed PUT demanded a body of exactly 10 MB.
 */

const { randomUUID } = require('crypto');
const blog = require('../db/blog');
const s3 = require('../utils/s3');
const errors = require('../utils/errors');
const { log } = require('/opt/nodejs/index');

const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Decoded size cap. Base64 adds a third, and a Lambda request body tops out at 6 MB. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_CAPTION = 200;

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  'Content-Type': 'application/json',
};
const respond = (statusCode, payload) => ({ statusCode, headers: corsHeaders, body: JSON.stringify(payload) });
const success = (data, statusCode = 200) => respond(statusCode, { success: true, data });
const forbidden = () => respond(403, { success: false, error: 'Only the WanderZen team can change story photos' });

/** File type from magic bytes — never from a file name or a client-sent MIME type. */
function sniffImage(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', contentType: 'image/png' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', contentType: 'image/webp' };
  return null;
}

/** "data:image/jpeg;base64,AAAA" or bare base64 → Buffer, or null if it isn't valid base64. */
function decodeImage(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const b64 = raw.replace(/^data:[^;,]{1,50};base64,/, '');
  if (b64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) return 'too_large';
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  return Buffer.from(b64, 'base64');
}

/** Caption: optional, plain text, control characters removed, at most 200 chars. */
function cleanCaption(raw) {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'string') return { error: 'Caption must be text' };
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (value.length > MAX_CAPTION) return { error: `Caption: at most ${MAX_CAPTION} characters` };
  return { value: value || null };
}

/** Row → what the page needs (no S3 key). */
async function viewPhoto(row) {
  return { id: row.id, url: await s3.imageUrl(row.s3_key), caption: row.caption || null, display_order: row.display_order };
}

const photosFor = async (postId) => Promise.all((await blog.listPhotos(postId)).map(viewPhoto));

/** POST /blog/{id}/photos  body { image: base64|dataURL, caption? } */
async function uploadPhoto(postId, body, viewer = {}) {
  if (!viewer.userId) return errors.unauthorized();
  if (!ADMIN_ROLES.has(viewer.userRole)) return forbidden();
  if (!UUID_RE.test(postId || '')) return errors.notFound('Post not found');

  const buf = decodeImage(body?.image);
  if (buf === 'too_large' || (buf && buf.length > MAX_IMAGE_BYTES)) return errors.badRequest('That photo is too large (max 4 MB after resizing)');
  if (!buf) return errors.badRequest('Send the photo as base64 in "image"');
  const type = sniffImage(buf);
  if (!type) return errors.badRequest('Photos must be JPEG, PNG or WebP');
  const caption = cleanCaption(body?.caption);
  if (caption.error) return errors.badRequest(caption.error);

  try {
    if (!(await blog.postExists(postId))) return errors.notFound('Post not found');
    const key = `blog/${postId}/${randomUUID()}.${type.ext}`;
    await s3.putImage(key, buf, type.contentType);
    const row = await blog.addPhoto(postId, key, caption.value);
    if (!row) {
      await s3.deleteImage(key).catch(() => {});
      return errors.badRequest(`A story can have at most ${blog.MAX_PHOTOS_PER_POST} photos`);
    }
    log.info('Blog photo added', { postId, photoId: row.id, bytes: buf.length, type: type.ext });
    return success(await viewPhoto(row), 201);
  } catch (err) {
    log.error('Blog photo upload failed', { postId, error: err.message });
    return errors.serverError('Could not save the photo');
  }
}

/** PUT /blog/{id}/photos/{photoId}  body { caption } */
async function updatePhoto(postId, photoId, body, viewer = {}) {
  if (!viewer.userId) return errors.unauthorized();
  if (!ADMIN_ROLES.has(viewer.userRole)) return forbidden();
  if (!UUID_RE.test(postId || '') || !UUID_RE.test(photoId || '')) return errors.notFound('Photo not found');
  const caption = cleanCaption(body?.caption);
  if (caption.error) return errors.badRequest(caption.error);
  try {
    const row = await blog.updatePhotoCaption(postId, photoId, caption.value);
    return row ? success(await viewPhoto(row)) : errors.notFound('Photo not found');
  } catch (err) {
    log.error('Blog photo caption failed', { postId, photoId, error: err.message });
    return errors.serverError('Could not save the caption');
  }
}

/** DELETE /blog/{id}/photos/{photoId} */
async function deletePhoto(postId, photoId, viewer = {}) {
  if (!viewer.userId) return errors.unauthorized();
  if (!ADMIN_ROLES.has(viewer.userRole)) return forbidden();
  if (!UUID_RE.test(postId || '') || !UUID_RE.test(photoId || '')) return errors.notFound('Photo not found');
  try {
    const key = await blog.deletePhoto(postId, photoId);
    if (!key) return errors.notFound('Photo not found');
    // The row is gone, so the photo no longer shows; a failed object delete only leaves an orphan.
    await s3.deleteImage(key).catch(err => log.warn('Blog photo object not deleted', { key, error: err.message }));
    return { statusCode: 204, headers: corsHeaders, body: '' };
  } catch (err) {
    log.error('Blog photo delete failed', { postId, photoId, error: err.message });
    return errors.serverError('Could not delete the photo');
  }
}

/** GET /blog/{id}/photos — published posts for everyone; drafts for their author and admins. */
async function listPhotos(postId, viewer = {}) {
  if (!UUID_RE.test(postId || '')) return errors.notFound('Post not found');
  try {
    // getPost applies the visibility rule (published, or the author's own, or an admin).
    const post = await blog.getPost(postId, viewer.userId || null, viewer.userRole || null);
    if (!post) return errors.notFound('Post not found');
    return success(await photosFor(postId));
  } catch (err) {
    log.error('List blog photos failed', { postId, error: err.message });
    return errors.serverError('Failed to list photos');
  }
}

/** Remove every photo object of a post (after the post row — and so its photo rows — is deleted). */
async function deleteObjects(keys) {
  await Promise.all(keys.map(k => s3.deleteImage(k).catch(err => log.warn('Blog photo object not deleted', { key: k, error: err.message }))));
}

module.exports = {
  uploadPhoto, updatePhoto, deletePhoto, listPhotos, photosFor, deleteObjects, viewPhoto,
  _internal: { sniffImage, decodeImage, cleanCaption, MAX_IMAGE_BYTES },
};
