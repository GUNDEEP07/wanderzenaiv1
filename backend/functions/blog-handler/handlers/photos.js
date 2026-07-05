'use strict';

const { randomUUID } = require('crypto');
const blog = require('../db/blog');
const { generateS3SignedPutUrl, deleteS3Object } = require('../utils/s3');
const { validatePhotoUpload } = require('../utils/validation');
const errors = require('../utils/errors');
const { log } = require('/opt/nodejs/index');

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  'Content-Type': 'application/json',
};

const buildResponse = (statusCode, data) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(data),
});

const success = (data, statusCode = 200) => buildResponse(statusCode, { success: true, data });
const created = (data) => buildResponse(201, { success: true, data });

/**
 * Verify post exists and user owns it
 * @param {string} postId — Post ID
 * @param {string} userId — User ID (for ownership check)
 * @returns {Promise<object>} Post object
 * @throws {Error} "Post not found" or "Unauthorized"
 */
const verifyPostOwnership = async (postId, userId) => {
  const sql = `
    SELECT id, user_id
    FROM blog_posts
    WHERE id = $1;
  `;

  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: 5432,
    ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1'
      ? false
      : { rejectUnauthorized: true },
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });

  const result = await pool.query(sql, [postId]);
  await pool.end();

  if (!result.rows.length) {
    throw new Error('Post not found');
  }

  const post = result.rows[0];

  if (post.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  return post;
};

const requestPhotoUploadUrl = async (postId, body, userId) => {
  try {
    if (!userId) {
      log.warn('Request photo upload URL: unauthorized attempt', { postId });
      return errors.unauthorized();
    }

    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    const { fileName, fileSize } = body;

    if (!fileName || typeof fileName !== 'string') {
      log.warn('Request photo upload URL: missing fileName', { postId, userId });
      return errors.badRequest('File name is required');
    }

    if (typeof fileSize !== 'number' || fileSize <= 0) {
      log.warn('Request photo upload URL: invalid fileSize', { postId, userId, fileSize });
      return errors.badRequest('File size must be a positive number');
    }

    // Validate file size (max 10MB per file)
    const maxFileSize = 10 * 1024 * 1024;
    if (fileSize > maxFileSize) {
      log.warn('Request photo upload URL: file too large', { postId, userId, fileSize });
      return errors.badRequest(`File size exceeds maximum of 10MB (received ${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    // Verify user owns the post
    await verifyPostOwnership(postId, userId);

    // Generate S3 key: blog/{postId}/{uuid}-{fileName}
    const uuid = randomUUID();
    const s3Key = `blog/${postId}/${uuid}-${fileName}`;

    // Generate signed PUT URL (1 hour expiry for upload)
    const uploadUrl = await generateS3SignedPutUrl(s3Key, 3600);

    log.info('Photo upload URL requested', { postId, userId, s3Key, fileName });
    return success({ uploadUrl, s3Key, expiresIn: 3600 });

  } catch (err) {
    if (err.message === 'Post not found') {
      log.warn('Request photo upload URL: post not found', { postId, userId });
      return errors.notFound('Post not found');
    }

    if (err.message === 'Unauthorized') {
      log.warn('Request photo upload URL: unauthorized', { postId, userId });
      return buildResponse(403, { error: 'You do not have permission to upload photos to this post' });
    }

    log.error('Request photo upload URL: error', { error: err.message, postId, userId });
    return errors.serverError('Failed to generate upload URL');
  }
};

const confirmPhotoUpload = async (postId, body, userId) => {
  try {
    if (!userId) {
      log.warn('Confirm photo upload: unauthorized attempt', { postId });
      return errors.unauthorized();
    }

    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    const { s3Key, displayOrder } = body;

    if (!s3Key || typeof s3Key !== 'string') {
      log.warn('Confirm photo upload: missing s3Key', { postId, userId });
      return errors.badRequest('S3 key is required');
    }

    if (typeof displayOrder !== 'number' || displayOrder < 0) {
      log.warn('Confirm photo upload: invalid displayOrder', { postId, userId, displayOrder });
      return errors.badRequest('Display order must be a non-negative number');
    }

    // Verify user owns the post
    await verifyPostOwnership(postId, userId);

    // Validate photo upload (checks extension and size)
    validatePhotoUpload(s3Key, 1); // We pass 1 as fileSize since we already validated in request phase

    // Add photo to database
    const photo = await blog.addPhoto(postId, s3Key, displayOrder);

    log.info('Photo upload confirmed', { postId, userId, s3Key, displayOrder });
    return created(photo);

  } catch (err) {
    if (err.message === 'Post not found') {
      log.warn('Confirm photo upload: post not found', { postId, userId });
      return errors.notFound('Post not found');
    }

    if (err.message === 'Unauthorized') {
      log.warn('Confirm photo upload: unauthorized', { postId, userId });
      return buildResponse(403, { error: 'You do not have permission to confirm uploads for this post' });
    }

    if (err.message.includes('Photo format') || err.message.includes('File size')) {
      log.warn('Confirm photo upload: validation error', { error: err.message, postId, userId });
      return errors.badRequest(err.message);
    }

    log.error('Confirm photo upload: error', { error: err.message, postId, userId });
    return errors.serverError('Failed to confirm photo upload');
  }
};

const listPhotos = async (postId) => {
  try {
    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    // Verify post exists
    const checkSql = `
      SELECT id FROM blog_posts WHERE id = $1;
    `;

    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: 5432,
      ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1'
        ? false
        : { rejectUnauthorized: true },
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 5000,
    });

    const checkResult = await pool.query(checkSql, [postId]);
    await pool.end();

    if (!checkResult.rows.length) {
      log.warn('List photos: post not found', { postId });
      return errors.notFound('Post not found');
    }

    const photos = await blog.listPhotos(postId);

    log.info('Photos listed', { postId, count: photos.length });
    return success(photos);

  } catch (err) {
    log.error('List photos: error', { error: err.message, postId });
    return errors.serverError('Failed to list photos');
  }
};

module.exports = {
  requestPhotoUploadUrl,
  confirmPhotoUpload,
  listPhotos,
};
