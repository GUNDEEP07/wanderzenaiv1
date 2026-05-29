# Auth, Login, Dashboard & Personalised Recommendations — Design Spec

**Date:** 2026-05-30  
**Status:** Approved

---

## Overview

Add a complete authentication layer to WanderZenAI: Google OAuth + email/password sign-in via Firebase Auth, a 2-screen onboarding flow for new users, a Dashboard showing past trips with AI-powered destination recommendations, and personalisation woven into Steps 1 and 2 of the PlanTrip form. `/plan` becomes a protected route — unauthenticated users are redirected to `/login`.

---

## Pages & Routes

| Route | Page | Auth required |
|---|---|---|
| `/login` | Sign in — Google button + email/password | No |
| `/signup` | Create account — email/password | No |
| `/onboarding` | 2-screen profile setup | Yes — new users only |
| `/dashboard` | Past trips + plan new trip | Yes |
| `/plan` | (existing) Now protected | Yes |

---

## Auth Architecture

**Provider:** Firebase Auth (Google OAuth + Email/Password)

**Flow:**
1. User signs in via Firebase SDK (client-side)
2. Firebase returns `idToken` (JWT) + `user` object with `email`, `uid`, `displayName`, `photoURL`
3. Frontend stores token — Firebase SDK handles persistence in localStorage automatically
4. All protected API calls include `Authorization: Bearer {idToken}` header
5. Backend Lambda extracts and decodes the JWT to get `email` — no Firebase Admin SDK needed for MVP (Google tokens are standard JWTs; email is in the payload)

**Auth context (`AuthContext.jsx`):**  
Wraps the app. Provides `currentUser`, `loading`, `signInWithGoogle()`, `signInWithEmail()`, `signUpWithEmail()`, `signOut()`.

**Protected route (`ProtectedRoute.jsx`):**  
If `!currentUser && !loading` → redirect to `/login`. If `currentUser` + no onboarding → redirect to `/onboarding`.

---

## Page Designs

### `/login`

Dark full-page layout matching the app's existing design (`#06090f` background, Fraunces serif headline).

- W logo + "WanderZenAI" header
- Headline: *"Plan your next slow journey"* (Fraunces, italic contrast)
- **Google button** (white pill, Google logo, "Continue with Google")
- `——— or ———` divider
- Email + Password inputs
- "Sign in →" button (teal gradient)
- "Forgot password?" link
- "No account? Sign up" link → `/signup`

### `/signup`

Same layout as `/login`.

- Google button (same — Firebase handles new vs returning)
- Email + Password + Confirm password inputs
- "Create account →" button
- "Already have an account? Sign in" → `/login`
- Email verification sent after sign-up (Firebase built-in)

### `/onboarding`

Two screens with slim 2-segment progress bar. Both screens have a "Skip for now" link.

**Screen 1 — "Who are you?"**
- Name *(pre-filled from Google displayName if Google sign-in)*
- Age (number input)
- Gender (Male / Female / Other — toggle buttons)
- WhatsApp number *(optional, with +country code prefix)*
- "Next →" button

**Screen 2 — "Your travel defaults"**
- Home city (text input)
- Currency (dropdown — same list as PlanTrip)
- Language (dropdown — same list as PlanTrip)
- "Let's explore →" button → Dashboard

Skipping either screen: saves whatever is filled and proceeds. Profile can be edited from Dashboard later.

### `/dashboard`

- **Header:** W logo + user's name + avatar (initial or Google photo) + sign-out button
- **"Plan a new trip" CTA** — teal gradient card, top of page
- **Past trips section:** cards sorted newest first, each showing:
  - Destination name + country flag emoji
  - Trip duration + date
  - Status badge (Completed / Processing)
  - "📥 PDF" button → signed S3 URL (if available)
  - "Re-plan" button → opens `/plan` with destination pre-filled
- **Empty state:** "No trips yet — plan your first one →"
- **Profile edit:** small "Edit profile" link in header → same 2-screen onboarding form, pre-filled

---

## Database Migration

Add to the existing `users` table:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid  VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name          VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender        VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age           INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp      VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city     VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS language      VARCHAR(50) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
```

`email` already exists and remains the primary lookup key. `firebase_uid` is stored for future use (currently email is the join key with `submissions`/`itineraries`).

---

## New Backend — Profile Lambda

New Lambda: `backend/functions/profile/handler.js`  
Routes registered in `infra/template.yaml`:
- `GET /profile` — returns user row by email from JWT
- `PUT /profile` — upserts user profile fields

**GET `/profile`:**
1. Decode JWT from `Authorization` header (base64 decode payload — no signature check for MVP, upgrade later)
2. Extract `email`
3. `SELECT * FROM users WHERE email = $1`
4. If no row → return `{ exists: false }`
5. Return `{ exists: true, profile: { name, gender, age, whatsapp, home_city, language, onboarding_complete, plan } }`

**PUT `/profile`:**
1. Extract email from JWT
2. `INSERT INTO users (email, name, gender, age, whatsapp, home_city, language, firebase_uid, onboarding_complete) VALUES (...) ON CONFLICT (email) DO UPDATE SET ...`
3. Return `{ ok: true }`

---

## Frontend Pre-fill

When `/plan` loads, if `currentUser` exists:
- Fetch `GET /profile`
- Pre-fill `form.language` from `profile.language`
- Pre-fill `form.currency` from `profile.currency` (not stored yet — add as future column; skip for now)
- Pre-fill `form.userAge` from `profile.age`
- Pre-fill `form.userLocation` from `profile.home_city`
- Pre-fill `form.email` from `currentUser.email`

---

## Files Changed

| File | Action |
|---|---|
| `frontend/package.json` | Add `firebase ^10` |
| `frontend/src/firebase.js` | Firebase app init + auth export |
| `frontend/src/context/AuthContext.jsx` | Auth context + hooks |
| `frontend/src/components/ProtectedRoute.jsx` | Route guard |
| `frontend/src/App.jsx` (or router file) | Add new routes |
| `frontend/src/pages/Login.jsx` | Login page |
| `frontend/src/pages/Signup.jsx` | Sign-up page |
| `frontend/src/pages/Onboarding.jsx` | 2-screen onboarding |
| `frontend/src/pages/Dashboard.jsx` | Full dashboard rewrite |
| `frontend/src/pages/PlanTrip.jsx` | Pre-fill from profile on mount |
| `backend/functions/profile/handler.js` | New profile Lambda |
| `backend/functions/profile/package.json` | Lambda deps (pg via shared layer) |
| `infra/template.yaml` | Add ProfileFunction + `/profile` GET/PUT routes |
| `infra/schema.sql` | Add new user columns |

---

## Personalised Recommendations

Recommendations are woven into three touchpoints. All use the same input data: the user's `profile` (age, gender, home_city, language) + their `past_trips` (destinations, activities selected, travel styles used).

---

### 1. Dashboard — "Recommended for you"

Below the past trips section, a **"Recommended for you"** row shows 3 destination cards.

**How it works:**
- On Dashboard load, frontend calls `GET /recommendations/personalised?email={email}`
- New Lambda endpoint (or extend existing `recommendations` Lambda) fetches user's past destinations from `submissions` table + profile from `users`
- Calls Claude Haiku with:  
  *"User has visited: {past destinations}. Profile: age {age}, gender {gender}, based in {home_city}. Suggest 3 new slow-travel destinations they haven't visited, with a one-line reason why each suits them. Return JSON: [{ destination, country, reason, emoji }]"*
- Results cached per user for 7 days in a new `recommendation_cache` table (keyed by `email`)
- Each card shows: destination name, country, emoji, reason, "Plan this →" button

**Re-planning:** "Re-plan" on past trip cards → opens `/plan` with `destination` pre-filled via router state.

---

### 2. Step 1 (Destination search) — Personalised suggestions

When an authenticated user opens `/plan`, below the search input show a **"Based on your travels"** chip row with 3 suggested destinations (same data as Dashboard recommendations — reuse the cached result, no extra API call).

Tapping a chip fills the destination input and triggers search. If the user has no past trips, this section is hidden.

---

### 3. Step 2 (Activity grid) — Pre-selected categories

When an authenticated user reaches the VenueSelection step, the activity grid highlights categories the user has historically selected across past trips.

**How it works:**
- `GET /profile` response includes a new field `preferred_activities: string[]` — the top 3 most-selected activity categories across all the user's past `submissions`
- `preferred_activities` is computed on the backend by parsing `selected_activities` from the `submissions` JSONB column
- VenueSelection receives `preferredActivities` prop from PlanTrip
- These are passed to `ActivityGrid` as `initialSelected` — pre-checked on mount (user can deselect)

---

### New DB — recommendation_cache table

```sql
CREATE TABLE IF NOT EXISTS recommendation_cache (
  email           VARCHAR(255) PRIMARY KEY,
  recommendations JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

Cache TTL: 7 days. On cache miss → call Claude. On hit → return immediately.

---

### New Backend endpoint

`GET /recommendations/personalised?email={email}`

1. Check `recommendation_cache` for recent entry (< 7 days)
2. If miss: fetch past destinations from `submissions` (last 10, distinct), fetch profile from `users`
3. Call Claude Haiku with the prompt above
4. Store in `recommendation_cache`, return result

Returns: `{ recommendations: [{ destination, country, reason, emoji }], preferred_activities: string[] }`

---

### Updated Files for Recommendations

| File | Addition |
|---|---|
| `backend/functions/recommendations/index.js` | Add `handlePersonalised` route for `GET /recommendations/personalised` |
| `frontend/src/pages/Dashboard.jsx` | "Recommended for you" row |
| `frontend/src/pages/PlanTrip.jsx` | Fetch personalised recs on mount, pass to VenueSelection + show destination chips |
| `frontend/src/components/plantrip/subcomponents/ActivityGrid.jsx` | Accept `initialSelected` prop |
| `infra/schema.sql` | Add `recommendation_cache` table |
| `infra/template.yaml` | Add `/recommendations/personalised` GET route |

---

## Out of Scope

- Backend JWT signature verification (MVP: trust email from decoded payload; upgrade to proper verification post-launch)
- Password reset flow (Firebase built-in "forgot password" email handles this)
- Social login beyond Google (can add Apple/GitHub later)
- Email notifications via WhatsApp (stored for future use)
- Currency stored in profile (add in a follow-up; PlanTrip defaults to USD)
