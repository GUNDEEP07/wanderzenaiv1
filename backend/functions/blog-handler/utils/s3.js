'use strict';

const AWS = require('aws-sdk');
const { log } = require('/opt/nodejs/index');

const s3 = new AWS.S3({ region: 'ap-southeast-2' });

const generateS3SignedUrl = async (s3Key, expiresIn = 604800) => {
  try {
    if (!s3Key || typeof s3Key !== 'string') {
      throw new Error('S3 key is required');
    }

    if (typeof expiresIn !== 'number' || expiresIn < 1) {
      throw new Error('Expiration time must be a positive number');
    }

    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.PDF_BUCKET,
      Key: s3Key,
      Expires: expiresIn,
    });

    log.info('Generated S3 signed URL', { s3Key, expiresIn });
    return url;
  } catch (err) {
    log.error('Failed to generate S3 signed URL', { s3Key, error: err.message });
    throw err;
  }
};

const deleteS3Object = async (s3Key) => {
  try {
    if (!s3Key || typeof s3Key !== 'string') {
      throw new Error('S3 key is required');
    }

    await s3.deleteObject({
      Bucket: process.env.PDF_BUCKET,
      Key: s3Key,
    }).promise();

    log.info('Deleted S3 object', { s3Key });
  } catch (err) {
    log.error('Failed to delete S3 object', { s3Key, error: err.message });
    throw err;
  }
};

/**
 * Map file extension to MIME type
 * @param {string} extension — File extension (without dot)
 * @returns {string} MIME type
 * @throws {Error} If extension is not allowed
 */
const getContentTypeFromExtension = (extension) => {
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };

  const lowerExt = extension.toLowerCase();
  if (!mimeTypes[lowerExt]) {
    throw new Error(`Photo format not allowed: ${extension}. Allowed: jpg, jpeg, png, webp, gif`);
  }

  return mimeTypes[lowerExt];
};

const generateS3SignedPutUrl = async (s3Key, expiresIn = 3600) => {
  try {
    if (!s3Key || typeof s3Key !== 'string') {
      throw new Error('S3 key is required');
    }

    if (typeof expiresIn !== 'number' || expiresIn < 1) {
      throw new Error('Expiration time must be a positive number');
    }

    // Extract file extension from s3Key (last part after the dash in filename)
    const fileName = s3Key.split('/').pop(); // Get filename from key
    const extension = fileName.split('.').pop(); // Get extension

    // Validate and get MIME type
    const contentType = getContentTypeFromExtension(extension);

    // 10MB limit in bytes
    const maxContentLength = 10 * 1024 * 1024;

    const url = s3.getSignedUrl('putObject', {
      Bucket: process.env.PDF_BUCKET,
      Key: s3Key,
      Expires: expiresIn,
      ContentType: contentType,
      ContentLength: maxContentLength,
    });

    log.info('Generated S3 signed PUT URL', { s3Key, expiresIn, contentType });
    return url;
  } catch (err) {
    log.error('Failed to generate S3 signed PUT URL', { s3Key, error: err.message });
    throw err;
  }
};

module.exports = {
  generateS3SignedUrl,
  deleteS3Object,
  generateS3SignedPutUrl,
  getContentTypeFromExtension,
};
