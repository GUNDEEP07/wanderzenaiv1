'use strict';

const blog = require('../db/blog');
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

/**
 * Checks if user has admin permissions
 * @param {string} userRole — Current user's role
 * @returns {boolean} True if admin/superadmin, false otherwise
 */
const isAdmin = (userRole) => userRole === 'admin' || userRole === 'superadmin';

/**
 * approvePost — Approve a post in pending_review status
 * @param {string} postId — Post ID (UUID)
 * @param {string} userId — Current user ID (for logging)
 * @param {string} userRole — Current user's role
 * @returns {Promise<object>} HTTP response with updated post or error
 */
const approvePost = async (postId, userId, userRole) => {
  try {
    // Check admin permission
    if (!isAdmin(userRole)) {
      log.warn('Approve post: unauthorized attempt', { postId, userId, userRole });
      return buildResponse(403, { error: 'Only admins can approve posts' });
    }

    // Validate postId
    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    // Call db layer
    const post = await blog.approvePost(postId);

    log.info('Post approved', { postId, userId });
    return success(post);

  } catch (err) {
    if (err.message === 'Post not in pending_review state') {
      log.warn('Approve post: not in pending review', { postId, userId });
      return errors.notFound('Post not found or not in pending review state');
    }

    log.error('Approve post: error', { error: err.message, postId, userId });
    return errors.serverError('Failed to approve post');
  }
};

/**
 * rejectPost — Reject a post in pending_review status with admin notes
 * @param {string} postId — Post ID (UUID)
 * @param {object} body — Request body with adminNotes field
 * @param {string} userId — Current user ID (for logging)
 * @param {string} userRole — Current user's role
 * @returns {Promise<object>} HTTP response with updated post or error
 */
const rejectPost = async (postId, body, userId, userRole) => {
  try {
    // Check admin permission
    if (!isAdmin(userRole)) {
      log.warn('Reject post: unauthorized attempt', { postId, userId, userRole });
      return buildResponse(403, { error: 'Only admins can reject posts' });
    }

    // Validate postId
    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    // Extract and validate adminNotes
    const { adminNotes } = body || {};

    if (!adminNotes) {
      log.warn('Reject post: missing adminNotes', { postId, userId });
      return errors.badRequest('Admin notes are required');
    }

    if (typeof adminNotes !== 'string') {
      log.warn('Reject post: adminNotes not string', { postId, userId });
      return errors.badRequest('Admin notes must be a string');
    }

    const trimmedNotes = adminNotes.trim();

    if (trimmedNotes.length < 10) {
      log.warn('Reject post: adminNotes too short', { postId, userId, length: trimmedNotes.length });
      return errors.badRequest('Admin notes must be at least 10 characters');
    }

    if (trimmedNotes.length > 1000) {
      log.warn('Reject post: adminNotes too long', { postId, userId, length: trimmedNotes.length });
      return errors.badRequest('Admin notes must not exceed 1000 characters');
    }

    // Call db layer
    const post = await blog.rejectPost(postId, trimmedNotes);

    log.info('Post rejected', { postId, userId });
    return success(post);

  } catch (err) {
    if (err.message === 'Post not in pending_review state') {
      log.warn('Reject post: not in pending review', { postId, userId });
      return errors.notFound('Post not found or not in pending review state');
    }

    log.error('Reject post: error', { error: err.message, postId, userId });
    return errors.serverError('Failed to reject post');
  }
};

/**
 * listPendingPosts — List all pending posts with pagination
 * @param {object} queryStringParameters — Query params with optional page
 * @param {string} userRole — Current user's role
 * @returns {Promise<object>} HTTP response with array of pending posts or error
 */
const listPendingPosts = async (queryStringParameters = {}, userRole) => {
  try {
    // Check admin permission
    if (!isAdmin(userRole)) {
      log.warn('List pending posts: unauthorized attempt', { userRole });
      return buildResponse(403, { error: 'Only admins can view pending posts' });
    }

    // Parse page parameter
    let page = 1;
    if (queryStringParameters.page) {
      const pageNum = parseInt(queryStringParameters.page, 10);
      if (!Number.isNaN(pageNum) && pageNum > 0) {
        page = pageNum;
      }
    }

    // Call db layer
    const posts = await blog.listPendingPosts(page);

    log.info('Pending posts listed', { count: posts.length, page });
    return success(posts);

  } catch (err) {
    log.error('List pending posts: error', { error: err.message });
    return errors.serverError('Failed to list pending posts');
  }
};

module.exports = {
  approvePost,
  rejectPost,
  listPendingPosts,
};
