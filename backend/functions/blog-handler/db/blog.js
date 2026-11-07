'use strict';

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ─── Database connection pool ────────────────────────────────────────────────
let sslConfig = false;
if (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') {
  // For RDS: load the AWS RDS global CA bundle if available, otherwise use env var or disable verification
  if (process.env.RDS_CA_BUNDLE) {
    sslConfig = {
      rejectUnauthorized: true,
      ca: process.env.RDS_CA_BUNDLE.split('\\n').join('\n'),
    };
  } else {
    // Fallback: disable verification (matches shared layer pattern for dev environments)
    sslConfig = { rejectUnauthorized: false };
  }
}

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432,
  ssl: sslConfig,
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ═════════════════════════════════════════════════════════════════════════════
// POSTS (6 functions)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * createPost — Insert new blog post with status='draft'
 * @param {string} userId — Post author's user ID (UUID)
 * @param {string} title — Post title
 * @param {string} description — Post description/excerpt
 * @param {string} content — Full post content
 * @param {string} location — Location/destination (e.g., "Ubud")
 * @param {string} country — Country name (e.g., "Indonesia")
 * @param {object} travelDates — Date range object { start, end }
 * @param {string} category — Category: 'tips', 'adventure', 'culture', 'food', 'budget', 'other'
 * @returns {Promise<object>} Created post object
 * @throws {Error} On insert failure
 */
const createPost = async (userId, title, description, content, location, country, travelDates, category, { publish = false } = {}) => {
  // Team posts (Nov 8 2026: admin-only blog) go live at once; anything else starts as a draft.
  const sql = `
    INSERT INTO blog_posts (user_id, title, description, content, location, country, travel_dates, category, status, published_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${publish ? "'published', NOW()" : "'draft', NULL"}, NOW(), NOW())
    RETURNING id, user_id, title, description, content, location, country, travel_dates, category, status, admin_notes, created_at, updated_at, published_at;
  `;

  // Format travel_dates as PostgreSQL daterange (e.g., "[2024-01-01,2024-01-10)")
  let daterange = null;
  if (travelDates && travelDates.start && travelDates.end) {
    daterange = `[${travelDates.start},${travelDates.end})`;
  }

  const result = await pool.query(sql, [userId, title, description, content, location, country, daterange, category]);

  if (!result.rows.length) {
    throw new Error('Failed to create post');
  }

  return result.rows[0];
};

/**
 * getPost — Fetch single post by ID with author email joined
 * Published posts visible to all; draft/rejected only to owner/admin
 * @param {string} postId — Post ID (UUID)
 * @param {string} userId — Current user ID (optional, for ownership check)
 * @param {string} userRole — Current user's role (optional, for admin check)
 * @returns {Promise<object|null>} Post object with author_email, or null if not found or unauthorized
 */
const getPost = async (postId, userId = null, userRole = null) => {
  const sql = `
    SELECT
      bp.id, bp.user_id, bp.title, bp.description, bp.content,
      bp.location, bp.country, bp.travel_dates, bp.category,
      bp.status, bp.admin_notes, bp.created_at, bp.updated_at, bp.published_at,
      u.email AS author_email, u.name AS author_name
    FROM blog_posts bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.id = $1
      AND (bp.status = 'published' OR bp.user_id = $2 OR $3 IN ('admin', 'superadmin'));
  `;

  const result = await pool.query(sql, [postId, userId, userRole]);
  return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * listPosts — List published posts with filtering & pagination
 * @param {object} filters — Optional filters: { category, country, location, search, page }
 * @returns {Promise<array>} Array of published posts
 */
const listPosts = async (filters = {}) => {
  let sql = `
    SELECT
      bp.id, bp.user_id, bp.title, bp.description, bp.content,
      bp.location, bp.country, bp.travel_dates, bp.category,
      bp.status, bp.admin_notes, bp.created_at, bp.updated_at, bp.published_at,
      u.email AS author_email, u.name AS author_name
    FROM blog_posts bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.status = 'published'
  `;

  const params = [];
  let paramIndex = 1;

  // Add category filter
  if (filters.category) {
    sql += ` AND bp.category = $${paramIndex}`;
    params.push(filters.category);
    paramIndex++;
  }

  // Add country filter
  if (filters.country) {
    sql += ` AND bp.country = $${paramIndex}`;
    params.push(filters.country);
    paramIndex++;
  }

  // Add location filter (ILIKE for case-insensitive)
  if (filters.location) {
    sql += ` AND bp.location ILIKE $${paramIndex}`;
    params.push(`%${filters.location}%`);
    paramIndex++;
  }

  // Add search filter (title + description)
  if (filters.search) {
    sql += ` AND (bp.title ILIKE $${paramIndex} OR bp.description ILIKE $${paramIndex + 1})`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
    paramIndex += 2;
  }

  // Add ordering and pagination
  sql += ` ORDER BY bp.published_at DESC`;

  const page = Math.max(1, parseInt(filters.page || 1));
  const limit = 10;
  const offset = (page - 1) * limit;

  sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(sql, params);
  return result.rows;
};

/**
 * updatePost — Update post if user owns it and post is draft/rejected
 * @param {string} postId — Post ID (UUID)
 * @param {string} userId — Current user ID (for auth)
 * @param {object} updates — Fields to update: { title, description, content, location, country, travel_dates, category }
 * @returns {Promise<object>} Updated post object
 * @throws {Error} "Unauthorized" if user doesn't own post, "Can only edit draft or rejected posts" if published
 */
const updatePost = async (postId, userId, updates, { isAdmin = false } = {}) => {
  // Verify ownership and status
  const checkSql = `
    SELECT id, user_id, status
    FROM blog_posts
    WHERE id = $1;
  `;

  const checkResult = await pool.query(checkSql, [postId]);

  if (!checkResult.rows.length) {
    throw new Error('Post not found');
  }

  const post = checkResult.rows[0];

  // Admins (the WanderZen team) may edit any post, published ones included.
  // Check authorization
  if (!isAdmin && post.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Check status — can only edit draft or rejected
  if (!isAdmin && post.status !== 'draft' && post.status !== 'rejected') {
    throw new Error('Can only edit draft or rejected posts');
  }

  // Build update query
  const allowedFields = ['title', 'description', 'content', 'location', 'country', 'category'];
  const setClause = [];
  const params = [];
  let paramIndex = 1;

  allowedFields.forEach(field => {
    if (field in updates) {
      if (field === 'travel_dates') {
        // Handle daterange format
        if (updates[field] && updates[field].start && updates[field].end) {
          setClause.push(`${field} = $${paramIndex}`);
          params.push(`[${updates[field].start},${updates[field].end})`);
          paramIndex++;
        }
      } else {
        setClause.push(`${field} = $${paramIndex}`);
        params.push(updates[field]);
        paramIndex++;
      }
    }
  });

  // Handle travel_dates separately since it's not in allowedFields but in updates
  if ('travel_dates' in updates) {
    if (updates.travel_dates && updates.travel_dates.start && updates.travel_dates.end) {
      setClause.push(`travel_dates = $${paramIndex}`);
      params.push(`[${updates.travel_dates.start},${updates.travel_dates.end})`);
      paramIndex++;
    }
  }

  if (!setClause.length) {
    // No fields to update, return current post
    const sql = `
      SELECT id, user_id, title, description, content, location, country, travel_dates, category, status, admin_notes, created_at, updated_at, published_at
      FROM blog_posts
      WHERE id = $1;
    `;
    const result = await pool.query(sql, [postId]);
    return result.rows[0];
  }

  // Add updated_at and postId to params
  setClause.push(`updated_at = NOW()`);
  params.push(postId);

  const updateSql = `
    UPDATE blog_posts
    SET ${setClause.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING id, user_id, title, description, content, location, country, travel_dates, category, status, admin_notes, created_at, updated_at, published_at;
  `;

  const result = await pool.query(updateSql, params);
  return result.rows[0];
};

/**
 * deletePost — Delete post if user owns it or user is admin
 * @param {string} postId — Post ID (UUID)
 * @param {string} userId — Current user ID
 * @param {string} userRole — Current user's role ('user', 'admin', etc.)
 * @returns {Promise<void>}
 * @throws {Error} "Unauthorized" if user cannot delete
 */
const deletePost = async (postId, userId, userRole) => {
  // Check authorization
  const checkSql = `
    SELECT id, user_id
    FROM blog_posts
    WHERE id = $1;
  `;

  const checkResult = await pool.query(checkSql, [postId]);

  if (!checkResult.rows.length) {
    throw new Error('Post not found');
  }

  const post = checkResult.rows[0];

  // User must own post or be admin
  if (post.user_id !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
    throw new Error('Unauthorized');
  }

  const deleteSql = `
    DELETE FROM blog_posts
    WHERE id = $1;
  `;

  await pool.query(deleteSql, [postId]);
};

// ═════════════════════════════════════════════════════════════════════════════
// COMMENTS (4 functions)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * createComment — Insert new comment (only on published posts)
 * @param {string} postId — Post ID (UUID)
 * @param {string} userId — Commenter's user ID (UUID)
 * @param {string} userEmail — Commenter's email
 * @param {string} content — Comment text
 * @returns {Promise<object>} Created comment object
 * @throws {Error} "Post not found or not available for comments" if post unpublished
 */
const createComment = async (postId, userId, userEmail, content) => {
  const checkSql = `
    SELECT status FROM blog_posts WHERE id = $1;
  `;
  const checkResult = await pool.query(checkSql, [postId]);

  if (!checkResult.rows.length || checkResult.rows[0].status !== 'published') {
    throw new Error('Post not found or not available for comments');
  }

  const sql = `
    INSERT INTO blog_comments (post_id, user_id, user_email, content, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    RETURNING id, post_id, user_id, user_email, content, created_at, updated_at,
      (SELECT name FROM users WHERE users.id = blog_comments.user_id) AS author_name;
  `;

  const result = await pool.query(sql, [postId, userId, userEmail, content]);

  if (!result.rows.length) {
    throw new Error('Failed to create comment');
  }

  return result.rows[0];
};

/**
 * updateComment — Update comment if user owns it
 * @param {string} commentId — Comment ID (UUID)
 * @param {string} userId — Current user ID (for auth)
 * @param {string} content — New comment content
 * @returns {Promise<object>} Updated comment object
 * @throws {Error} "Comment not found" (404) if comment doesn't exist, "Unauthorized" (403) if user doesn't own it
 */
const updateComment = async (commentId, userId, content) => {
  // First check if comment exists
  const checkSql = `
    SELECT id, user_id
    FROM blog_comments
    WHERE id = $1;
  `;

  const checkResult = await pool.query(checkSql, [commentId]);

  if (!checkResult.rows.length) {
    throw new Error('Comment not found');
  }

  const comment = checkResult.rows[0];

  // Check authorization
  if (comment.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Perform update
  const sql = `
    UPDATE blog_comments
    SET content = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, post_id, user_id, user_email, content, created_at, updated_at,
      (SELECT name FROM users WHERE users.id = blog_comments.user_id) AS author_name;
  `;

  const result = await pool.query(sql, [content, commentId]);

  return result.rows[0];
};

/**
 * deleteComment — Delete comment if user owns it or is admin
 * @param {string} commentId — Comment ID (UUID)
 * @param {string} userId — Current user ID
 * @param {string} userRole — Current user's role
 * @returns {Promise<void>}
 * @throws {Error} "Comment not found" (404) if comment doesn't exist, "Unauthorized" (403) if user can't delete
 */
const deleteComment = async (commentId, userId, userRole) => {
  // First check if comment exists
  const checkSql = `
    SELECT id, user_id
    FROM blog_comments
    WHERE id = $1;
  `;

  const checkResult = await pool.query(checkSql, [commentId]);

  if (!checkResult.rows.length) {
    throw new Error('Comment not found');
  }

  const comment = checkResult.rows[0];

  // Check authorization — user must own comment or be admin
  if (comment.user_id !== userId && userRole !== 'admin' && userRole !== 'superadmin') {
    throw new Error('Unauthorized');
  }

  // Perform delete
  const deleteSql = `
    DELETE FROM blog_comments
    WHERE id = $1;
  `;

  await pool.query(deleteSql, [commentId]);
};

/**
 * listCommentsByPost — Fetch all comments for a post, ordered newest first
 * @param {string} postId — Post ID (UUID)
 * @returns {Promise<array>} Array of comments
 */
const listCommentsByPost = async (postId) => {
  const sql = `
    SELECT c.id, c.post_id, c.user_id, c.user_email, c.content, c.created_at, c.updated_at,
           u.name AS author_name
    FROM blog_comments c
    JOIN blog_posts bp ON bp.id = c.post_id AND bp.status = 'published'
    LEFT JOIN users u ON u.id = c.user_id
    WHERE c.post_id = $1
    ORDER BY c.created_at DESC;
  `;

  const result = await pool.query(sql, [postId]);
  return result.rows;
};

// ═════════════════════════════════════════════════════════════════════════════
// PHOTOS (2 functions)
// ═════════════════════════════════════════════════════════════════════════════

const MAX_PHOTOS_PER_POST = 12;

/** blog_photos (+ caption, Nov 2026) creates itself: CI cannot reach RDS (migration 006). */
let photosReady = null;
const ensurePhotoTable = () => {
  if (!photosReady) {
    photosReady = pool.query(`
      CREATE TABLE IF NOT EXISTS blog_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
        s3_key VARCHAR(500) NOT NULL,
        display_order INTEGER NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_blog_photos_post ON blog_photos(post_id);
      ALTER TABLE blog_photos ADD COLUMN IF NOT EXISTS caption VARCHAR(200);
    `).catch((err) => { photosReady = null; throw err; });
  }
  return photosReady;
};

/**
 * addPhoto — append a photo to a post (placed after the existing ones; the first is the cover).
 * The count check and insert run in one statement, so two parallel uploads can't pass 12.
 * @returns {Promise<object|null>} the row, or null when the post already has the maximum
 */
const addPhoto = async (postId, s3Key, caption = null) => {
  await ensurePhotoTable();
  const result = await pool.query(
    `INSERT INTO blog_photos (post_id, s3_key, display_order, caption, uploaded_at)
     SELECT $1, $2, COALESCE(MAX(display_order) + 1, 0), $3, NOW()
     FROM blog_photos WHERE post_id = $1
     HAVING COUNT(*) < $4
     RETURNING id, post_id, s3_key, display_order, caption, uploaded_at`,
    [postId, s3Key, caption, MAX_PHOTOS_PER_POST]
  );
  return result.rows[0] || null;
};

/** postExists — any status (photo routes are admin-only, so drafts count too). */
const postExists = async (postId) => {
  const result = await pool.query('SELECT 1 FROM blog_posts WHERE id = $1', [postId]);
  return result.rows.length > 0;
};

/** listPhotos — a post's photos in display order. */
const listPhotos = async (postId) => {
  await ensurePhotoTable();
  const result = await pool.query(
    `SELECT id, post_id, s3_key, display_order, caption, uploaded_at
     FROM blog_photos WHERE post_id = $1 ORDER BY display_order ASC, uploaded_at ASC`,
    [postId]
  );
  return result.rows;
};

/** coverKeys — first photo of each post: Map(postId → s3_key). */
const coverKeys = async (postIds) => {
  if (!postIds.length) return new Map();
  await ensurePhotoTable();
  const result = await pool.query(
    `SELECT DISTINCT ON (post_id) post_id, s3_key
     FROM blog_photos WHERE post_id = ANY($1::uuid[])
     ORDER BY post_id, display_order ASC, uploaded_at ASC`,
    [postIds]
  );
  return new Map(result.rows.map(r => [r.post_id, r.s3_key]));
};

/** updatePhotoCaption — returns the row, or null if the photo isn't on that post. */
const updatePhotoCaption = async (postId, photoId, caption) => {
  await ensurePhotoTable();
  const result = await pool.query(
    `UPDATE blog_photos SET caption = $3 WHERE id = $2 AND post_id = $1
     RETURNING id, post_id, s3_key, display_order, caption, uploaded_at`,
    [postId, photoId, caption]
  );
  return result.rows[0] || null;
};

/** deletePhoto — removes the row; returns its s3_key (to delete the object) or null. */
const deletePhoto = async (postId, photoId) => {
  await ensurePhotoTable();
  const result = await pool.query(
    'DELETE FROM blog_photos WHERE id = $2 AND post_id = $1 RETURNING s3_key',
    [postId, photoId]
  );
  return result.rows[0]?.s3_key || null;
};

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN (3 functions)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * approvePost — Publish a pending post (only from pending_review status)
 * @param {string} postId — Post ID (UUID)
 * @returns {Promise<object>} Updated post object
 * @throws {Error} "Post not in pending_review state" if status is not pending_review
 */
const approvePost = async (postId) => {
  const sql = `
    UPDATE blog_posts
    SET status = 'published', published_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND status = 'pending_review'
    RETURNING id, user_id, title, description, content, location, country, travel_dates, category, status, admin_notes, created_at, updated_at, published_at;
  `;

  const result = await pool.query(sql, [postId]);

  if (!result.rows.length) {
    throw new Error('Post not in pending_review state');
  }

  return result.rows[0];
};

/**
 * rejectPost — Reject a pending post and add admin notes (only from pending_review status)
 * @param {string} postId — Post ID (UUID)
 * @param {string} adminNotes — Rejection reason/feedback for author
 * @returns {Promise<object>} Updated post object
 * @throws {Error} "Post not in pending_review state" if status is not pending_review
 */
const rejectPost = async (postId, adminNotes) => {
  const sql = `
    UPDATE blog_posts
    SET status = 'rejected', admin_notes = $1, updated_at = NOW()
    WHERE id = $2 AND status = 'pending_review'
    RETURNING id, user_id, title, description, content, location, country, travel_dates, category, status, admin_notes, created_at, updated_at, published_at;
  `;

  const result = await pool.query(sql, [adminNotes, postId]);

  if (!result.rows.length) {
    throw new Error('Post not in pending_review state');
  }

  return result.rows[0];
};

/**
 * listPendingPosts — Fetch all pending_review posts with author email, pagination
 * @param {number} page — Page number (1-based), default 1
 * @returns {Promise<array>} Array of pending posts
 */
const listPendingPosts = async (page = 1) => {
  const sql = `
    SELECT
      bp.id, bp.user_id, bp.title, bp.description, bp.content,
      bp.location, bp.country, bp.travel_dates, bp.category,
      bp.status, bp.admin_notes, bp.created_at, bp.updated_at, bp.published_at,
      u.email AS author_email
    FROM blog_posts bp
    JOIN users u ON bp.user_id = u.id
    WHERE bp.status = 'pending_review'
    ORDER BY bp.created_at ASC
    LIMIT 10 OFFSET $1;
  `;

  const pageNum = Math.max(1, parseInt(page));
  const offset = (pageNum - 1) * 10;

  const result = await pool.query(sql, [offset]);
  return result.rows;
};

// ═════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Posts
  createPost,
  getPost,
  listPosts,
  updatePost,
  deletePost,

  // Comments
  createComment,
  updateComment,
  deleteComment,
  listCommentsByPost,

  // Photos
  MAX_PHOTOS_PER_POST,
  postExists,
  addPhoto,
  listPhotos,
  coverKeys,
  updatePhotoCaption,
  deletePhoto,

  // Admin
  approvePost,
  rejectPost,
  listPendingPosts,
};
