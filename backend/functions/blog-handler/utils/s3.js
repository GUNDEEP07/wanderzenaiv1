'use strict';

/**
 * Blog photo storage (AWS SDK v3 from the shared layer — the old aws-sdk v2 client was never
 * bundled for Node 20 and the function had no S3 permission, so photo uploads never worked).
 *
 * Photos live in the private PDF bucket under blog/{postId}/; readers get short-lived signed
 * GET URLs, so the bucket stays private.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const READ_URL_TTL_SECONDS = 6 * 60 * 60;

let client = null;
const s3 = () => client || (client = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' }));
const bucket = () => {
  if (!process.env.PDF_BUCKET) throw new Error('PDF_BUCKET is not configured');
  return process.env.PDF_BUCKET;
};

/** Test hook: swap the S3 client and the URL signer. */
let signer = getSignedUrl;
function __setForTesting({ s3Client, sign } = {}) {
  client = s3Client || null;
  signer = sign || getSignedUrl;
}

async function putImage(key, buffer, contentType) {
  await s3().send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'private, max-age=86400',
  }));
}

async function deleteImage(key) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

/** Signed read URL; null (not a throw) if signing fails, so a page still renders. */
async function imageUrl(key) {
  try {
    return await signer(s3(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: READ_URL_TTL_SECONDS });
  } catch {
    return null;
  }
}

module.exports = { putImage, deleteImage, imageUrl, __setForTesting, READ_URL_TTL_SECONDS };
