# WanderZenAI

AI-powered slow travel itinerary platform. No tourist traps. Hidden cafes, village stays, and morning trails — built on AWS, powered by Claude.

---

## Architecture

```
User → CloudFront → S3 (React SPA)
User → API Gateway → Lambda (form-handler)
                   → Lambda (itinerary-gen) → Claude API
                   → Lambda (pdf-builder)   → S3 (PDFs)
                   → Lambda (email-sender)  → SES
                   → RDS Postgres
```

**Stack:**
- Frontend: React + Vite → S3 + CloudFront
- Backend: AWS SAM → API Gateway + Lambda (Node.js 20)
- AI: Claude Sonnet API (Anthropic)
- Database: RDS Postgres (db.t3.micro)
- Storage: S3 (PDFs, signed URLs)
- Email: AWS SES
- Payments: Stripe Checkout
- Auth: Clerk (optional) or custom JWT
- CI/CD: GitHub Actions

**Cost per itinerary: ~$0.04–0.10**
**Monthly infra: ~$15–25**

---

## Project Structure

```
wanderzenai/
├── frontend/                    # React SPA
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.jsx      # Homepage
│   │   │   ├── Landing.css
│   │   │   ├── PlanTrip.jsx     # Intake form (replaces Tally)
│   │   │   ├── PlanTrip.css
│   │   │   ├── Confirmation.jsx # Post-submit page
│   │   │   ├── Pricing.jsx      # Pricing page
│   │   │   └── Dashboard.jsx    # User dashboard
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── functions/
│   │   ├── form-handler/
│   │   │   ├── index.js         # POST /submit
│   │   │   ├── stripe-webhook.js # POST /webhook/stripe
│   │   │   └── get-itinerary.js  # GET /itinerary/:id
│   │   ├── itinerary-gen/
│   │   │   └── index.js         # Calls Claude, stores JSON
│   │   ├── pdf-builder/
│   │   │   └── index.js         # Puppeteer → PDF → S3
│   │   └── email-sender/
│   │       └── index.js         # SES email with signed URL
│   └── layers/
│       └── shared/nodejs/
│           ├── index.js         # DB, response helpers, validators
│           └── package.json
│
├── infra/
│   ├── template.yaml            # AWS SAM template
│   └── schema.sql               # Postgres schema
│
├── .github/
│   └── workflows/
│       └── deploy.yml           # CI/CD pipeline
│
└── package.json                 # Root scripts
```

---

## Setup Guide

### 1. Prerequisites

```bash
# Install AWS CLI
brew install awscli

# Install AWS SAM CLI
brew tap aws/tap
brew install aws-sam-cli

# Configure AWS credentials
aws configure
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region: ap-southeast-2
# Default output format: json
```

### 2. RDS Postgres Setup

```bash
# Create RDS instance (run once)
aws rds create-db-instance \
  --db-instance-identifier wanderzenai-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16 \
  --master-username wanderzen_admin \
  --master-user-password <YOUR_SECURE_PASSWORD> \
  --allocated-storage 20 \
  --storage-type gp2 \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --region ap-southeast-2

# Wait for instance to be available (~5 min), then run schema
psql -h <RDS_ENDPOINT> -U wanderzen_admin -d postgres -c "CREATE DATABASE wanderzenai;"
psql -h <RDS_ENDPOINT> -U wanderzen_admin -d wanderzenai -f infra/schema.sql
```

### 3. SES Setup

```bash
# Verify your sender domain (or just email for testing)
aws ses verify-email-identity --email-address hello@wanderzenai.com

# For production: request to move out of sandbox
# AWS Console → SES → Account dashboard → Request production access
```

### 4. GitHub Secrets

Add these secrets in your GitHub repo → Settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key (needs SAM + S3 + CloudFront permissions) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `DB_HOST` | RDS endpoint (e.g. `wanderzenai-db.abc123.ap-southeast-2.rds.amazonaws.com`) |
| `DB_NAME` | `wanderzenai` |
| `DB_USER` | `wanderzen_admin` |
| `DB_PASSWORD` | Your RDS master password |
| `CLAUDE_API_KEY` | Anthropic API key from console.anthropic.com |
| `FROM_EMAIL` | `hello@wanderzenai.com` (must be SES-verified) |
| `STRIPE_SECRET_KEY` | From Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks → signing secret |
| `FRONTEND_URL` | Your CloudFront URL (update after first deploy) |
| `FRONTEND_BUCKET` | S3 bucket name (update after first deploy) |
| `CLOUDFRONT_DISTRIBUTION_ID` | From AWS Console after first deploy |

### 5. First Deploy

```bash
# Install all dependencies
npm run install:all

# Deploy backend first (creates S3 buckets, CloudFront, API Gateway)
cd infra
sam build
sam deploy --guided
# Follow prompts, enter all parameter values

# Note the outputs:
# - ApiUrl → set as VITE_API_URL for frontend build
# - CloudFrontUrl → your site URL

# Deploy frontend manually for first time
cd ../frontend
VITE_API_URL=<ApiUrl from above> npm run build
aws s3 sync dist/ s3://<FrontendBucket>/ --delete
```

After first deploy, update GitHub Secrets with the actual resource IDs.
All subsequent deploys happen automatically on `git push origin main`.

### 6. Stripe Setup

```bash
# In Stripe Dashboard:
# 1. Create two products:
#    - "Single Plan" — one-time $7
#    - "Wanderer" — recurring $9/month

# 2. Add webhook endpoint:
#    URL: <ApiUrl>/webhook/stripe
#    Events: checkout.session.completed, customer.subscription.deleted, invoice.payment_failed

# 3. Copy the webhook signing secret → GitHub secret STRIPE_WEBHOOK_SECRET
```

### 7. PDF Builder Lambda — Chromium Layer

The PDF builder uses `@sparticuz/chromium` which packages a headless Chrome binary for Lambda. Add to `backend/functions/pdf-builder/package.json`:

```json
{
  "dependencies": {
    "@sparticuz/chromium": "^123.0.1",
    "puppeteer-core": "^22.6.0"
  }
}
```

This adds ~50MB to the Lambda deployment package — within Lambda's 250MB limit.

---

## Local Development

```bash
# Run frontend locally
npm run dev
# Opens http://localhost:5173

# Test Lambda functions locally with SAM
cd infra
sam local start-api --env-vars local-env.json

# local-env.json (gitignored — never commit this):
{
  "FormHandlerFunction": {
    "STAGE": "dev",
    "DB_HOST": "localhost",
    "DB_NAME": "wanderzenai",
    "DB_USER": "postgres",
    "DB_PASSWORD": "postgres",
    "CLAUDE_API_KEY": "sk-ant-...",
    "FROM_EMAIL": "test@example.com",
    "STRIPE_SECRET_KEY": "sk_test_...",
    "STRIPE_WEBHOOK_SECRET": "whsec_...",
    "PDF_BUCKET": "wanderzenai-pdfs-dev",
    "FRONTEND_URL": "http://localhost:5173"
  }
}
```

---

## Monitoring

```bash
# Tail Lambda logs in real time
npm run logs:form     # form submissions
npm run logs:gen      # itinerary generation (Claude calls)
npm run logs:pdf      # PDF builds
npm run logs:email    # email delivery

# Check monthly Claude costs in DB
psql $DATABASE_URL -c "SELECT * FROM monthly_costs;"

# Check daily stats
psql $DATABASE_URL -c "SELECT * FROM daily_stats LIMIT 14;"
```

---

## Costs (estimated at 200 paying users/month)

| Service | Cost |
|---------|------|
| RDS db.t3.micro | $15/mo |
| Lambda (all functions) | ~$2/mo |
| S3 (PDFs + frontend) | ~$1/mo |
| CloudFront | ~$1/mo |
| API Gateway | ~$1/mo |
| SES email | ~$0.10/mo |
| Claude API (~460 itineraries) | ~$18/mo |
| **Total** | **~$38/mo** |
| **Revenue (200 × $9)** | **$1,800/mo** |
| **Net margin** | **~98%** |

---

## Roadmap

- [ ] User dashboard with saved itineraries
- [ ] Itinerary regeneration (tweak a single day)
- [ ] WhatsApp delivery option
- [ ] SEO blog with auto-generated destination guides
- [ ] White-label B2B API

---

© 2025 WanderZenAI · Built for slow travellers
# WanderZenAI
# WanderZenAI
