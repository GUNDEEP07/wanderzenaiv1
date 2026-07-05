'use strict';

const { getDB, ok, badRequest, serverError, notFound, log } = require('/opt/nodejs/index');

// Import handlers (to be implemented in separate files)
const postsHandler = require('./handlers/posts');
const commentsHandler = require('./handlers/comments');
const photosHandler = require('./handlers/photos');
const adminHandler = require('./handlers/admin');

exports.handler = async (event) => {
  log.info('Blog request received', { path: event.path, method: event.httpMethod });

  // ─── Handle CORS preflight ────────────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS',
      },
      body: '',
    };
  }

  // ─── Extract user context ─────────────────────────────────────────────────────
  let userId = null;
  let userEmail = null;
  let userRole = 'user';

  try {
    if (event.requestContext?.authorizer?.claims?.sub) {
      userId = event.requestContext.authorizer.claims.sub;
      userEmail = event.requestContext.authorizer.claims.email || null;
      userRole = event.requestContext.authorizer.claims['custom:role'] || 'user';
    }
  } catch (err) {
    log.warn('Failed to extract user context', { error: err.message });
  }

  // ─── Parse request body ───────────────────────────────────────────────────────
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }
  }

  const { httpMethod, path, pathParameters = {}, queryStringParameters = {} } = event;

  try {
    // ─── POSTS ROUTES ─────────────────────────────────────────────────────────

    // POST /blog — Create new post
    if (httpMethod === 'POST' && (path === '/blog' || path?.endsWith('/blog'))) {
      return await postsHandler.createPost(body, userId, userEmail);
    }

    // GET /blog — List all posts
    if (httpMethod === 'GET' && (path === '/blog' || path?.endsWith('/blog'))) {
      return await postsHandler.listPosts(queryStringParameters);
    }

    // GET /blog/{id} — Get single post
    if (httpMethod === 'GET' && path?.match(/^\/blog\/[^/]+$/) && !path.endsWith('/comments') && !path.endsWith('/photos')) {
      const postId = pathParameters.id || path.split('/')[2];
      return await postsHandler.getPost(postId, userId, userRole);
    }

    // PUT /blog/{id} — Update post
    if (httpMethod === 'PUT' && path?.match(/^\/blog\/[^/]+$/) && !path.endsWith('/comments') && !path.endsWith('/photos') && !path.endsWith('/approve') && !path.endsWith('/reject')) {
      const postId = pathParameters.id || path.split('/')[2];
      return await postsHandler.updatePost(postId, body, userId);
    }

    // DELETE /blog/{id} — Delete post
    if (httpMethod === 'DELETE' && path?.match(/^\/blog\/[^/]+$/) && !path.endsWith('/comments') && !path.endsWith('/photos') && !path.endsWith('/approve') && !path.endsWith('/reject')) {
      const postId = pathParameters.id || path.split('/')[2];
      return await postsHandler.deletePost(postId, userId, userRole);
    }

    // ─── COMMENTS ROUTES ──────────────────────────────────────────────────────

    // POST /blog/{id}/comments — Create comment
    if (httpMethod === 'POST' && path?.endsWith('/comments')) {
      const postId = path.split('/')[2];
      return await commentsHandler.createComment(postId, body, userId, userEmail);
    }

    // PUT /blog/comments/{commentId} — Update comment
    if (httpMethod === 'PUT' && path?.match(/^\/blog\/comments\/[^/]+$/)) {
      const commentId = path.split('/')[3];
      return await commentsHandler.updateComment(commentId, body, userId);
    }

    // DELETE /blog/comments/{commentId} — Delete comment
    if (httpMethod === 'DELETE' && path?.match(/^\/blog\/comments\/[^/]+$/)) {
      const commentId = path.split('/')[3];
      return await commentsHandler.deleteComment(commentId, userId, userRole);
    }

    // ─── PHOTOS ROUTES ────────────────────────────────────────────────────────

    // POST /blog/{id}/photos — Request photo upload URL or confirm photo upload
    if (httpMethod === 'POST' && path?.endsWith('/photos')) {
      const postId = path.split('/')[2];
      // Determine which operation based on request body
      if (body.s3Key) {
        // Confirm photo upload (s3Key indicates file was already uploaded to S3)
        return await photosHandler.confirmPhotoUpload(postId, body, userId);
      } else {
        // Request photo upload URL (fileName and fileSize for new upload)
        return await photosHandler.requestPhotoUploadUrl(postId, body, userId);
      }
    }

    // GET /blog/{id}/photos — List post photos
    if (httpMethod === 'GET' && path?.endsWith('/photos')) {
      const postId = path.split('/')[2];
      return await photosHandler.listPhotos(postId, userId, userRole);
    }

    // ─── ADMIN ROUTES ─────────────────────────────────────────────────────────

    // POST /blog/{id}/approve — Approve post
    if (httpMethod === 'POST' && path?.endsWith('/approve')) {
      const postId = path.split('/')[2];
      return await adminHandler.approvePost(postId, userId, userRole);
    }

    // POST /blog/{id}/reject — Reject post
    if (httpMethod === 'POST' && path?.endsWith('/reject')) {
      const postId = path.split('/')[2];
      return await adminHandler.rejectPost(postId, body, userId, userRole);
    }

    // GET /blog/admin/pending — List pending posts
    if (httpMethod === 'GET' && (path === '/blog/admin/pending' || path?.endsWith('/blog/admin/pending'))) {
      return await adminHandler.listPendingPosts(userId, userRole, queryStringParameters);
    }

    // ─── 404: Route not found ─────────────────────────────────────────────────
    return notFound(`Route ${httpMethod} ${path} not found`);

  } catch (err) {
    log.error('Blog handler error', { error: err.message, path, method: httpMethod });
    return serverError('Failed to process request');
  }
};
