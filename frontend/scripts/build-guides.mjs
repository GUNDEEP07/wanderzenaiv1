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
const { COUNTRIES, REGIONS, fitDays, monthRanges } = require(path.resolve(here, '../../backend/layers/shared/nodejs/curated-routes.js'));
const OUT = path.resolve(here, '../src/data/guides.json');
// Names and addresses only, for links on pages that shouldn't load the whole guides file.
const OUT_INDEX = path.resolve(here, '../src/data/guides-index.json');
// llms.txt (llmstxt.org): a plain-text guide to the site for AI assistants and answer engines,
// built from the same route data, so it can never disagree with the site.
const OUT_LLMS = path.resolve(here, '../public/llms.txt');
// Regions and which are live (promoted): the site reads this instead of a hard-coded list.
const OUT_REGIONS = path.resolve(here, '../src/data/regions.json');

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function buildGuides() {
  return Object.values(COUNTRIES).map((c) => ({
    slug: slug(c.name),
    name: c.name,
    region: c.region,
    routes: c.routes.map((r) => {
      const days = Math.max(1, Math.round(r.bases.reduce((a, b) => a + b.weight, 0)));
      return {
        id: r.id,
        name: r.name,
        summary: r.summary,
        kidFriendly: !!r.kidFriendly,
        // Best months for this route's region (1 = Jan): Explore and the home page rank by them.
        bestMonths: r.seasons?.best || [],
        bestLabel: r.seasons ? monthRanges(r.seasons.best) : '',
        seasonNote: r.seasons?.note || '',
        photoQuery: r.photoQuery || '',
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

const SITE = 'https://www.wanderzenai.com';

/** Markdown for /llms.txt. No prices (they live in Stripe and change): it points to /pricing. */
function buildLlmsTxt(guides) {
  const live = REGIONS.filter(r => r.live).sort((a, b) => a.order - b.order);
  const liveIds = live.map(r => r.id);
  const ordered = [...guides].sort((a, b) =>
    (liveIds.includes(b.region) - liveIds.includes(a.region)) || (liveIds.indexOf(a.region) - liveIds.indexOf(b.region)));
  const regionNames = live.map(r => r.name).join(', ') || 'selected countries';
  const lines = [
    '# WanderZenAI',
    '',
    '> WanderZenAI writes slow-travel trip plans, day by day. A traveller says where, when and who is coming; they get a',
    '> route with fewer stops and longer stays, places to stay close to nature, and every day planned around a quiet',
    '> café and a short walk, delivered as a PDF and a trip page that works offline.',
    '',
    `Any country can be planned. Hand-picked routes, with the best months for each region, cover ${guides.length} countries,`,
    `promoted first in: ${regionNames}. Day 1 of every plan is free; full trips are paid per trip (no subscription).`,
    'Plans are written by AI around hand-picked routes, using real venue listings where available.',
    '',
    '## Start here',
    '',
    `- [Plan a trip](${SITE}/plan): the planner (free to start, no account needed until the plan is written)`,
    `- [How it works and what you get](${SITE}/): home page`,
    `- [Pricing](${SITE}/pricing): current prices, in the visitor's currency`,
    `- [Explore routes](${SITE}/explore): filter hand-picked routes by month, length, travel time and kids`,
    `- [All country guides](${SITE}/guides)`,
    '',
    '## Country guides (hand-picked routes)',
    '',
  ];
  for (const g of ordered) {
    const routes = g.routes.map(r => `${r.name}, ${r.days} days, best ${r.bestLabel || 'all year'}`).join('; ');
    lines.push(`- [${g.name}](${SITE}/guides/${g.slug}): ${routes}`);
  }
  lines.push(
    '',
    '## Optional',
    '',
    `- [Travel stories](${SITE}/blog)`,
    `- [Contact](${SITE}/contact)`,
    `- [Privacy](${SITE}/privacy)`,
    `- [Terms](${SITE}/terms)`,
    '',
  );
  return lines.join('\n');
}

const guides = buildGuides();
const files = [
  [OUT_LLMS, buildLlmsTxt(guides)],
  [OUT, `${JSON.stringify(guides, null, 1)}\n`],
  [OUT_INDEX, `${JSON.stringify(guides.map(({ slug, name, region }) => ({ slug, name, region })))}\n`],
  [OUT_REGIONS, `${JSON.stringify(REGIONS.map(({ id, name, tagline, live, order }) => ({
    id, name, tagline, live, order, countries: guides.filter(g => g.region === id).map(g => g.name),
  })).sort((a, b) => a.order - b.order), null, 1)}\n`],
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
