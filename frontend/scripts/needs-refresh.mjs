#!/usr/bin/env node
/**
 * Should the scheduled SEO refresh run? Yes when the published blog posts (ids, addresses,
 * edit times) differ from what the live site was last prerendered with, or when that is more
 * than a day old. Writes run=true|false to $GITHUB_OUTPUT (and prints the reason).
 * Usage: node scripts/needs-refresh.mjs <site url> <api url>
 */
import { appendFileSync } from 'node:fs';
import { fetchPublishedPosts } from './blog-posts.mjs';
import { blogSlug } from '../src/utils/blogSlug.js';

const [site, api] = process.argv.slice(2);
const MAX_AGE_MS = 24 * 3600 * 1000;
const say = (run, why) => {
  console.log(`run=${run}: ${why}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`);
};

let manifest = null;
try {
  const r = await fetch(`${site}/prerender-manifest.json`, { cache: 'no-store' });
  if (r.ok) manifest = await r.json();
} catch { /* none yet */ }
if (!manifest?.generatedAt) { say(true, 'no manifest on the live site'); process.exit(0); }

const posts = await fetchPublishedPosts(api, { origin: site });
if (!posts) { say(false, 'blog API unreadable: keep the current pages'); process.exit(0); }

const key = (list) => list.map((p) => `${p.id}|${p.slug}|${p.updated || ''}`).sort().join('\n');
const now = posts.map((p) => ({ id: p.id, slug: blogSlug(p), updated: p.updated_at || p.published_at || null }));
if (key(now) !== key(manifest.blog || [])) say(true, 'blog posts changed since the last prerender');
else if (!manifest.blogListed) say(true, 'last prerender could not read the blog');
else if (Date.now() - Date.parse(manifest.generatedAt) > MAX_AGE_MS) say(true, 'pages older than a day (photo links, stats)');
else say(false, 'nothing changed');
