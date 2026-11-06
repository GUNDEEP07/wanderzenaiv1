# CLAUDE.md — WanderZenAI

AI-powered slow-travel itinerary SaaS. Live at wanderzenai.com. Solo-maintained.

## Architecture
- **Frontend:** React + Vite, deployed to S3 + CloudFront (distribution `E329HHUPH0JQTP`).
- **Backend:** AWS Lambda (Node 20) via AWS SAM. API Gateway prod stage:
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
  `pages/`, not `components/`).
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
- `src/api/itinerary.js` is the service layer: `fetchPreview()` + `submitItinerary()`.
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
