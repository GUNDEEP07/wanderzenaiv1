# Admin Portal + Role-Based Access Control

**Date:** 2026-06-04
**Status:** Approved, ready for implementation

---

## Overview

A complete RBAC system plus an admin monitoring portal. Every authenticated user has one or more roles stored in a join table. Role determines which portal they land on after login. The admin portal gives Gundeep and internal team real-time visibility into itinerary generation, token costs, user activity, funnel drop-off, AI chat usage, and feedback.

---

## Part 1: RBAC Database Schema

### New tables

```sql
-- Canonical roles catalogue
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data
INSERT INTO roles (name, description) VALUES
  ('user',       'Standard customer — trip planning access'),
  ('admin',      'Internal team — full monitoring dashboard'),
  ('agency',     'B2B partner — white-label itinerary portal'),
  ('support',    'Support team — view submissions, no revenue/cost data'),
  ('superadmin', 'Owner — full access including role management');

-- Many-to-many: one user can hold multiple roles
CREATE TABLE user_roles (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user   ON user_roles(user_id);
CREATE INDEX idx_user_roles_role   ON user_roles(role_id);
```

### Additional tables for new tracking

```sql
-- AI chat session tracking
CREATE TABLE chat_sessions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES users(id),
  firebase_uid   VARCHAR(255),
  messages_count INTEGER DEFAULT 0,
  led_to_plan    BOOLEAN DEFAULT FALSE,
  destination    VARCHAR(255),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_chat_sessions_user    ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_created ON chat_sessions(created_at DESC);

-- User feedback (post-delivery, chat, email)
CREATE TABLE feedback (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id VARCHAR(50) REFERENCES submissions(id),
  user_id       UUID REFERENCES users(id),
  email         VARCHAR(255),
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  destination   VARCHAR(255),
  source        VARCHAR(50) DEFAULT 'post_delivery',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX idx_feedback_rating  ON feedback(rating);
```

---

## Part 2: Role Resolution Logic

**Priority order when a user has multiple roles (highest wins for landing page):**
`superadmin > admin > agency > support > user`

**Frontend routing table:**

| Role | Landing page | Can access |
|---|---|---|
| user | `/dashboard` | `/dashboard`, `/plan` |
| admin | `/admin` | `/admin` (all tabs except role management) |
| agency | `/agency` | `/agency` |
| support | `/admin?view=submissions` | `/admin` submissions + users tabs only |
| superadmin | `/admin` | All admin tabs + role management |

**AuthContext additions:**
- `roles: string[]` — array of all user's role names
- `hasRole(role: string): boolean` — helper
- `primaryRole: string` — highest-privilege role for routing
- Fetched from `GET /profile` response (which adds `roles` field)

**`GET /profile` response change:** Add `roles` array by joining `user_roles → roles` on the user's `id`.

---

## Part 3: Admin Portal Frontend

**Route:** `/admin` — protected by `<RoleGate requiredRoles={['admin', 'superadmin', 'support']}>`

**Tech:** React page `frontend/src/pages/AdminDashboard.jsx` — follows existing dark theme + inline styles pattern.

### Tab structure

| Tab | Roles | Content |
|---|---|---|
| Overview | all admin | KPI cards + daily trend chart |
| Activity | admin, superadmin | Destinations, user locations, submission table |
| Interests | admin, superadmin | Top travel styles bar chart |
| Tokens | admin, superadmin | Monthly token burn, cost trend, per-itinerary avg |
| Chat | admin, superadmin | Session count, messages avg, chat→plan conversion |
| Funnel | admin, superadmin | Step drop-off chart |
| Feedback | all admin | Average rating, rating histogram, comments feed |
| Users | all admin | User list with role badges, plan, activity |
| Roles | superadmin only | Assign/revoke roles per user |

### Overview tab — KPI cards

- Total itineraries (all time)
- This month's itineraries + % change vs last month
- Active users last 30 days
- Completion rate (submitted → email_sent)
- Month-to-date Claude cost (USD)
- Average rating (from feedback table)

### Activity tab

- Line chart: itineraries per day (last 30 days) — from `daily_stats` view
- Bar chart: top 20 destinations — from `submissions` table
- Bar chart: user origin countries — from `submissions.user_location`
- Table: last 50 submissions (destination, email masked, status, plan, date)

### Interests tab

- Horizontal bar chart: top 10 travel styles across all submissions

SQL:
```sql
SELECT interest, COUNT(*) as count
FROM submissions, jsonb_array_elements_text(travel_style) AS interest
GROUP BY interest ORDER BY count DESC LIMIT 10;
```

### Tokens tab

- Line chart: monthly token burn (rolling 12 months)
- Cost breakdown: Claude input cost vs output cost
- Stat: average tokens per itinerary
- Stat: running month-to-date cost

### Chat tab

- Stat: total chat sessions (all time + this month)
- Stat: average messages per session
- Stat: chat→plan conversion rate (`led_to_plan = TRUE` / total sessions)
- Bar chart: sessions per day (last 30 days)

### Funnel tab

- Funnel chart showing drop-off at each step:
  1. `/plan` page visits (Google Analytics event, already tracked)
  2. Step 2 reached (new `analytics.stepReached` event)
  3. Submissions created (`submissions` count)
  4. Emails delivered (`email_log` count)
- Calculated % drop at each stage

### Feedback tab

- Stat: average rating (1–5)
- Bar chart: rating distribution (1, 2, 3, 4, 5 star counts)
- Stat: total feedback responses
- Table: recent comments (rating, comment, destination, date, source)

### Users tab

- Table: all users (email, roles, plan, itinerary count, joined date, last active)
- Search by email
- Filter by role

### Roles tab (superadmin only)

- Same users table
- Each row has role dropdown: assign/revoke any role
- Calls `POST /admin/users/:id/roles` or `DELETE /admin/users/:id/roles/:roleId`

---

## Part 4: Admin Lambda

**New function:** `backend/functions/admin/handler.js`
**SAM route:** `/admin/*` → AdminFunction

**Auth middleware (all admin endpoints):**
1. Extract Firebase JWT from `Authorization: Bearer <token>` header
2. Verify JWT with Firebase Admin SDK
3. Query `user_roles JOIN roles WHERE firebase_uid = ? AND roles.name IN ('admin','superadmin','support')`
4. If no matching role → return 403
5. For superadmin-only endpoints, additionally check `roles.name = 'superadmin'`

**Endpoints:**

```
GET  /admin/stats                    → KPI cards data
GET  /admin/submissions?limit=50     → submissions table
GET  /admin/users?limit=100          → users with roles
GET  /admin/charts/daily             → 30-day daily_stats
GET  /admin/charts/destinations      → top destinations
GET  /admin/charts/locations         → user origin countries
GET  /admin/charts/interests         → top travel styles
GET  /admin/charts/tokens            → monthly token data
GET  /admin/charts/chat              → chat session data
GET  /admin/charts/funnel            → funnel step counts
GET  /admin/feedback?limit=50        → feedback with comments
POST /admin/users/:id/roles          → assign role (superadmin)
DELETE /admin/users/:id/roles/:rid   → revoke role (superadmin)
```

**`/profile` endpoint change:** Add roles to response by joining `user_roles → roles` table.

---

## Part 5: Feedback Collection

### 5a. Confirmation page (`/confirmation`)

After itinerary is submitted and user lands on confirmation, show:
- Heading: "How was your planning experience?"
- 5 star buttons (emoji ⭐)
- Optional textarea for comment (shows after star click)
- Submit → POST `/feedback` with `{ rating, comment, submission_id, source: 'post_delivery' }`

### 5b. TravelChat in-conversation prompt

After Claude sets `readyToPlan: true`, append a feedback message in the next assistant turn:
- Chat bubble: *"Before we dive in — how has our chat been? Tap a star:"*
- Inline 5 star buttons rendered in the chat UI
- Tapping a star submits feedback and dismisses the prompt
- `source: 'chat'`

### 5c. Email link (future enhancement — out of scope for this sprint)

Out of scope to keep this sprint focused.

### 5d. New public API endpoint

`POST /feedback` (no auth required — submission_id is the implicit identifier)

```json
{
  "submission_id": "wz_xxx",
  "rating": 4,
  "comment": "Great suggestions, loved the hidden gems!",
  "source": "post_delivery"
}
```

---

## Part 6: Step Tracking (Drop-off)

**Frontend change:** In `PlanTrip.jsx`, add analytics event on each step advance:

```js
const next = () => {
  if (!validate()) return;
  const nextStep = step + 1;
  goToStep(nextStep);
  analytics.stepReached(STEPS[nextStep], nextStep); // NEW
  if (nextStep === 5) loadPreview(form);
};
```

`analytics.stepReached` → fires `gtag('event', 'step_reached', { step_name, step_index })` to Google Analytics 4. Admin portal reads this from GA4 Data API (future) or uses `submissions` count as a proxy.

For the current sprint: approximate funnel using DB only (no GA4 API call):
- Registered users (users table) vs users with ≥1 submission → "registered but never planned" rate
- Submissions created vs email_sent → completion rate

---

## Part 7: SAM Template + Navigation

### template.yaml changes
- Add `AdminFunction` Lambda with `/admin/{proxy+}` route
- Add Firebase Admin SDK dependency to admin function
- Add `ADMIN_EMAILS` environment variable (comma-separated, for initial bootstrapping)

### Frontend navigation
- Landing.jsx: no change (admin users see "Dashboard" which routes them to `/admin`)
- `App.jsx`: add `/admin` route wrapped in `<RoleGate requiredRoles={['admin','superadmin','support']}>`
- `AuthContext`: on login, detect primary role and redirect accordingly

---

## Out of scope (this sprint)

- GA4 Data API integration for step tracking (use DB approximations for now)
- Email feedback link
- Admin email notifications (e.g. alert when error rate spikes)
- Agency portal real data (AgencyDashboard.jsx is still mock data — separate sprint)
