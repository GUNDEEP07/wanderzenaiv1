'use strict';

const blog = require('../db/blog');
const { validatePostInput } = require('../utils/validation');
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

const createPost = async (body, userId, userEmail) => {
  try {
    if (!userId) {
      log.warn('Create post: unauthorized attempt', { userEmail });
      return errors.unauthorized();
    }

    const { title, description, content, location, country, travelDates, category } = body;

    validatePostInput(title, description, content, location, country, travelDates, category);

    const post = await blog.createPost(userId, title, description, content, location, country, travelDates, category);

    log.info('Post created', { postId: post.id, userId, title });
    return created(post);

  } catch (err) {
    if (err.message.includes('is required') || err.message.includes('must be')) {
      log.warn('Create post: validation error', { error: err.message, userId });
      return errors.badRequest(err.message);
    }

    log.error('Create post: error', { error: err.message, userId });
    return errors.serverError('Failed to create post');
  }
};

const getPost = async (postId, userId = null, userRole = null) => {
  try {
    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    const post = await blog.getPost(postId, userId, userRole);

    if (!post) {
      log.warn('Get post: not found', { postId });
      return errors.notFound('Post not found');
    }

    log.info('Post retrieved', { postId, userId });
    return success(post);

  } catch (err) {
    log.error('Get post: error', { error: err.message, postId });
    return errors.serverError('Failed to retrieve post');
  }
};

const listPosts = async (queryStringParameters = {}) => {
  try {
    const filters = {};

    if (queryStringParameters.category) {
      filters.category = queryStringParameters.category;
    }

    if (queryStringParameters.country) {
      filters.country = queryStringParameters.country;
    }

    if (queryStringParameters.location) {
      filters.location = queryStringParameters.location;
    }

    if (queryStringParameters.search) {
      filters.search = queryStringParameters.search;
    }

    if (queryStringParameters.page) {
      filters.page = parseInt(queryStringParameters.page, 10);
    }

    const posts = await blog.listPosts(filters);

    log.info('Posts listed', { count: posts.length, filters });
    return success(posts);

  } catch (err) {
    log.error('List posts: error', { error: err.message });
    return errors.serverError('Failed to list posts');
  }
};

const updatePost = async (postId, body, userId) => {
  try {
    if (!userId) {
      log.warn('Update post: unauthorized attempt', { postId });
      return errors.unauthorized();
    }

    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    const { title, description, content, location, country, travelDates, category } = body;

    validatePostInput(title, description, content, location, country, travelDates, category);

    const updates = {
      title,
      description,
      content,
      location,
      country,
      category,
    };

    if (travelDates) {
      updates.travel_dates = travelDates;
    }

    const post = await blog.updatePost(postId, userId, updates);

    log.info('Post updated', { postId, userId });
    return success(post);

  } catch (err) {
    if (err.message === 'Post not found') {
      log.warn('Update post: not found', { postId, userId });
      return errors.notFound('Post not found');
    }

    if (err.message === 'Unauthorized') {
      log.warn('Update post: unauthorized', { postId, userId });
      return buildResponse(403, { error: 'You do not have permission to edit this post' });
    }

    if (err.message === 'Can only edit draft or rejected posts') {
      log.warn('Update post: cannot edit published post', { postId, userId });
      return buildResponse(403, { error: 'Can only edit draft or rejected posts' });
    }

    if (err.message.includes('is required') || err.message.includes('must be')) {
      log.warn('Update post: validation error', { error: err.message, userId, postId });
      return errors.badRequest(err.message);
    }

    log.error('Update post: error', { error: err.message, postId, userId });
    return errors.serverError('Failed to update post');
  }
};

const deletePost = async (postId, userId, userRole) => {
  try {
    if (!userId) {
      log.warn('Delete post: unauthorized attempt', { postId });
      return errors.unauthorized();
    }

    if (!postId) {
      return errors.badRequest('Post ID is required');
    }

    await blog.deletePost(postId, userId, userRole);

    log.info('Post deleted', { postId, userId });
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };

  } catch (err) {
    if (err.message === 'Post not found') {
      log.warn('Delete post: not found', { postId });
      return errors.notFound('Post not found');
    }

    if (err.message === 'Unauthorized') {
      log.warn('Delete post: unauthorized', { postId, userId });
      return buildResponse(403, { error: 'You do not have permission to delete this post' });
    }

    log.error('Delete post: error', { error: err.message, postId, userId });
    return errors.serverError('Failed to delete post');
  }
};

module.exports = {
  createPost,
  getPost,
  listPosts,
  updatePost,
  deletePost,
};
