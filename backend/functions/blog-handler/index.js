'use strict';

const {
  getDB, badRequest, serverError, notFound, log,
  requireUser, optionalUser, AuthError, authFailure,
} = require('/opt/nodejs/index');

const postsHandler = require('./handlers/posts');
const commentsHandler = require('./handlers/comments');
const photosHandler = require('./handlers/photos');
const adminHandler = require('./handlers/admin');

const ROLE_PRIORITY = { superadmin: 5, admin: 4, agency: 3, support: 2, user: 1 };

/**
 * Map a verified Firebase identity to the app's user row (blog tables reference users.id)
 * and the caller's highest role from user_roles. Creates the users row on first use, the
 * same way GET /profile does.
 * @returns {Promise<{ userId: string, userEmail: string, userRole: string }>}
 */
async function resolveAppUser(identity) {
  const db = getDB();
  await db.query(
    `INSERT INTO users (email, firebase_uid) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
    [identity.email, identity.uid]
  );
  const { rows } = await db.query(
    `SELECT u.id, COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE u.email = $1
     GROUP BY u.id`,
    [identity.email]
  );
  if (!rows.length) throw new Error('User row missing after upsert');
  const roles = rows[0].roles || [];
  const userRole = roles.reduce(
    (best, r) => ((ROLE_PRIORITY[r] || 0) > (ROLE_PRIORITY[best] || 0) ? r : best),
    'user'
  );
  return { userId: rows[0].id, userEmail: identity.email, userRole };
}

const ANONYMOUS = Object.freeze({ userId: null, userEmail: null, userRole: 'user' });

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

  const { httpMethod, path = '', pathParameters = {} } = event;
  const queryStringParameters = event.queryStringParameters || {};

  // ─── Resolve caller ───────────────────────────────────────────────────────────
  // Reads are public (signed-in callers additionally see their own drafts); every write
  // requires a verified identity. Identity comes only from the verified Firebase token.
  let caller = ANONYMOUS;
  try {
    const identity = httpMethod === 'GET' ? await optionalUser(event) : await requireUser(event);
    if (identity) caller = await resolveAppUser(identity);
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Blog auth rejected', { code: err.code, path, method: httpMethod });
      return authFailure(err);
    }
    log.error('Blog auth failed', { error: err.message });
    return serverError('Authentication is temporarily unavailable');
  }
  const { userId, userEmail, userRole } = caller;

  // ─── Parse request body ───────────────────────────────────────────────────────
  let body = {};
  if (event.body) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON body');
    }
  }

  const segments = path.split('/'); // ['', 'blog', ':id', ...]
  const isReservedId = (id) => id === 'comments' || id === 'admin';

  try {
    // ─── POSTS ROUTES ─────────────────────────────────────────────────────────

    // POST /blog — Create new post
    if (httpMethod === 'POST' && (path === '/blog' || path.endsWith('/blog'))) {
      return await postsHandler.createPost(body, userId, userEmail, userRole);
    }

    // GET /blog — List all posts
    if (httpMethod === 'GET' && (path === '/blog' || path.endsWith('/blog'))) {
      return await postsHandler.listPosts(queryStringParameters, { userId, userRole });
    }

    // GET /blog/admin/pending — List pending posts (checked before /blog/{id})
    if (httpMethod === 'GET' && path.endsWith('/blog/admin/pending')) {
      return await adminHandler.listPendingPosts(queryStringParameters, userRole);
    }

    // /blog/{id}
    if (/^\/blog\/[^/]+$/.test(path) && !isReservedId(segments[2])) {
      const postId = pathParameters.id || segments[2];
      if (httpMethod === 'GET') return await postsHandler.getPost(postId, userId, userRole);
      if (httpMethod === 'PUT') return await postsHandler.updatePost(postId, body, userId, userRole);
      if (httpMethod === 'DELETE') return await postsHandler.deletePost(postId, userId, userRole);
    }

    // ─── COMMENTS ROUTES ──────────────────────────────────────────────────────

    // GET /blog/{id}/comments — List comments (the page called this but no route existed)
    if (httpMethod === 'GET' && /^\/blog\/[^/]+\/comments$/.test(path)) {
      return await commentsHandler.listComments(pathParameters.id || segments[2], { userId, userRole });
    }

    // POST /blog/{id}/comments — Create comment
    if (httpMethod === 'POST' && /^\/blog\/[^/]+\/comments$/.test(path)) {
      return await commentsHandler.createComment(segments[2], body, userId, userEmail);
    }

    // PUT|DELETE /blog/comments/{commentId}
    if (/^\/blog\/comments\/[^/]+$/.test(path)) {
      const commentId = pathParameters.commentId || segments[3];
      if (httpMethod === 'PUT') return await commentsHandler.updateComment(commentId, body, userId);
      if (httpMethod === 'DELETE') return await commentsHandler.deleteComment(commentId, userId, userRole);
    }

    // ─── PHOTOS ROUTES ────────────────────────────────────────────────────────
    // Routes match infra/template.yaml and frontend/src/api/blog.js.

    // POST /blog/{id}/photos/request — Request a signed upload URL
    if (httpMethod === 'POST' && /^\/blog\/[^/]+\/photos\/request$/.test(path)) {
      return await photosHandler.requestPhotoUploadUrl(segments[2], body, userId);
    }

    // POST /blog/{id}/photos/confirm — Confirm an uploaded photo
    if (httpMethod === 'POST' && /^\/blog\/[^/]+\/photos\/confirm$/.test(path)) {
      return await photosHandler.confirmPhotoUpload(segments[2], body, userId);
    }

    // GET /blog/{id}/photos — List post photos
    if (httpMethod === 'GET' && /^\/blog\/[^/]+\/photos$/.test(path)) {
      return await photosHandler.listPhotos(segments[2], userId, userRole);
    }

    // ─── ADMIN ROUTES ─────────────────────────────────────────────────────────
    // The handlers check userRole; it now comes from user_roles, not client claims.

    // POST /blog/{id}/approve
    if (httpMethod === 'POST' && /^\/blog\/[^/]+\/approve$/.test(path)) {
      return await adminHandler.approvePost(segments[2], userId, userRole);
    }

    // POST /blog/{id}/reject
    if (httpMethod === 'POST' && /^\/blog\/[^/]+\/reject$/.test(path)) {
      return await adminHandler.rejectPost(segments[2], body, userId, userRole);
    }

    // ─── 404: Route not found ─────────────────────────────────────────────────
    return notFound('Route not found');

  } catch (err) {
    log.error('Blog handler error', { error: err.message, path, method: httpMethod });
    return serverError('Failed to process request');
  }
};
