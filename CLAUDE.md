# CLAUDE.md — WanderZenAI

AI-powered slow-travel itinerary SaaS. Live at wanderzenai.com. Solo-maintained.

## Architecture
- **Frontend:** React + Vite, deployed to S3 + CloudFront (distribution `E329HHUPH0JQTP`).
- **Backend:** AWS Lambda (Node 24, `nodejs24.x` since Nov 2026) via AWS SAM. API Gateway prod stage:
  `y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod`.
- **DB:** RDS PostgreSQL.
- **AI:** Claude (full itinerary generation + the lightweight `/preview` endpoint).
- **Payments:** Stripe (402 gate; bypassed for rows in `test_accounts` table).
- **Email:** AWS SES.
- **Deploy:** GitHub Actions auto-deploy from `main` (repo: GUNDEEP07/wanderzenaiv1).

## Repo layout — non-obvious
- SAM template lives at `infra/template.yaml`, NOT repo root.
- `samconfig.toml` is required at deploy time. Has been missing/flaky — verify it exists
  before any `sam deploy`. If regenerating, use `sam deploy --guided` then scrub it of
  anything sensitive before committing.
- Frontend itinerary flow: `frontend/src/pages/PlanTrip.jsx` (multi-step form; it lives in
  `pages/`, not `components/`). Open to guests — see "Guest planning" below.
- Plan flow (6 steps): Destination → Dates → **Your route** (`StepRoute.jsx`, POST
  `/route-plan`) → Trip overview → Choose experiences (`VenueSelection`, one tab per route
  base) → Review & submit (`StepReview.jsx`, loads the /preview outline itself). Step
  indexes are the `STEP_*` constants in PlanTrip.jsx — never hard-code numbers.
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
  `backend/layers/shared/nodejs/selected-venues.js`.
- Claude calls: model IDs come from `MODELS` in `backend/layers/shared/nodejs/claude.js`
  (template params `ClaudeModelFast` / `ClaudeModelStrong`); read response text with
  `firstText()`, never `content[0].text` (current models may return a thinking block first).
- Models: `ClaudeModelStrong` (Opus 5.5) writes the itinerary; `ClaudeModelFast` (Haiku 5.5)
  handles preview/chat/insights. 5.x models reject `temperature`/`top_p`/`top_k` and prefill;
  use `withEffort()` / `maxTokensFor()` from claude.js (max_tokens includes thinking).
- DB migrations: CI cannot reach RDS. New tables/columns that code depends on create
  themselves on first use (`rate_limits`, `stripe_events`, `photo_cache`,
  `users.monthly_remaining`); `infra/migrations/NNN_*.sql` document them.
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
- Profile name: GET /profile fills an empty `users.name` from the verified token's `name` claim
  (never overwrites one set in Settings).
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
