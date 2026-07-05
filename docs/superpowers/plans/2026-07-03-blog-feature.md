# Blog Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a community travel blog where logged-in users can post travel stories with photos, comments are auto-approved, admin approval gates publication, and posts are filterable by category/country/location.

**Architecture:** Modular Lambda function (`blog-handler`) handles all blog operations (posts, comments, photos, approvals). Shared DB layer for queries. React frontend with pages for list, detail, create, and admin panel. S3 storage for photos. Admin approval workflow manages publication.

**Tech Stack:** React 18, React Router, Node 20 Lambda, PostgreSQL, S3, inline CSS styling (follow existing codebase pattern)

## Global Constraints

- Max 10MB total photos per post
- Supported photo formats: jpg, png, webp, gif
- Blog post categories: 'tips', 'adventure', 'culture', 'food', 'budget', 'other'
- Post statuses: 'draft', 'pending_review', 'published', 'rejected'
- Comments auto-approved, no moderation queue
- Pagination: 10 posts per page
- Use existing AuthContext and ProtectedRoute components
- Follow existing inline CSS + per-page CSS file pattern (no Tailwind, no styled-components)
- Database indexes required on: user_id, status, country, category, published_at, post_id (comments), email (users)

---

## Task 1: Database Schema — Add Blog Tables

**Files:**
- Modify: `infra/schema.sql` (add three new tables)

**Interfaces:**
- Produces: Three PostgreSQL tables (`blog_posts`, `blog_comments`, `blog_photos`) with proper indexes and foreign keys

**Steps:**
- [ ] Add blog_posts table to schema.sql
- [ ] Add blog_comments table to schema.sql
- [ ] Add blog_photos table to schema.sql
- [ ] Verify schema syntax
- [ ] Commit

---

## Task 2: Lambda Setup — blog-handler Function Structure

**Files:**
- Create: `backend/functions/blog-handler/index.js`
- Create: `backend/functions/blog-handler/package.json`

**Interfaces:**
- Produces: Lambda handler that routes requests to sub-handlers (posts, comments, photos, admin)

---

## Task 3: Database Query Layer — blog.js

**Files:**
- Create: `backend/functions/blog-handler/db/blog.js`

**Interfaces:**
- Produces: Functions: `createPost()`, `getPost()`, `listPosts()`, `updatePost()`, `deletePost()`, `createComment()`, `updateComment()`, `deleteComment()`, `listCommentsByPost()`, `addPhoto()`, `listPhotos()`, `approvePost()`, `rejectPost()`, `listPendingPosts()`

---

## Task 4: Utility Modules — Validation, S3, Errors

**Files:**
- Create: `backend/functions/blog-handler/utils/validation.js`
- Create: `backend/functions/blog-handler/utils/s3.js`
- Create: `backend/functions/blog-handler/utils/errors.js`

**Interfaces:**
- Produces: Functions `validatePostInput()`, `validatePhotoUpload()`, `generateS3SignedUrl()`, and error response helpers

---

## Task 5: Post CRUD Handler

**Files:**
- Create: `backend/functions/blog-handler/handlers/posts.js`

**Interfaces:**
- Produces: Functions `createPost()`, `getPost()`, `listPosts()`, `updatePost()`, `deletePost()`

---

## Task 6: Comments Handler

**Files:**
- Create: `backend/functions/blog-handler/handlers/comments.js`

**Interfaces:**
- Produces: Functions `createComment()`, `updateComment()`, `deleteComment()`

---

## Task 7: Photos Handler

**Files:**
- Create: `backend/functions/blog-handler/handlers/photos.js`

**Interfaces:**
- Produces: Functions `requestPhotoUploadUrl()`, `confirmPhotoUpload()`, `listPhotos()`

---

## Task 8: Admin Handler

**Files:**
- Create: `backend/functions/blog-handler/handlers/admin.js`

**Interfaces:**
- Produces: Functions `approvePost()`, `rejectPost()`, `listPendingPosts()`

---

## Task 9: Frontend Blog API Service Layer

**Files:**
- Create: `frontend/src/api/blog.js`

**Interfaces:**
- Produces: Functions `fetchPosts()`, `fetchPost()`, `createPost()`, `updatePost()`, `deletePost()`, `createComment()`, `updateComment()`, `deleteComment()`, `requestPhotoUploadUrl()`, `uploadPhotoToS3()`, `confirmPhotoUpload()`, `approvePost()`, `rejectPost()`, `fetchPendingPosts()`

---

## Task 10: Frontend Components — Filters and Cards

**Files:**
- Create: `frontend/src/components/blog/BlogPostCard.jsx`
- Create: `frontend/src/components/blog/ShareButton.jsx`
- Create: `frontend/src/components/blog/CategoryFilter.jsx`
- Create: `frontend/src/components/blog/CountryFilter.jsx`

**Interfaces:**
- Produces: React components with props and styling

---

## Task 11: Blog List Page

**Files:**
- Create: `frontend/src/pages/BlogListPage.jsx`
- Create: `frontend/src/css/blog.css`

**Interfaces:**
- Produces: React page component at `/blog` route with filter sidebar and post grid

---

## Task 12: Blog Detail Page (Posts + Comments)

**Files:**
- Create: `frontend/src/pages/BlogDetailPage.jsx`
- Create: `frontend/src/components/blog/BlogCommentThread.jsx`

**Interfaces:**
- Produces: React page component at `/blog/:id` route with comments section

---

## Task 13: Blog Create/Edit Page

**Files:**
- Create: `frontend/src/pages/BlogCreatePage.jsx`
- Create: `frontend/src/components/blog/PhotoUploadArea.jsx`
- Create: `frontend/src/components/blog/RichTextEditor.jsx`

**Interfaces:**
- Produces: React page component at `/blog/create` route with photo upload

---

## Task 14: Admin Blog Panel

**Files:**
- Create: `frontend/src/pages/AdminBlogPanel.jsx`

**Interfaces:**
- Produces: React page component at `/admin/blog` route for moderating posts

---

## Task 15: Frontend Routing — Add Blog Routes to App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Produces: Updated routing with new blog routes

---

## Task 16: SAM Template Update — Register blog-handler Lambda

**Files:**
- Modify: `infra/template.yaml`

**Interfaces:**
- Produces: SAM template with new blog-handler Lambda function resource and API Gateway routes

---
