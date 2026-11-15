#!/usr/bin/env node
/**
 * Country guides (/guides/<country>) come from the hand-curated routes the planner uses
 * (backend/layers/shared/nodejs/curated-routes.js — the single source of truth). This writes
 * them to src/data/guides.json for the frontend. Runs before every build (npm "prebuild");
 * `--check` exits 1 if the committed file is stale (used by the unit test).
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { COUNTRIES, fitDays } = require(path.resolve(here, '../../backend/layers/shared/nodejs/curated-routes.js'));
const OUT = path.resolve(here, '../src/data/guides.json');
// Names and addresses only, for links on pages that shouldn't load the whole guides file.
const OUT_INDEX = path.resolve(here, '../src/data/guides-index.json');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildGuides() {
  return Object.values(COUNTRIES).map((c) => ({
    slug: slug(c.name),
    name: c.name,
    routes: c.routes.map((r) => {
      const days = Math.max(1, Math.round(r.bases.reduce((a, b) => a + b.weight, 0)));
      return {
        id: r.id,
        name: r.name,
        summary: r.summary,
        kidFriendly: !!r.kidFriendly,
        days,
        longestTransferHours: Math.max(0, ...r.bases.map((b) => b.transferIn?.hours || 0)),
        stops: fitDays(r.bases, days).map((b) => ({
          name: b.name,
          region: b.region,
          lat: b.lat,
          lng: b.lng,
          days: b.days,
          why: b.why,
          stayType: b.stayType,
          transferIn: b.transferIn || null,
          dayTrips: b.dayTrips || [],
        })),
      };
    }),
  }));
}

const guides = buildGuides();
const files = [
  [OUT, `${JSON.stringify(guides, null, 1)}\n`],
  [OUT_INDEX, `${JSON.stringify(guides.map(({ slug, name }) => ({ slug, name })))}\n`],
];
if (process.argv.includes('--check')) {
  for (const [file, json] of files) {
    let current = '';
    try { current = readFileSync(file, 'utf8'); } catch { /* missing */ }
    if (current !== json) {
      console.error(`${path.basename(file)} is out of date: run \`node scripts/build-guides.mjs\``);
      process.exit(1);
    }
  }
} else if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  for (const [file, json] of files) writeFileSync(file, json);
  console.log(`guides: ${guides.length} countries`);
}
