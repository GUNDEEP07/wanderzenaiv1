-- 006_blog_photo_captions.sql
-- Story photos (Nov 2026): the team adds photos in the admin editor; the first is the cover.
-- blog_photos was in schema.sql but may never have been created in RDS, so
-- backend/functions/blog-handler/db/blog.js (ensurePhotoTable) creates it, and the caption
-- column, on first use (CI cannot reach RDS). Running this by hand is harmless.
--
-- Rollback: ALTER TABLE blog_photos DROP COLUMN IF EXISTS caption;
--   (photo objects live in the PDF bucket under blog/{postId}/)

CREATE TABLE IF NOT EXISTS blog_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  s3_key VARCHAR(500) NOT NULL,
  display_order INTEGER NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blog_photos_post ON blog_photos(post_id);
ALTER TABLE blog_photos ADD COLUMN IF NOT EXISTS caption VARCHAR(200);
