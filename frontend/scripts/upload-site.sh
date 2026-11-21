#!/usr/bin/env bash
# Upload the built (and prerendered) site to the frontend bucket.
#   upload-site.sh <bucket> <dist> [full|pages]
# full  — hashed assets, icons, service worker, robots, then every page (a deploy)
# pages — only the HTML pages, sitemap and manifest (the scheduled SEO refresh)
# Assets go first so a new page never points at a file that isn't there yet.
set -euo pipefail
BUCKET="$1"; DIST="$2"; MODE="${3:-full}"
NOCACHE="no-cache, no-store, must-revalidate"

if [ "$MODE" = "full" ]; then
  # Hashed files never change. No --delete: tabs opened before this deploy still load theirs.
  aws s3 sync "$DIST/assets" "s3://$BUCKET/assets" --cache-control "public, max-age=31536000, immutable"
  # Icons and the share image keep their names, so they may change: a day.
  aws s3 sync "$DIST" "s3://$BUCKET" --exclude "*" --exclude "assets/*" \
    --include "*.png" --include "*.ico" --include "*.svg" --include "*.webp" --include "*.jpg" \
    --cache-control "public, max-age=86400"
  # The offline service worker must never be cached, or a fixed version couldn't reach people.
  aws s3 cp "$DIST/sw.js" "s3://$BUCKET/sw.js" --cache-control "$NOCACHE" --content-type "text/javascript"
  aws s3 cp "$DIST/robots.txt" "s3://$BUCKET/robots.txt" --cache-control "public, max-age=3600" --content-type "text/plain; charset=utf-8"
  # llms.txt: the site guide for AI assistants (built from the route data by build-guides).
  aws s3 cp "$DIST/llms.txt" "s3://$BUCKET/llms.txt" --cache-control "public, max-age=3600" --content-type "text/plain; charset=utf-8"
fi

# Every page: prerendered pages, the app shell, 404, old-address redirects.
aws s3 cp "$DIST" "s3://$BUCKET" --recursive --exclude "*" --include "*.html" \
  --cache-control "$NOCACHE" --content-type "text/html; charset=utf-8"
aws s3 cp "$DIST/sitemap.xml" "s3://$BUCKET/sitemap.xml" --cache-control "public, max-age=3600" --content-type "application/xml; charset=utf-8"
aws s3 cp "$DIST/prerender-manifest.json" "s3://$BUCKET/prerender-manifest.json" --cache-control "$NOCACHE" --content-type "application/json"

node "$(dirname "$0")/prune-pages.mjs" "$BUCKET" "$DIST"
