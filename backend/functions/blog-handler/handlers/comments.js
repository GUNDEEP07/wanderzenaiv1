'use strict';

const blog = require('../db/blog');
const errors = require('../utils/errors');
const { log } = require('/opt/nodejs/index');

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  'Content-Type': 'application/json',
  'Cache-Control': 'private, no-store',
  'Vary': 'Authorization',
};

const buildResponse = (statusCode, data) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(data),
});

const success = (data, statusCode = 200) => buildResponse(statusCode, { success: true, data });
const created = (data) => buildResponse(201, { success: true, data });

const createComment = async (postId, body, userId, userEmail) => {
  try {
    if (!userId) {
      log.warn('Create comment: unauthorized attempt', { postId, userEmail });
      return errors.unauthorized();
    }

    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    const { content } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      log.warn('Create comment: validation error', { postId, userId });
      return errors.badRequest('Comment content is required');
    }

    const comment = await blog.createComment(postId, userId, userEmail, content.trim());

    log.info('Comment created', { commentId: comment.id, postId, userId });
    return created(comment);

  } catch (err) {
    if (err.message === 'Post not found or not available for comments') {
      log.warn('Create comment: post not found or not available', { postId, userId });
      return errors.notFound('Post not found or not available for comments');
    }

    log.error('Create comment: error', { error: err.message, postId, userId });
    return errors.serverError('Failed to create comment');
  }
};

const updateComment = async (commentId, body, userId) => {
  try {
    if (!userId) {
      log.warn('Update comment: unauthorized attempt', { commentId });
      return errors.unauthorized();
    }

    if (!commentId) {
      return errors.badRequest('Comment ID is required');
    }

    const { content } = body;

    if (!content || typeof content !== 'string' || !content.trim()) {
      log.warn('Update comment: validation error', { commentId, userId });
      return errors.badRequest('Comment content is required');
    }

    const comment = await blog.updateComment(commentId, userId, content.trim());

    log.info('Comment updated', { commentId, userId });
    return success(comment);

  } catch (err) {
    if (err.message === 'Comment not found') {
      log.warn('Update comment: not found', { commentId, userId });
      return errors.notFound('Comment not found');
    }

    if (err.message === 'Unauthorized') {
      log.warn('Update comment: unauthorized', { commentId, userId });
      return buildResponse(403, { error: 'You do not have permission to edit this comment' });
    }

    log.error('Update comment: error', { error: err.message, commentId, userId });
    return errors.serverError('Failed to update comment');
  }
};

const deleteComment = async (commentId, userId, userRole) => {
  try {
    if (!userId) {
      log.warn('Delete comment: unauthorized attempt', { commentId });
      return errors.unauthorized();
    }

    if (!commentId) {
      return errors.badRequest('Comment ID is required');
    }

    await blog.deleteComment(commentId, userId, userRole);

    log.info('Comment deleted', { commentId, userId });
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };

  } catch (err) {
    if (err.message === 'Comment not found') {
      log.warn('Delete comment: not found', { commentId, userId });
      return errors.notFound('Comment not found');
    }

    if (err.message === 'Unauthorized') {
      log.warn('Delete comment: unauthorized', { commentId, userId });
      return buildResponse(403, { error: 'You do not have permission to delete this comment' });
    }

    log.error('Delete comment: error', { error: err.message, commentId, userId });
    return errors.serverError('Failed to delete comment');
  }
};

module.exports = {
  createComment,
  updateComment,
  deleteComment,
};
