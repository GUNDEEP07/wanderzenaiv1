'use strict';

/**
 * What blog readers may see (Nov 7 2026 privacy fix).
 *
 * Posts and comments come from the DB with the author's email (and posts with admin notes).
 * Public pages showed "by someone@gmail.com": every author's email was readable by anyone.
 * Readers now get a display name; the email stays visible to admins only (moderation panel),
 * and admin notes only to admins and the post's own author (why it was rejected).
 */

const ADMIN_ROLES = new Set(['admin', 'superadmin']);
const FALLBACK_NAME = 'A WanderZen traveller';

const isAdmin = (viewer) => ADMIN_ROLES.has(viewer?.userRole);

/** First name only ("Gundeep Singh" → "Gundeep"); never derived from the email. */
function displayName(name) {
  const first = typeof name === 'string' ? name.trim().split(/\s+/)[0] : '';
  return first ? first.slice(0, 40) : FALLBACK_NAME;
}

/**
 * @param {object} post row (may carry author_email, author_name, admin_notes)
 * @param {{ userId?: string|null, userRole?: string }} [viewer]
 */
function viewPost(post, viewer = {}) {
  if (!post) return post;
  const { author_email: authorEmail, author_name: authorName, admin_notes: adminNotes, ...rest } = post;
  const own = viewer.userId && post.user_id && viewer.userId === post.user_id;
  return {
    ...rest,
    author_name: displayName(authorName),
    is_mine: !!own, // the page can't compare ids itself (Firebase uid ≠ users.id)
    ...(isAdmin(viewer) ? { author_email: authorEmail ?? null } : {}),
    ...(isAdmin(viewer) || own ? { admin_notes: adminNotes ?? null } : {}),
  };
}

/** @param {object} comment row (may carry user_email, author_name) */
function viewComment(comment, viewer = {}) {
  if (!comment) return comment;
  const { user_email: userEmail, author_name: authorName, ...rest } = comment;
  return {
    ...rest,
    author_name: displayName(authorName),
    is_mine: !!(viewer.userId && comment.user_id && viewer.userId === comment.user_id),
    ...(isAdmin(viewer) ? { user_email: userEmail ?? null } : {}),
  };
}

module.exports = { viewPost, viewComment, displayName, FALLBACK_NAME };
