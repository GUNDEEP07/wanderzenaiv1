'use strict';

const { Pool } = require('pg');

// ─── Database connection pool ────────────────────────────────────────────────
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: 5432,
  ssl: process.env.DB_HOST === 'localhost' || process.env.DB_HOST === '127.0.0.1'
    ? false
    : { rejectUnauthorized: false },
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
const createPost = async (userId, title, description, content, location, country, travelDates, category) => {
  const sql = `
    INSERT INTO blog_posts (user_id, title, description, content, location, country, travel_dates, category, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', NOW(), NOW())
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
      u.email AS author_email
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
      u.email AS author_email
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
const updatePost = async (postId, userId, updates) => {
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

  // Check authorization
  if (post.user_id !== userId) {
    throw new Error('Unauthorized');
  }

  // Check status — can only edit draft or rejected
  if (post.status !== 'draft' && post.status !== 'rejected') {
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
    RETURNING id, post_id, user_id, user_email, content, created_at, updated_at;
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
    RETURNING id, post_id, user_id, user_email, content, created_at, updated_at;
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
    SELECT id, post_id, user_id, user_email, content, created_at, updated_at
    FROM blog_comments
    WHERE post_id = $1
    ORDER BY created_at DESC;
  `;

  const result = await pool.query(sql, [postId]);
  return result.rows;
};

// ═════════════════════════════════════════════════════════════════════════════
// PHOTOS (2 functions)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * addPhoto — Insert new blog photo
 * @param {string} postId — Post ID (UUID)
 * @param {string} s3Key — S3 object key (path in bucket)
 * @param {number} displayOrder — Display order index (0, 1, 2, ...)
 * @returns {Promise<object>} Created photo object
 */
const addPhoto = async (postId, s3Key, displayOrder) => {
  const sql = `
    INSERT INTO blog_photos (post_id, s3_key, display_order, uploaded_at)
    VALUES ($1, $2, $3, NOW())
    RETURNING id, post_id, s3_key, display_order, uploaded_at;
  `;

  const result = await pool.query(sql, [postId, s3Key, displayOrder]);

  if (!result.rows.length) {
    throw new Error('Failed to add photo');
  }

  return result.rows[0];
};

/**
 * listPhotos — Fetch all photos for a post, ordered by display_order
 * @param {string} postId — Post ID (UUID)
 * @returns {Promise<array>} Array of photos
 */
const listPhotos = async (postId) => {
  const sql = `
    SELECT id, post_id, s3_key, display_order, uploaded_at
    FROM blog_photos
    WHERE post_id = $1
    ORDER BY display_order ASC;
  `;

  const result = await pool.query(sql, [postId]);
  return result.rows;
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
  addPhoto,
  listPhotos,

  // Admin
  approvePost,
  rejectPost,
  listPendingPosts,
};
