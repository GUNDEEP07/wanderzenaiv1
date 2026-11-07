'use strict';

const blog = require('../db/blog');
const { validatePostInput } = require('../utils/validation');
const errors = require('../utils/errors');
const { log } = require('/opt/nodejs/index');
const { viewPost } = require('../utils/publicView');
const photosHandler = require('./photos');
const s3 = require('../utils/s3');

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

const ADMIN_ROLES = new Set(['admin', 'superadmin']);

// Nov 8 2026 (Gundeep's decision "2B"): only the WanderZen team writes stories, and they
// publish straight away. User submissions can come back later via the review queue.
const createPost = async (body, userId, userEmail, userRole = 'user') => {
  try {
    if (!userId) {
      log.warn('Create post: unauthorized attempt', { userEmail });
      return errors.unauthorized();
    }
    if (!ADMIN_ROLES.has(userRole)) {
      log.warn('Create post: not a team member', { userId });
      return buildResponse(403, { success: false, error: 'Only the WanderZen team can publish stories right now' });
    }

    const { title, description, content, location, country, travelDates, category } = body;

    validatePostInput(title, description, content, location, country, travelDates, category);

    const post = await blog.createPost(userId, title, description, content, location, country, travelDates, category, { publish: true });

    log.info('Post published', { postId: post.id, userId, title });
    return created(viewPost(post, { userId, userRole }));

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

    // Photos never block the story: if they can't be read, the post shows without them.
    const photos = await photosHandler.photosFor(postId).catch((err) => {
      log.warn('Get post: photos unavailable', { postId, error: err.message });
      return [];
    });
    log.info('Post retrieved', { postId, userId });
    return success({ ...viewPost(post, { userId, userRole }), photos, thumbnail_url: photos[0]?.url || null });

  } catch (err) {
    log.error('Get post: error', { error: err.message, postId });
    return errors.serverError('Failed to retrieve post');
  }
};

const listPosts = async (queryStringParameters = {}, viewer = {}) => {
  try {
    const filters = {};
    const params = queryStringParameters || {};

    if (params.category) {
      filters.category = params.category;
    }

    if (params.country) {
      filters.country = params.country;
    }

    if (params.location) {
      filters.location = params.location;
    }

    if (params.search) {
      filters.search = params.search;
    }

    if (params.page) {
      filters.page = parseInt(params.page, 10);
    }

    const posts = await blog.listPosts(filters);

    // The first photo of each story is its cover on the list.
    const covers = await blog.coverKeys(posts.map(p => p.id)).catch((err) => {
      log.warn('List posts: covers unavailable', { error: err.message });
      return new Map();
    });
    const coverUrls = await Promise.all(posts.map(p => (covers.has(p.id) ? s3.imageUrl(covers.get(p.id)) : null)));

    log.info('Posts listed', { count: posts.length, filters });
    return success(posts.map((p, i) => ({ ...viewPost(p, viewer), thumbnail_url: coverUrls[i] })));

  } catch (err) {
    log.error('List posts: error', { error: err.message });
    return errors.serverError('Failed to list posts');
  }
};

const updatePost = async (postId, body, userId, userRole = 'user') => {
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

    const post = await blog.updatePost(postId, userId, updates, { isAdmin: ADMIN_ROLES.has(userRole) });

    log.info('Post updated', { postId, userId });
    return success(viewPost(post, { userId, userRole }));

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

    // Photo rows go with the post (ON DELETE CASCADE); their S3 objects are removed after.
    const photoKeys = (await blog.listPhotos(postId).catch(() => [])).map(p => p.s3_key);
    await blog.deletePost(postId, userId, userRole);
    await photosHandler.deleteObjects(photoKeys);

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
