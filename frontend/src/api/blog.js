// frontend/src/api/blog.js
// All API calls related to blog operations.
// Import API_URL from env — never hardcode.

const API_URL = import.meta.env.VITE_API_URL;
const BLOG_API = `${API_URL}/blog`;

/**
 * Helper function to build Authorization header if token is provided
 * @param {string|null} token - Optional auth token
 * @returns {Object} Headers object
 */
function getHeaders(token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Helper to handle API errors
 * @param {Response} res
 * @returns {Promise<void>}
 */
async function handleError(res) {
  let errorMsg = `API error: ${res.status}`;
  try {
    const data = await res.json();
    errorMsg = data.message || data.error || errorMsg;
  } catch {
    // Could not parse error response
  }
  throw new Error(errorMsg);
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * POST OPERATIONS
 * ──────────────────────────────────────────────────────────────────────
 */

/**
 * Fetch all posts with optional filters
 * @param {Object} filters - { category, country, location, search, page }
 * @param {string|null} token - Optional auth token
 * @returns {Promise<{posts: Array, total: number, page: number}>}
 */
export async function fetchPosts(filters = {}, token = null) {
  try {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.country) params.append('country', filters.country);
    if (filters.location) params.append('location', filters.location);
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', filters.page);

    const url = params.toString() ? `${BLOG_API}?${params.toString()}` : BLOG_API;
    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to fetch posts: ${err.message}`);
  }
}

/**
 * Fetch a single post by ID
 * @param {string} postId
 * @param {string|null} userId - Optional user ID to track views
 * @param {string|null} token - Optional auth token
 * @returns {Promise<Object>} Post object with comments and photos
 */
export async function fetchPost(postId, userId = null, token = null) {
  try {
    if (!postId) throw new Error('postId is required');

    let url = `${BLOG_API}/${postId}`;
    if (userId) url += `?userId=${encodeURIComponent(userId)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to fetch post: ${err.message}`);
  }
}

/**
 * Create a new post
 * @param {Object} postData - { title, description, content, location, country, travelDates, category }
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<Object>} Created post object
 */
export async function createPost(postData, token = null) {
  try {
    if (!postData.title || !postData.content) {
      throw new Error('Title and content are required');
    }

    const res = await fetch(BLOG_API, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify(postData),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to create post: ${err.message}`);
  }
}

/**
 * Update an existing post
 * @param {string} postId
 * @param {Object} postData - { title, description, content, location, country, travelDates, category }
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<Object>} Updated post object
 */
export async function updatePost(postId, postData, token = null) {
  try {
    if (!postId) throw new Error('postId is required');

    const res = await fetch(`${BLOG_API}/${postId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify(postData),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to update post: ${err.message}`);
  }
}

/**
 * Delete a post
 * @param {string} postId
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<{success: boolean}>}
 */
export async function deletePost(postId, token = null) {
  try {
    if (!postId) throw new Error('postId is required');

    const res = await fetch(`${BLOG_API}/${postId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return { success: true };
  } catch (err) {
    throw new Error(`Failed to delete post: ${err.message}`);
  }
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * COMMENT OPERATIONS
 * ──────────────────────────────────────────────────────────────────────
 */

/**
 * Fetch comments for a post
 * @param {string} postId
 * @param {string|null} token - Optional auth token
 * @returns {Promise<Array>} Array of comment objects
 */
export async function fetchComments(postId, token = null) {
  try {
    if (!postId) throw new Error('postId is required');

    const res = await fetch(`${BLOG_API}/${postId}/comments`, {
      method: 'GET',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : data.comments || [];
  } catch (err) {
    throw new Error(`Failed to fetch comments: ${err.message}`);
  }
}

/**
 * Create a comment on a post
 * @param {string} postId
 * @param {string} content - Comment text
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<Object>} Created comment object
 */
export async function createComment(postId, content, token = null) {
  try {
    if (!postId) throw new Error('postId is required');
    if (!content || typeof content !== 'string') throw new Error('content is required and must be a string');

    const res = await fetch(`${BLOG_API}/${postId}/comments`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to create comment: ${err.message}`);
  }
}

/**
 * Update a comment
 * @param {string} commentId
 * @param {string} content - Updated comment text
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<Object>} Updated comment object
 */
export async function updateComment(commentId, content, token = null) {
  try {
    if (!commentId) throw new Error('commentId is required');
    if (!content || typeof content !== 'string') throw new Error('content is required and must be a string');

    const res = await fetch(`${BLOG_API}/comments/${commentId}`, {
      method: 'PUT',
      headers: getHeaders(token),
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to update comment: ${err.message}`);
  }
}

/**
 * Delete a comment
 * @param {string} commentId
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteComment(commentId, token = null) {
  try {
    if (!commentId) throw new Error('commentId is required');

    const res = await fetch(`${BLOG_API}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return { success: true };
  } catch (err) {
    throw new Error(`Failed to delete comment: ${err.message}`);
  }
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * PHOTO OPERATIONS
 * ──────────────────────────────────────────────────────────────────────
 */

/**
 * Request a presigned URL for uploading a photo to S3
 * @param {string} postId
 * @param {string} fileName - Original file name
 * @param {number} fileSize - File size in bytes
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<{uploadUrl: string, s3Key: string}>}
 */
export async function requestPhotoUploadUrl(postId, fileName, fileSize, token = null) {
  try {
    if (!postId) throw new Error('postId is required');
    if (!fileName) throw new Error('fileName is required');
    if (!fileSize || fileSize <= 0) throw new Error('fileSize is required and must be > 0');

    const res = await fetch(`${BLOG_API}/${postId}/photos/request`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ fileName, fileSize }),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to request upload URL: ${err.message}`);
  }
}

/**
 * Upload a photo directly to S3 using presigned URL
 * @param {string} uploadUrl - Presigned URL from requestPhotoUploadUrl
 * @param {File} file - File object to upload
 * @returns {Promise<{success: boolean}>}
 */
export async function uploadPhotoToS3(uploadUrl, file) {
  try {
    if (!uploadUrl) throw new Error('uploadUrl is required');
    if (!file || !(file instanceof File)) throw new Error('file must be a valid File object');

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });

    if (!res.ok) {
      throw new Error(`S3 upload failed: ${res.status}`);
    }

    return { success: true };
  } catch (err) {
    throw new Error(`Failed to upload photo: ${err.message}`);
  }
}

/**
 * Confirm photo upload in database
 * @param {string} postId
 * @param {string} s3Key - S3 object key returned from requestPhotoUploadUrl
 * @param {number} displayOrder - Order in which to display the photo
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<Object>} Photo metadata object
 */
export async function confirmPhotoUpload(postId, s3Key, displayOrder, token = null) {
  try {
    if (!postId) throw new Error('postId is required');
    if (!s3Key) throw new Error('s3Key is required');
    if (typeof displayOrder !== 'number') throw new Error('displayOrder is required and must be a number');

    const res = await fetch(`${BLOG_API}/${postId}/photos/confirm`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ s3Key, displayOrder }),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to confirm photo upload: ${err.message}`);
  }
}

/**
 * Fetch all photos for a post
 * @param {string} postId
 * @param {string|null} token - Optional auth token
 * @returns {Promise<Array>} Array of photo objects
 */
export async function fetchPhotos(postId, token = null) {
  try {
    if (!postId) throw new Error('postId is required');

    const res = await fetch(`${BLOG_API}/${postId}/photos`, {
      method: 'GET',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : data.photos || [];
  } catch (err) {
    throw new Error(`Failed to fetch photos: ${err.message}`);
  }
}

/**
 * ──────────────────────────────────────────────────────────────────────
 * ADMIN OPERATIONS
 * ──────────────────────────────────────────────────────────────────────
 */

/**
 * Approve a post (admin only)
 * @param {string} postId
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<Object>} Updated post object
 */
export async function approvePost(postId, token = null) {
  try {
    if (!postId) throw new Error('postId is required');

    const res = await fetch(`${BLOG_API}/${postId}/approve`, {
      method: 'POST',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to approve post: ${err.message}`);
  }
}

/**
 * Reject a post with admin notes (admin only)
 * @param {string} postId
 * @param {string} adminNotes - Reason for rejection
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<Object>} Updated post object
 */
export async function rejectPost(postId, adminNotes, token = null) {
  try {
    if (!postId) throw new Error('postId is required');
    if (!adminNotes) throw new Error('adminNotes is required');

    const res = await fetch(`${BLOG_API}/${postId}/reject`, {
      method: 'POST',
      headers: getHeaders(token),
      body: JSON.stringify({ adminNotes }),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to reject post: ${err.message}`);
  }
}

/**
 * Fetch pending posts for admin review
 * @param {number} page - Page number (default 1)
 * @param {string|null} token - Auth token (required)
 * @returns {Promise<{posts: Array, total: number, page: number}>}
 */
export async function fetchPendingPosts(page = 1, token = null) {
  try {
    const params = new URLSearchParams({ page: String(page) });
    const res = await fetch(`${BLOG_API}/admin/pending?${params.toString()}`, {
      method: 'GET',
      headers: getHeaders(token),
    });

    if (!res.ok) {
      await handleError(res);
    }

    return await res.json();
  } catch (err) {
    throw new Error(`Failed to fetch pending posts: ${err.message}`);
  }
}
