# Blog Feature Design Specification

**Date:** 2026-07-03  
**Feature:** Travel Journey Blog with Photos, Comments, and Admin Approval  
**Status:** Approved for Implementation

---

## 1. Overview

Add a community travel blog section to WanderZenAI where logged-in users can share their travel experiences with photos, stories, and insights. All users can view published posts; only logged-in users can comment. Admin approval workflow ensures quality before publication.

**Key Features:**
- Create/edit/delete blog posts with rich text content
- Upload multiple photos per post (max 10MB total)
- Auto-approved comments (users can edit/delete own)
- Share posts via copy-to-clipboard link
- Filter by category and country
- Admin approval workflow before publication

---

## 2. Database Schema

### 2.1 blog_posts Table

```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  travel_dates DATERANGE,
  category VARCHAR(50) NOT NULL DEFAULT 'other' 
    CHECK (category IN ('tips', 'adventure', 'culture', 'food', 'budget', 'other')),
  status VARCHAR(50) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'published', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_blog_posts_user ON blog_posts(user_id);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_country ON blog_posts(country);
CREATE INDEX idx_blog_posts_category ON blog_posts(category);
CREATE INDEX idx_blog_posts_published ON blog_posts(published_at DESC);
```

### 2.2 blog_comments Table

```sql
CREATE TABLE blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  user_email VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_comments_post ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_user ON blog_comments(user_id);
```

### 2.3 blog_photos Table

```sql
CREATE TABLE blog_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  s3_key VARCHAR(500) NOT NULL,
  display_order INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_photos_post ON blog_photos(post_id);
```

---

## 3. Backend Architecture

### 3.1 New Lambda Function: blog-handler

**Purpose:** Handle all blog operations (CRUD for posts, comments, photos, admin approvals)

**Environment Variables:**
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (shared layer)
- `PDF_BUCKET` (reuse for blog photos: `{PDF_BUCKET}/blog-photos/`)

**API Endpoints:**

#### Posts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/blog` | Public | List published posts (paginated, filterable by category/country/search) |
| GET | `/blog/:id` | Public | Get single published post + comments |
| POST | `/blog` | Protected | Create new post (status: 'draft') |
| PUT | `/blog/:id` | Protected (author only) | Edit post (only if draft/rejected) |
| DELETE | `/blog/:id` | Protected (author/admin) | Delete post |
| POST | `/blog/:id/approve` | Protected (admin only) | Approve post (status: 'published', set published_at) |
| POST | `/blog/:id/reject` | Protected (admin only) | Reject post (status: 'rejected', require admin_notes) |
| GET | `/blog/admin/pending` | Protected (admin only) | List pending review posts |

#### Comments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/blog/:id/comments` | Protected | Create comment (auto-approved) |
| PUT | `/blog/comments/:commentId` | Protected (author only) | Edit comment |
| DELETE | `/blog/comments/:commentId` | Protected (author/admin) | Delete comment |

#### Photos

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/blog/:id/photos` | Protected (author only) | Request S3 signed URL for upload |
| GET | `/blog/:id/photos` | Public | List photos for post |

### 3.2 Photo Upload Flow

1. **Frontend** calls `POST /blog/:id/photos` with `{ filename, size }`
2. **Lambda** validates:
   - Post belongs to user or user is admin
   - Total post size + new file ≤ 10MB
   - File type is image (jpg, png, webp, gif)
3. **Lambda** generates S3 signed PUT URL (expires in 15 minutes)
4. **Frontend** uploads directly to S3 using signed URL
5. **Frontend** notifies Lambda that upload succeeded (POST with s3_key + display_order)
6. **Lambda** stores metadata in blog_photos table

### 3.3 Search & Filtering

**Query Parameters for GET /blog:**
- `category=adventure` — filter by category
- `country=Thailand` — filter by country
- `location=Bangkok` — filter by specific location
- `search=keyword` — search post titles, descriptions, content
- `page=1` — pagination (10 posts/page)
- Combine filters: `?category=budget&country=Vietnam&page=1`

**Database Query Strategy:**
- Use full-text search on title + description for keyword search
- Simple column filters for category/country/location
- Order by published_at DESC for list view

---

## 4. Frontend Architecture

### 4.1 Routes

| Route | Page Component | Auth | Description |
|-------|---|------|---|
| `/blog` | BlogListPage | Public | List published posts, filters, search |
| `/blog/:id` | BlogDetailPage | Public | Post detail, comments, share button |
| `/blog/create` | BlogCreatePage | Protected | Create/edit post, upload photos |
| `/admin/blog` | AdminBlogPanel | Admin-gated | Approve/reject pending posts |

### 4.2 BlogListPage (`/blog`)

**Layout:**
- Hero section: "Travel Stories from Our Community"
- Sidebar (left):
  - Category dropdown
  - Country filter
  - Apply Filters button
- Main area:
  - Search bar (title/keyword search)
  - Active filter chips (removable)
  - Post cards grid (3 columns on desktop, 1 on mobile)
  - Pagination

**Post Card:**
- Featured image (if available)
- Title
- Author name
- Publish date
- Location + Country
- Category tag
- Excerpt from description
- Click → navigate to detail page

### 4.3 BlogDetailPage (`/blog/:id`)

**Layout:**
- Header: Title, author, publish date, location, travel dates, category
- Featured image (if available)
- Content area: Full post body with inline photos
- Share section:
  - "Copy Link" button (copies current URL to clipboard, shows toast "Copied!")
  - Shareable link display
- Comments section:
  - Comment count
  - If logged-in: comment form (textarea + submit)
  - If not logged-in: "Log in to comment" message
  - Comments list (newest first):
    - Author name, timestamp, content
    - If comment author: edit/delete buttons
    - Edit form: inline textarea + save/cancel
    - Delete: confirmation modal

### 4.4 BlogCreatePage (`/blog/create`)

**Form Fields:**
- Title (text input, required)
- Location (text input, required)
- Travel dates (date range picker, required)
- Category (dropdown: tips, adventure, culture, food, budget, other)
- Description (textarea, required, shown in list preview)
- Content (rich text editor or markdown textarea, required)
- Photo upload area:
  - Drag-drop zone or click to browse
  - Shows uploaded photos with display order (drag to reorder)
  - Running total: "X MB / 10 MB used"
  - Delete button per photo
- Status badge: "Draft", "Pending Review", "Published", "Rejected"
- Admin notes (if post is rejected, show inline)
- Buttons:
  - "Save as Draft" → status: 'draft', stays on page
  - "Submit for Review" → status: 'pending_review', redirect to post detail
  - "Cancel" → confirm if unsaved changes, redirect to /blog

**Edit Mode:**
- Pre-populate all fields if post_id in URL params
- Only author can edit draft/rejected posts
- Only show if post status is draft or rejected

### 4.5 AdminBlogPanel (`/admin/blog`)

**Layout:**
- Tab/filter: "Pending" and "Rejected" posts
- Post list:
  - For each post: title, author email, submit date, excerpt
  - Action buttons: Approve, Reject
- Reject form:
  - Textarea for admin_notes (reason for rejection)
  - Submit → reject post, notify author

**Notifications:**
- Toast on approve/reject success
- Author receives notification (email or in-app) when post status changes

### 4.6 New Components

| Component | Purpose |
|-----------|---------|
| `BlogPostCard.jsx` | Post preview card for list view |
| `BlogCommentThread.jsx` | Comments section with form |
| `PhotoUploadArea.jsx` | Drag-drop photo uploader |
| `RichTextEditor.jsx` | Content editor (textarea initially, upgrade to Monaco/Quill if needed) |
| `CategoryFilter.jsx` | Category dropdown |
| `CountryFilter.jsx` | Country filter dropdown |
| `ShareButton.jsx` | Copy-to-clipboard share button |

---

## 5. Photo Storage & Optimization

**S3 Bucket Structure:**
```
s3://{PDF_BUCKET}/
  blog-photos/
    {user_id}/
      {post_id}/
        photo-1-{timestamp}.jpg
        photo-2-{timestamp}.png
```

**Constraints:**
- Max 10MB per post (enforced at Lambda layer)
- Supported formats: jpg, png, webp, gif
- Signed URLs valid for: 7 days (public read)
- No automatic resizing initially (can add later)

---

## 6. Admin Approval Workflow

**State Transitions:**

```
draft → submit → pending_review → {approve → published}
                                  {reject → rejected → edit → pending_review}
```

1. User creates post (status: 'draft')
2. User submits for review (status: 'pending_review')
3. Admin reviews in `/admin/blog`
   - **Approve:** status → 'published', published_at = now
   - **Reject:** status → 'rejected', admin_notes = reason
4. If rejected, user can edit and resubmit

**Notifications:**
- Email user when post is approved (with link to published post)
- Email user when post is rejected (with admin notes)

---

## 7. Comments System

**Features:**
- Auto-approved (no moderation queue)
- Display: author name, timestamp, content
- Edit: inline form, only by comment author
- Delete: confirmation required, only by author or admin
- Order: newest first

**Constraints:**
- Logged-in users only (ProtectedRoute)
- No nested/threaded replies (flat list)
- No comment character limit (but enforce at DB level if needed)

---

## 8. Sharing Mechanism

**Share Button:**
- Location: Post detail page, prominent section above comments
- Action: Copy post URL to clipboard
- UX: Button text changes to "Copied!" for 2 seconds, then reverts
- Fallback: Also show shareable link as text (in case copy fails)

**Shareable Link Format:**
```
https://wanderzenai.com/blog/{post_id}
```

---

## 9. Security Considerations

1. **Authentication:** Use existing AuthContext; protect routes with ProtectedRoute
2. **Authorization:**
   - Only post author can edit/delete own posts (check user_id)
   - Only admins can approve/reject (check user role)
   - Only comment author can edit/delete own comments
3. **File Upload:**
   - Validate file type server-side (whitelist: jpg, png, webp, gif)
   - Validate file size (reject if >10MB total)
   - Store in user-segregated S3 prefix for isolation
4. **Database:**
   - Use parameterized queries (existing shared layer handles this)
   - Validate input lengths (title ≤ 255, category in enum)
5. **Content Moderation:**
   - Rely on admin approval for now (no automated filters)
   - Users can report inappropriate content (future feature)

---

## 10. Testing Strategy

**Unit Tests:**
- Photo size validation logic
- Status transition rules (draft → pending → published/rejected)
- Comment ownership checks (edit/delete)

**Integration Tests:**
- Create post → upload photos → submit for review
- Approve post flow
- Comment create/edit/delete
- Search/filter by category, country, location

**Manual Testing:**
- Photo upload with various file sizes
- Rich text content rendering
- Comments on mobile
- Share button (copy-to-clipboard)
- Admin approval panel

---

## 11. Future Enhancements

- Photo optimization/resizing (CloudFlare or serverless image optimization)
- Full-text search indexing (Elasticsearch)
- Post analytics (views, engagement)
- Like/upvote feature for posts
- User follow/subscription
- Notifications (email, in-app)
- Social media share buttons
- Hashtags for posts
- Post edit history

---

## 12. Success Criteria

✓ Users can create, edit, delete posts  
✓ Users can upload multiple photos (max 10MB)  
✓ Admin approval workflow functional  
✓ Logged-in users can comment (auto-approved)  
✓ Users can edit/delete own comments  
✓ Share button copies post URL  
✓ Filter by category and country works  
✓ Search by title/location works  
✓ All posts and comments display correctly  
✓ Mobile responsive  

---

## Appendix: Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React, React Router, existing inline CSS pattern |
| Backend | Node 20 Lambda, PostgreSQL shared layer |
| Storage | S3 (blog-photos prefix) |
| Editor | Textarea initially, upgrade to Quill/Monaco if needed |
| Auth | Existing AuthContext + ProtectedRoute |
