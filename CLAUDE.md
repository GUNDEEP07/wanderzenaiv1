# CLAUDE.md — WanderZenAI

AI-powered slow-travel itinerary SaaS. Live at wanderzenai.com. Solo-maintained.

## Architecture
- **Frontend:** React + Vite, deployed to S3 + CloudFront (distribution `E329HHUPH0JQTP`).
- **Backend:** AWS Lambda (Node 24, `nodejs24.x` since Nov 2026) via AWS SAM. Lambda's Node 24
  does NOT allow `require()` of ES modules — load ESM-only packages with `await import()`
  (pdf-builder does; e2e runs with `--no-experimental-require-module` to match). API Gateway prod stage:
  `y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod`.
- **DB:** RDS PostgreSQL.
- **AI:** Claude (full itinerary generation + the lightweight `/preview` endpoint).
- **Payments:** Stripe (402 gate; bypassed for rows in `test_accounts` table).
- **Email:** AWS SES.
- **Deploy:** GitHub Actions auto-deploy from `main` (repo: GUNDEEP07/wanderzenaiv1).
  No stored AWS keys (Nov 2026, P2-9): deploy.yml and seo-refresh.yml assume
  `wanderzenai-github-deploy` via GitHub OIDC (stack `wanderzenai-ci`, `infra/ci-oidc.yaml`); the
  role trusts only `main` and has PowerUser + IAM limited to `wanderzenai-prod-*` roles. A job that
  needs AWS must declare `permissions: id-token: write`. Only our site's origin may call the API (P2-10).

## Repo layout — non-obvious
- SAM template lives at `infra/template.yaml`, NOT repo root.
- `samconfig.toml` is required at deploy time. Has been missing/flaky — verify it exists
  before any `sam deploy`. If regenerating, use `sam deploy --guided` then scrub it of
  anything sensitive before committing.
- Frontend itinerary flow: `frontend/src/pages/PlanTrip.jsx` (multi-step form; it lives in
  `pages/`, not `components/`). Open to guests — see "Guest planning" below.
- Plan flow (5 steps, Nov 2026 redesign): Trip basics (`StepBasics.jsx`: where, days+dates,
  who, pace, budget; "More options" = interests, language, travel between stops, start time)
  → Your route (`StepRoute.jsx`, POST `/route-plan`) → Plan your days (`StepDays.jsx`: one tab
  per route stop, day boxes, "Picked for you" / browse by category / search / add your own,
  via `api/places.js` → `/recommendations/venues`) → Stays & flights (`StepStays.jsx`,
  optional, route-aware links, no invented prices) → Check your trip (`StepReview.jsx`, no new
  questions; the footer button submits). All share `PlanShell.jsx` (summary bar, progress,
  sticky Back/Continue). Step numbers: `utils/planSteps.js` (never hard-code; `resumeStep()`
  maps old 6-step saved plans). Days ↔ dates: `utils/tripDates.js`.
- Route first: the confirmed route travels in `selected_venues.route` and is shaped by
  `backend/layers/shared/nodejs/route-plan.js` (sanitize, day→base plan, prompt blocks).
- Route options (option B): Step 1 asks the country (`CountryChips`) and who's travelling
  (`WhoIsTravelling` → `form.tripPrefs`, submitted as `selected_venues.tripPrefs`). `/route-plan`
  returns `{ source, country, options[] }`: hand-curated routes from
  `layers/shared/nodejs/curated-routes.js` for the 10 launch countries (no Claude call), Claude
  for other countries, for `more: true`, or when no curated route fits the kids/travel limit.
  Curated data is reviewed in Notion ("Curated routes — review"); regenerate that page with
  `node scripts/curated-routes-to-markdown.mjs`. Suggestions live in PlanTrip `routeOptions`
  state, never on the form.
- Live progress: the generator records the route and each finished day in
  `submissions.progress` via `layers/shared/nodejs/progress.js` (best-effort, never fails a
  generation; column self-creates). `GET /itinerary/{id}/progress` (form-handler, owner only,
  404 otherwise) feeds `pages/Confirmation.jsx` (`/confirmation?id=…`), which polls every 4 s.
- Maps: `components/map/RouteMap.jsx` — MapLibre (lazy chunk) + OpenFreeMap tiles (free,
  commercial OK, no key; attribution is automatic). Hides itself without WebGL or tiles.
- `src/api/itinerary.js` is the service layer: `fetchPreview()`, `submitItinerary()`,
  `fetchRoutePlan()`, `fetchProgress()`.
- Step 3 picks travel as `selected_venues` v2 `{ version: 2, picks, interests }` — see
  `backend/layers/shared/nodejs/selected-venues.js` (max 40 picks; `day` is the trip day number).
  `/recommendations/venues` returns plural category names ("Restaurants") — use them all.
- Claude calls: model IDs come from `MODELS` in `backend/layers/shared/nodejs/claude.js`
  (template params `ClaudeModelFast` / `ClaudeModelStrong`); read response text with
  `firstText()`, never `content[0].text` (current models may return a thinking block first).
- Models: `ClaudeModelStrong` (Opus 5.5) writes the itinerary; `ClaudeModelFast` (Haiku 5.5)
  handles preview/chat/insights. 5.x models reject `temperature`/`top_p`/`top_k` and prefill;
  use `withEffort()` / `maxTokensFor()` from claude.js (max_tokens includes thinking).
- DB migrations: CI cannot reach RDS. New tables/columns that code depends on create
  themselves on first use (`rate_limits`, `stripe_events`, `photo_cache`,
  `users.monthly_remaining`); `infra/migrations/NNN_*.sql` document them.
- Pricing (design D, Nov 16 2026): prices are NOT in code. GET /pricing (form-handler, public, cached 10 min)
  reads Stripe: active products with metadata `wz_plan` = `trip` | `pass` (+ `trips`, `valid_days`), their
  default price (+ `currency_options` for per-country prices) and the active payment link with the same
  `wz_plan` (`layers/shared/nodejs/pricing.js`). Change a price in Stripe and the site follows; the currency is
  always shown ("A$19 AUD"). The webhook reads the link's metadata from the session: `trip` → credits,
  `pass` → a row in `trip_passes` (`trip-pass.js`, self-creates, 012). Spend order everywhere: test → Wanderer
  monthly → Trip Pass (soonest expiry) → credit → free; a pass trip refunds as creditSource `pass:<id>`.
  Wanderer ($9/mo) is off sale; existing subscribers keep it. Stripe is in TEST mode (Nov 2026).
- Plans: Wanderer = 5 itineraries per billing month (`users.monthly_remaining`, reset on Stripe
  `invoice.paid` with `billing_reason=subscription_cycle`); purchased credits live in
  `itineraries_remaining` and never expire. See `form-handler/subscription.js`.
- Blog (Nov 2026): team-only. `POST /blog` and edits need the admin/superadmin role and publish
  immediately; editor at `/admin/blog` (`AdminBlogPanel.jsx`). Readers see `author_name` only
  (`blog-handler/utils/publicView.js`), never emails. Comments are closed until launch: API returns
  403 COMMENTS_CLOSED unless `BLOG_COMMENTS_OPEN=true`, and `COMMENTS_OPEN` in BlogDetailPage.jsx.
- Blog photos: admins add them in the editor; `utils/resizeImage.js` shrinks them in the browser
  (≤1920 px JPEG, strips EXIF/GPS) and POSTs base64 to `/blog/{id}/photos` (type sniffed from bytes,
  ≤4 MB, ≤12 per story). Stored privately in the PDF bucket under `blog/{postId}/`, served as 6 h
  signed URLs; the first photo is the cover (`thumbnail_url`). `blog_photos` self-creates (006).
- Guest planning (Nov 2026): `/plan` is public; `/route-plan` and `/preview` take `optionalUser`
  (guests rate-limited by hashed IP via `guestRoute`/`guestPreview`, plus a shared daily
  `guestAi` cap). Only `/submit`, progress and `GET /entitlement` need sign-in. The Review step
  shows a sign-up prompt to guests (`/signup?next=/plan`, `utils/safeNext.js` blocks open
  redirects) and, signed in, what Submit will use (`GET /entitlement`, read-only twin of
  `decideEntitlement` — keep them in step). Claude route ideas are cached 7 days per trip shape
  (`route_plan_cache`). The planner saves the plan to `/profile/draft` (`plan_drafts`) for the
  dashboard "Continue planning" card. Both tables self-create (007).
- Adjust a day (option A, Nov 2026): the trip owner rewrites one day with a note on
  `pages/ItineraryView.jsx` (`components/itinerary/AdjustDay.jsx`). `POST
  /itinerary/{id}/days/{n}/adjust` (form-handler `adjust-day.js`: owner only, 404 otherwise;
  `adjustDay` rate limit) claims a slot in `day_adjustments` (`layers/shared/nodejs/day-adjust.js`:
  3 per trip, failed don't count, one pending at a time via unique index, stale after 15 min) and
  invokes itinerary-gen with `{ mode: 'adjustDay', adjustmentId }` — Opus is too slow for API
  Gateway. The generator rewrites that day (same base, avoids other days' places), saves it, then
  pdf-builder/email-sender run with `update: { dayNumber }`, which never change the trip status.
  The page polls `GET /itinerary/{id}/adjustments`. Notes stay in the table, never in the
  shareable itinerary (008).
- Trip page "On the road" (Nov 2026): `pages/ItineraryView.jsx` shows one day at a time and opens on
  today (needs `submissions.travel_date`), with Up next, directions (`utils/tripPlan.js`), local names
  (`localName`, generator schema), mark-as-done and a saved copy for offline (`utils/tripCache.js` +
  network-first `public/sw.js`, deployed no-cache). GET /itinerary?id= is public but returns
  `travelDate`/`hasPdf` to the owner only (optionalUser). Calendar export is built in the browser
  (`utils/ics.js`).
- Book your trip (design C2, Nov 16 2026): `components/itinerary/BookingChecklist.jsx` on the trip page (not for
  locked free trips): a row per stay in route order + flights, ticks in localStorage. Partner ids come from repo
  variables `BOOKING_AFFILIATE_ID` / `GYG_PARTNER_ID` (`utils/partnerLinks.js`); without them links are untagged and
  the note says we earn nothing. Never prices.
- PDF downloads: GET /itinerary/{id}/pdf (form-handler `pdf-link.js`, owner only, 15-min signed URL;
  the S3 key holds the owner's email, so never sign it for share-link viewers). The email's main
  button opens `/itinerary/{id}?download=1`; its direct S3 link only lasts hours (Lambda creds).
- PDF text: `pdf-builder/rich-text.js` renders Claude text (balanced-paren map links → "map" pills,
  everything else escaped); "Budget by day" table from per-day costs.
- Profile name: GET /profile fills an empty `users.name` from the verified token's `name` claim
  (never overwrites one set in Settings).
- Ops alerts (Nov 2026, backlog P1-7): failure paths call `countMetric()` (`layers/shared/nodejs/metrics.js`,
  EMF log line → CloudWatch metric `WanderZenAI/<Name>`, dimension Stage); alarms in template.yaml email
  the SNS topic `wanderzenai-ops-alerts-<stage>` (subscription from the `ALERT_EMAIL` repo variable).
  itinerary-gen/pdf-builder/email-sender send crashed async invocations (OnFailure) to
  `itinerary-gen/watchdog.js`, which also fails trips stuck 20+ min (last 24 h) every 10 min — refund +
  email via `failure.js`, exactly once. itinerary-gen has NO async retries (a retry = a second Opus bill).
- Secrets (Nov 2026, backlog P1-4): only DB credentials are in Globals. Claude, Stripe, Foursquare and
  Google keys are set per function in template.yaml; a function that needs a new one must list it.
- Free trips (Nov 16 2026): the generator writes every day, but a trip with `plan = 'free'` and no
  `submissions.unlocked_at` is LOCKED wherever it leaves the system — GET /itinerary (profile),
  live progress, adjust-day (402), the PDF and its email — via `layers/shared/nodejs/trip-access.js`
  (`lockItinerary`: Day 1 whole, later days `{dayNumber, theme, base, locked}`, stays/tips/traps
  counted not sent). Never blur real text in the browser only. `POST /itinerary/{id}/unlock`
  (form-handler `unlock.js`, owner only) spends Wanderer monthly → credit (test accounts free) in one
  transaction, sets `unlocked_at` (plan stays 'free' so the monthly free count is unchanged), then
  rebuilds the PDF with `update: { unlocked: true }`. UI: `components/itinerary/LockedDay.jsx`.
- `/agency` is a demo (sample data): RoleGate agency/admin only; public "For agencies" links go to
  `/contact?type=partnership`.
- SEO (Nov 2026): every page sets its head tags with `src/seo/Seo.jsx` (static pages in App.jsx's
  `page()`, data pages themselves with `ready={!loading}`); app pages are noindex. Deploy prerenders
  the public pages with Playwright (`frontend/scripts/prerender.mjs` → `<path>/index.html`,
  `_shell.html`, `404.html`, sitemap, old-blog-id redirects) and uploads with `scripts/upload-site.sh`.
  The saved copy stays on screen until the app's `<Seo ready>` fires (`src/seo/ready.js`). CloudFront
  function `FrontendRewriteFunction` (template.yaml, tested by `src/seo/rewrite.test.js`) maps clean
  URLs to those files, app routes to `_shell.html`; missing → 404.html with a real 404. A NEW public
  route must be added to `STATIC_ROUTES` in prerender.mjs; a new app route to the function's `APP` list.
  `seo-refresh.yml` re-prerenders every 2 h when blog posts change. Blog addresses are
  `/blog/<title-words>-<first 8 of id>` (`utils/blogSlug.js`; the API resolves the 8-hex prefix).
  The distribution's alias + ACM cert are declared in template.yaml (they were hand-set; never drop them).
- Home page (design E, Nov 22 2026): `pages/Landing.jsx` + `pages/Home.css` (`lp-` classes; Landing.css is kept
  for its global reset). Order: what we do + an example trip day → what you get → "Not sure where yet?"
  (`homePicks()`: live regions, in season, closest first) → how it works → vs Google/AI chat → sample → pricing
  (Stripe) → FAQ → close. Copy never names a region. Under 760px the phone layout takes over (`lp-desk-only` /
  `lp-mob-only`, sticky "Plan my trip"). The old design-A hero (SeasonHero) was removed.
- Seasons + home/Explore (Nov 16 2026, design B; A retired Nov 22): every curated route has `seasons: { best: [1–12], note }`
  for ITS region and a hand-checked `photoQuery`. The home hero (`components/home/SeasonHero.jsx`) and Explore's
  `components/explore/RouteFinder.jsx` rank by today's month (in season first) then rough flight time from the
  visitor's city, guessed from the browser time zone (`utils/seasons.js`; no prompt, kept in localStorage only).
  `curatedOptions` flags off-season routes for the travel date; Claude route prompts get `seasonRule()`.
  seo-refresh.yml re-saves every page weekly and on the 1st so saved copies show the current month.
- Regions are DATA (Nov 16 2026): `REGIONS` in `curated-routes.js` (`live: true` = promoted; Asia only today,
  Europe/Oceania have routes but aren't live) → `src/data/regions.json` via build-guides. Home hero, photo strip,
  Explore (route finder, browse by region, fallback trending), "Picked for you" (`layers/shared/nodejs/picks.js`:
  curated routes in season, unplanned countries first, weekly rotation — no Claude) and Claude "Good right now"
  (prompt + filter limited to `LIVE_COUNTRIES`) all follow it. To launch a region: give its countries routes,
  seasons and photoQuery, set `live: true`, rerun build-guides. Never hard-code a country list in the UI.
- AI-readable (Nov 22 2026, step 1): `/llms.txt` is generated by build-guides from the route data (all guides,
  best months, key pages, never prices) into `frontend/public/` and uploaded by upload-site.sh. JSON-LD: Organization +
  WebApplication in index.html, FAQPage on the home page, Product/Offers on /pricing (from Stripe, via `seo/JsonLd.jsx`),
  TouristTrip per route on guides. No MCP server or public API yet (step 2 needs Gundeep's approval).
- Guides: `/guides/<country>` pages come from `curated-routes.js` via `scripts/build-guides.mjs`
  (prebuild; a jest test fails if `src/data/guides*.json` is stale — rerun it after editing routes).
- Photos: Unsplash only through the backend `GET /photos/search` (key stays server-side, cached);
  every API photo shows its credit via `components/PhotoCredit.jsx` (Unsplash API Guidelines).

## Coding conventions — FOLLOW THE EXISTING CODEBASE
- Styling: s-object inline-style pattern + per-page CSS files. Do NOT introduce a new
  styling system (no Tailwind, no styled-components) unless explicitly asked.
- Preview/form state: keep preview state in SEPARATE useState vars (`preview`,
  `previewLoading`). Do NOT nest preview state inside the main form object — it causes
  stale-state bugs.

## Editing rules — these come from real failures, do not ignore
- Prefer FULL FILE REWRITES over patch scripts. Python-based patching has repeatedly
  corrupted files here (stray slashes, broken try/catch blocks).
- YAML indentation errors silently break SAM builds. Any edit to `infra/template.yaml`
  must be re-validated (`sam validate`) before deploy.
- GitHub Actions: every secret a step needs must be explicitly mapped in that step's
  `env:` block, or it arrives as an empty string in `sam deploy`. Check this on any
  workflow edit.

## Third-party APIs — Current Status
- **Foursquare Places API** (`places-api.foursquare.com`, Bearer key + `X-Places-Api-Version`):
  ✓ Active via `backend/layers/shared/nodejs/venue-enrichment/foursquare.js`. The legacy V3 API
  (`api.foursquare.com/v3`) was shut down on May 15, 2026 — never call it.
- **Amadeus POI**: ✗ Discontinued for independent devs (removed from architecture).
- **OpenTripMap**: ✗ Verification undeliverable.
- **Google Maps APIs**: Not currently used; evaluate if needed for destination geocoding.

Before recommending any new integration, confirm current docs + access.

## Process rules
- NO code for new features until a design decision is confirmed by Gundeep first.
  (Open example: RecommendationQuiz UI redesign — options A/B/C pending a decision.
  Write no quiz UI code until one is chosen.)
- Do NOT auto-create Notion issues. Gundeep logs issues himself. Only update existing
  Notion pages when explicitly asked.

## Auth + rate limiting — use the shared layer, never roll your own
- Caller identity comes ONLY from `requireUser(event)` / `optionalUser(event)` in
  `backend/layers/shared/nodejs/auth.js` (verified Firebase ID token, verified email by
  default). Never base64-decode a JWT payload, and never trust an `email` in a request body.
- Any endpoint that calls Claude must call `checkRateLimit()` (`rate-limit.js`) before the
  Claude call — keyed by `userSubject(user)`, or `ipSubject(event)` for public endpoints.
- Tests: `node --test backend/tests/unit/*.test.js` (runs in CI before deploy).
- E2E: `backend/tests/e2e/run.sh` runs the real handlers against Postgres built from
  `infra/schema.sql` + migrations (CI job "E2E (Postgres)", blocks deploy). Any table/column the
  code needs must be in a migration — 009 caught ones added to RDS by hand.

## Security defaults (this repo is internet-facing + wired to prod)
- Never hardcode secrets. Stripe keys, SES creds, DB password → SSM Parameter Store /
  Secrets Manager, referenced in template.yaml. Never in samconfig.toml or .env committed.
- `sam deploy` touches LIVE infra (prod API Gateway + CloudFront). Require explicit
  approval before running it. Never use `--dangerously-skip-permissions` on this repo.
- Use a scoped AWS profile, not root keys.

## Current focus
- Work is tracked on two Notion pages under WanderZenAI-Project HQ: "Security & Product
  Review — Priority Backlog" and "Itinerary Quality Plan". Check their progress logs and open
  decisions before starting anything new.
- Older note (may be resolved): Step 4 preview panel not rendering on the live site. Debug
  path: confirm the `/preview` POST fires (Network tab), inspect its response, check for a JS
  error blocking the state update.
