#!/usr/bin/env node
/**
 * Delete prerendered pages that the latest prerender no longer produced (a deleted story, a
 * renamed title's old address) so they stop answering 200. Only under blog/ and guides/, and
 * blog/ only when the blog list was read (an API outage must never empty the blog).
 * Usage: node scripts/prune-pages.mjs <bucket> <dist>
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const [bucket, dist] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(path.join(dist, 'prerender-manifest.json'), 'utf8'));
const keep = new Set(manifest.files.map((f) => f.split(path.sep).join('/')));
const prefixes = ['guides/', ...(manifest.blogListed ? ['blog/'] : [])];

for (const prefix of prefixes) {
  const out = execFileSync('aws', ['s3api', 'list-objects-v2', '--bucket', bucket, '--prefix', prefix, '--query', 'Contents[].Key', '--output', 'json'], { encoding: 'utf8' });
  const keys = (JSON.parse(out || 'null') || []).filter((k) => k.endsWith('/index.html') || k === `${prefix}index.html`);
  const stale = keys.filter((k) => !keep.has(k));
  for (const k of stale) {
    execFileSync('aws', ['s3', 'rm', `s3://${bucket}/${k}`], { stdio: 'inherit' });
  }
  console.log(`${prefix}: ${keys.length} pages, ${stale.length} removed`);
}
