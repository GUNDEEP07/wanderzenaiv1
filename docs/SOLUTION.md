# WanderZenAI — Solution Document

**Product:** AI-powered slow travel itinerary generator  
**Live:** https://www.wanderzenai.com  
**Stack:** React 18 + Vite · AWS Lambda (Node 20) · PostgreSQL (RDS) · Firebase Auth · Stripe · Anthropic Claude · Foursquare · AWS SES · CloudFront + S3

---

## Architecture Overview

```
Browser (React SPA)
    │
    ├─ Firebase Auth (Google OAuth + Email/Password)
    │
    ├─ CloudFront CDN → S3 (static assets)
    │
    └─ API Gateway (ap-southeast-2)
         │
         ├─ /submit          → FormHandler Lambda
         ├─ /preview         → FormHandler Lambda
         ├─ /profile         → ProfileFunction Lambda
         ├─ /itinerary       → ProfileFunction Lambda
         ├─ /customer-portal → ProfileFunction Lambda
         ├─ /welcome-email   → WelcomeEmailFunction Lambda
         ├─ /recommendations/* → RecommendationsFunction Lambda
         │     ├─ /autocomplete
         │     ├─ /venues
         │     ├─ /personalised
         │     ├─ /trending
         │     ├─ /chat
         │     └─ /public/stats
         ├─ /destination-insights → DestinationInsightsFunction Lambda
         └─ /webhook/stripe  → StripeWebhookFunction Lambda

Async Lambda chain (non-API):
FormHandler → ItineraryGen → PDFBuilder → EmailSender
```

---

## What Was Built

### 1. Authentication System

**Firebase Auth** — Google OAuth + Email/Password with demo mode fallback.

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Google + email/password, inline forgot-password reset |
| Signup | `/signup` | Full name, email, password, email verification on create |
| Onboarding | `/onboarding` | 2-screen profile setup after first signup; reads `?ref=CODE` for referrals |
| Protected routes | — | `/plan`, `/dashboard`, `/settings`, `/onboarding` require auth |

**Key files:**
- `frontend/src/firebase.js` — Firebase init with demo mode (works without real credentials)
- `frontend/src/context/AuthContext.jsx` — Auth context; demo mode serves mock user
- `frontend/src/components/ProtectedRoute.jsx` — Redirects unauthenticated users to `/login`

---

### 2. User Profile & Settings

**Backend:** `backend/functions/profile/handler.js` — `GET /profile` returns user profile + past trips with signed PDF URLs. `PUT /profile` upserts all profile fields.

**DB columns added to `users` table:**
`firebase_uid`, `name`, `gender`, `age`, `whatsapp`, `home_city`, `language`, `onboarding_complete`, `referral_code`, `referred_by`, `referral_rewarded`

**Settings page** (`/settings`) — 4 tabs:
- **Profile** — name, age, gender, WhatsApp, home city
- **Preferences** — currency, language, notification toggles
- **Subscription** — current plan display, Manage billing (Stripe portal), upgrade links
- **Account** — change password, sign out, delete account

---

### 3. Dashboard

**Route:** `/dashboard`

**Sections (all dynamic):**
1. **Hero** — personalised greeting, 4-stat strip (trips, countries, days planned, time since last trip)
2. **Ready for next adventure?** — smart prompt based on time since last trip, CTA to `/plan`
3. **Picked for you** — 3 AI-generated destination recommendations (Claude Haiku, cached 7 days)
4. **Trending in your country** — 6 trending destinations for the user's country + month (Claude Haiku, cached 24 hours)
5. **Your travel DNA** — top activities, trip patterns, countries visited
6. **Your journeys** — past trips with search/filter bar, photos, PDF download, Share, Re-plan, View buttons

**Mobile responsive:** All grids adapt to 1-column on mobile; reduced padding/font sizes; stats strip stacks vertically.

---

### 4. Trip Planning Flow (PlanTrip)

**Route:** `/plan` (protected)

6-step form:
1. **Destination** — search with Foursquare autocomplete, multi-destination support, travel style + dates + traveler type
2. **Venues** — full-bleed two-panel layout (AI picks left, activity grid + YouTube + venues right), day assignment
3. **Budget & dates** — currency, budget amount
4. **Travel style** — pace, interests, age, location
5. **Your details** — email, language, hotel recs toggle
6. **Review** — preview + final submit

**Key features:**
- AI picks (DestinationInsightsPanel) — expandable cards with opening hours, distance, insider tips, embedded day list
- Natural language venue search — "find me top Indian restaurants" → Claude interprets → Foursquare search → AI fallback
- Activity grid — 4-col colour-coded categories (Hiking=green, Food=amber, etc.)
- Venue cards — expandable with DayList for day assignment, Foursquare photos
- State persistence — selections saved on Back/Skip/Continue, restored on return
- Chat shortcut — conversational trip planning from AI chat → skips Step 1, pre-fills all form data

---

### 5. Venue Selection — Technical Details

**Two-panel layout (desktop):**
- Left panel: DestinationInsightsPanel (AI picks with chevron expand, day assignment)
- Right panel: ActivityGrid + YouTube carousel + VenuesList

**Mobile:** Stacks vertically; activity grid 3-col; venues single-col.

**AI venue fallback:** When Foursquare returns 0 venues for a city, Claude Haiku generates 5 real local suggestions with opening hours, address, description. Cached per destination+activity key in Lambda memory.

---

### 6. AI Travel Advisor Chat

**Component:** `frontend/src/components/TravelChat.jsx`
**Endpoint:** `POST /recommendations/chat`

- Floating ✦ button (bottom-right of dashboard)
- Slide-in panel with conversation history, 5 suggestion prompts
- Word-by-word streaming (35ms per word after response arrives)
- Conversational trip intake: asks destination → days → dates → who → vibe → budget
- When all 6 details collected: shows "✦ Yes, plan this trip for me →" CTA
- CTA navigates to `/plan` at Step 1 (Venues) with all form fields pre-filled
- Claude has full user context: name, past destinations, home city

---

### 7. Online Itinerary Viewer

**Route:** `/itinerary/:id` (public — shareable without auth)

Displays full day-by-day itinerary with:
- Hero with title (Fraunces serif), summary, stats pills
- Per-day sections: morning/afternoon/evening activities with time, cost, insider tip, maps link
- Local eats card (amber accent), hidden gem card (purple accent)
- Share buttons: 🔗 Copy link, WhatsApp, Email — in nav bar
- "Plan another trip →" footer CTA

**Dashboard integration:** "View →" button on each completed trip card. "🔗 Share" button copies public URL.

---

### 8. Personalised Recommendations

**Endpoint:** `GET /recommendations/personalised`

Claude Haiku generates 3 destination recommendations based on:
- Past destinations (from `submissions` table)
- User profile (age, gender, home city)
- Preferred activities (computed from `travelStyle` in past submissions)

Cached 7 days per user in `recommendation_cache` table.

**Surfaces:**
- Dashboard "Picked for you" section
- PlanTrip Step 1 destination chips ("Based on your travels")
- ActivityGrid ★ star indicator on historically-preferred categories

---

### 9. Trending Destinations by Country

**Endpoint:** `GET /recommendations/trending`

Claude Haiku generates 6 trending slow-travel destinations for the user's country and current month. Each has: destination, emoji, why it's trending, badge (🔥 Hot / ↑ Rising / ✦ Hidden gem), traveler count estimate.

Cached 24 hours per country in `recommendation_cache`.

---

### 10. Referral Program

**Flow:**
1. Every user auto-gets a unique referral code (`WZ + 6 chars`) on first profile load
2. Share link: `wanderzenai.com/signup?ref=WZAB12CD`
3. Referee signs up → `referred_by` stored in their profile
4. Referee makes first paid Stripe purchase → webhook fires → both get +1 `itineraries_remaining`
5. `referral_rewarded` flag prevents double-rewarding

**Settings UI:** Copy-able referral link + friend count in Subscription tab.

---

### 11. Monetisation

**Stripe integration:**
- Free plan: 1 itinerary/month (enforced via `itineraries_remaining`)
- Single trip: $7 one-time
- Wanderer: $9/month subscription
- Stripe Customer Portal: `POST /customer-portal` → Billing Portal session for paid users to manage/cancel
- Referral rewards: +1 itinerary credit on referee's first payment

**Upsell trigger:** When user hits 402 (free limit), Pricing page shows personalised banner: *"Your [Destination] itinerary is waiting"* with 4 unlock features.

---

### 12. Email System (AWS SES)

| Email | Trigger | Content |
|---|---|---|
| Welcome | On signup (email or Google) | Warm onboarding, plan CTA, feature highlights |
| Itinerary PDF | After PDF built | Download link (7-day signed S3 URL), trip summary |

**Welcome email Lambda:** `backend/functions/form-handler/welcome-email.js` — `POST /welcome-email`

---

### 13. Analytics (GA4)

**Measurement ID:** G-30SQXCEL52  
**Integration:** `gtag.js` in `index.html` (no bundle overhead)  
**Utility:** `frontend/src/utils/analytics.js`

**Tracked events:**

| Event | Trigger |
|---|---|
| `sign_up` | Signup (method: google/email) |
| `login` | Login (method: google/email) |
| `trip_submitted` | Itinerary form submitted |
| `free_limit_hit` | 402 response from API |
| `itinerary_viewed` | `/itinerary/:id` loaded |
| `upgrade_clicked` | Buy/Upgrade button (plan + location) |
| `chat_opened` | AI chat floating button clicked |
| `chat_ready_to_plan` | Chat collects all trip details |

---

### 14. SEO & Social

- **Meta tags:** title, description, keywords, canonical
- **Open Graph:** og:title, og:description, og:image (1200×630), og:url
- **Twitter Card:** summary_large_image
- **Structured data:** JSON-LD SoftwareApplication schema
- **sitemap.xml:** 7 public pages
- **robots.txt:** disallows /dashboard, /plan, /settings

---

### 15. Social Proof (Landing Page)

- **Live stats strip:** Total itineraries, unique destinations, total days — fetched from `GET /recommendations/public/stats`, falls back to seeded values
- **Destination wall:** Coloured pill tags of real destinations from `submissions` table
- **Testimonials:** 3 user quote cards with stars, name, location, destination badge
- **Sample itinerary section:** 3 real day examples with hidden gem + local eats

---

### 16. Legal & Compliance

| Item | Status |
|---|---|
| Privacy Policy | `/privacy` — full GDPR-compliant policy |
| Terms of Service | `/terms` — includes AI disclaimer, refund policy |
| Cookie consent | Persistent banner, localStorage flag |
| Email verification | Sent on email/password signup via Firebase |
| 404 page | Custom dark-theme not-found page |
| Error boundary | Global React error boundary, catches crashes |

---

## Database Schema (Key Tables)

```sql
users (
  id UUID, email VARCHAR UNIQUE, plan VARCHAR,
  itineraries_remaining INTEGER,
  stripe_customer_id VARCHAR, stripe_subscription_id VARCHAR,
  firebase_uid VARCHAR, name VARCHAR, gender VARCHAR,
  age INTEGER, whatsapp VARCHAR, home_city VARCHAR,
  language VARCHAR, onboarding_complete BOOLEAN,
  referral_code VARCHAR UNIQUE, referred_by VARCHAR,
  referral_rewarded BOOLEAN,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)

submissions (
  id VARCHAR PRIMARY KEY, email VARCHAR,
  destination VARCHAR, days INTEGER,
  form_data JSONB, status VARCHAR,
  created_at TIMESTAMPTZ
)

itineraries (
  id VARCHAR PRIMARY KEY, submission_id VARCHAR,
  email VARCHAR, itinerary_data JSONB
)

recommendation_cache (
  email VARCHAR PRIMARY KEY,  -- also used for non-user keys like "trending:India:June"
  recommendations JSONB,
  created_at TIMESTAMPTZ
)

destination_insights_cache (
  destination VARCHAR, start_date DATE, end_date DATE,
  travel_styles VARCHAR, insights JSONB, expires_at TIMESTAMPTZ
)
```

---

## Lambda Functions

| Function | Handler | Purpose |
|---|---|---|
| FormHandler | `index.handler` | Form submit, preview, Stripe webhook routing |
| WelcomeEmail | `welcome-email.handler` | Send welcome email via SES |
| ItineraryGen | `index.handler` | Claude API — metadata + 3-days-per-batch generation |
| PDFBuilder | `index.handler` | Puppeteer → PDF → S3 |
| EmailSender | `index.handler` | SES email with signed PDF URL |
| ProfileFunction | `handler.handler` | GET/PUT profile, GET itinerary, POST customer-portal |
| RecommendationsFunction | `index.handler` | Autocomplete, venues, AI fallback, chat, personalised, trending, public/stats |
| DestinationInsights | `handler.handler` | Claude insights per destination+dates |
| StripeWebhook | `stripe-webhook.handler` | Payment events, referral rewards |
| WeeklyCache | — | Sunday cron — pre-populates destination data |

---

## Environment Variables (GitHub Actions Secrets)

```
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
DB_HOST / DB_NAME / DB_USER / DB_PASSWORD
CLAUDE_API_KEY
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
STRIPE_SINGLE_PLAN_LINK / STRIPE_WANDERER_LINK
STRIPE_PUBLISHABLE_KEY
FROM_EMAIL
FOURSQUARE_API_KEY
GOOGLE_PLACES_API_KEY
FRONTEND_URL / FRONTEND_BUCKET
FIREBASE_API_KEY / FIREBASE_AUTH_DOMAIN / FIREBASE_PROJECT_ID
```

---

## CI/CD Pipeline (.github/workflows/deploy.yml)

On push to `main`:
1. **Test** — frontend lint
2. **Deploy backend** — `sam build` + `sam deploy` (all Lambdas + API Gateway)
3. **Deploy frontend** — `vite build` → S3 sync → CloudFront invalidation

---

## Key Third-Party Services

| Service | Use | Plan |
|---|---|---|
| Anthropic Claude | Itinerary generation, insights, AI chat, venue fallback, recommendations | Pay per token |
| Firebase | Auth (Google + email) | Free (Spark) |
| Foursquare | Venue search, category data | Free tier |
| Stripe | Payments, subscriptions, billing portal | Pay per transaction |
| AWS SES | Transactional email | Pay per email |
| AWS S3 | PDF storage + frontend hosting | Pay per GB |
| CloudFront | CDN for frontend | Pay per request |
| Unsplash | Destination photos (curated IDs) | Free |
| Google Places | Destination autocomplete | Pay per request |
| GA4 | Analytics | Free |

---

## File Structure (Frontend Key Files)

```
frontend/src/
├── App.jsx                          — Routes, AuthProvider, ErrorBoundary
├── firebase.js                      — Firebase init + demo mode
├── context/AuthContext.jsx          — Auth state + helpers
├── components/
│   ├── ProtectedRoute.jsx           — Auth guard
│   ├── ErrorBoundary.jsx            — Global error catcher
│   ├── CookieBanner.jsx             — GDPR cookie consent
│   └── TravelChat.jsx               — AI travel advisor chat
├── pages/
│   ├── Landing.jsx + Landing.css    — Marketing homepage
│   ├── Login.jsx                    — Sign in
│   ├── Signup.jsx                   — Create account
│   ├── Onboarding.jsx               — 2-screen profile setup
│   ├── Dashboard.jsx                — User hub
│   ├── PlanTrip.jsx                 — 6-step trip planner
│   ├── ItineraryView.jsx            — Public itinerary viewer
│   ├── Settings.jsx                 — Profile/preferences/subscription
│   ├── Pricing.jsx                  — Plans + upsell
│   ├── PrivacyPolicy.jsx            — Legal
│   ├── TermsOfService.jsx           — Legal
│   └── NotFound.jsx                 — 404
├── components/plantrip/
│   ├── VenueSelection.jsx           — Step 2 two-panel layout
│   ├── DestinationInsightsPanel.jsx — AI picks with day assignment
│   └── subcomponents/
│       ├── ActivityGrid.jsx         — 4-col colour-coded grid
│       ├── VenuesList.jsx           — 2-col expandable cards
│       ├── DayList.jsx              — Embedded day picker
│       ├── ActivityTabs.jsx         — Tab navigation
│       └── YouTubeCarousel.jsx      — Video suggestions
└── utils/
    ├── analytics.js                 — GA4 event tracking
    ├── foursquare.js                — Venue fetch + AI fallback mapping
    ├── geolocation.js               — IP geolocation (3s timeout)
    └── youtube.js                   — YouTube search
```

---

## Outstanding Items

| Priority | Item | Notes |
|---|---|---|
| Must fix | `og-image.png` missing | Referenced in meta tags, needed for WhatsApp/LinkedIn previews |
| Housekeeping | Pre-existing test failures | `ActivityTabs`, `CustomInterestModal` test suites |
| Growth | PWA manifest | `manifest.json` for "Add to home screen" |
| Growth | Trip regeneration/edit | "Re-plan" pre-fills destination only; could pre-fill more |
| Growth | Blog/content | SEO content strategy |
