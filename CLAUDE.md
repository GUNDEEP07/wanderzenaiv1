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
- Frontend itinerary flow: `src/components/plantrip/PlanTrip.jsx` (multi-step form).
- `StepReview.jsx` is the dedicated Step 4/5 review-preview component under
  `src/components/plantrip/`.
- `src/api/itinerary.js` is the service layer: `fetchPreview()` + `submitItinerary()`.

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

## API verification rule — HARD REQUIREMENT
Before recommending ANY third-party API/integration, confirm current docs + access
requirements first. Past wasted cycles: Foursquare V3 (blocked for accounts created
after 2025-06-17), Amadeus POI (discontinued for independent devs), OpenTripMap
(verification undeliverable). Do not suggest an integration you have not verified is
actually accessible.

## Process rules
- NO code for new features until a design decision is confirmed by Gundeep first.
  (Open example: RecommendationQuiz UI redesign — options A/B/C pending a decision.
  Write no quiz UI code until one is chosen.)
- Do NOT auto-create Notion issues. Gundeep logs issues himself. Only update existing
  Notion pages when explicitly asked.

## Security defaults (this repo is internet-facing + wired to prod)
- Never hardcode secrets. Stripe keys, SES creds, DB password → SSM Parameter Store /
  Secrets Manager, referenced in template.yaml. Never in samconfig.toml or .env committed.
- `sam deploy` touches LIVE infra (prod API Gateway + CloudFront). Require explicit
  approval before running it. Never use `--dangerously-skip-permissions` on this repo.
- Use a scoped AWS profile, not root keys.

## Current focus
- Step 4 preview panel was built but not rendering on the live site. Debug path: confirm
  the `/preview` POST fires (Network tab), inspect its response, check for a JS error
  blocking the state update.
