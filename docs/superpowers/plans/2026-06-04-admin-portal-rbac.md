# Admin Portal + RBAC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete role-based access control system (roles → user_roles join table) and a full admin monitoring portal with 9 tabs covering itineraries, tokens, chat, funnel, interests, feedback and user management.

**Architecture:** DB migration first, then backend (profile Lambda gets roles, new Admin Lambda for all admin endpoints), then frontend (AuthContext gains roles, RoleGate component gates routes, AdminDashboard renders tabs). Feedback and step tracking are independent and can run in any order after task 1.

**Tech Stack:** Node 20 Lambda, Postgres (RDS), React 18, Vite, Firebase JWT (base64 decode — no Admin SDK), recharts or inline SVG for charts, AWS SAM

---

## Execution order (strict)

Task 1 → 2 → 3 → 4 → 5 (must deploy before 5 can be tested) → 6 → 7

Tasks 6 and 7 are independent of each other.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `infra/schema.sql` | Modify | Add roles, user_roles, chat_sessions, feedback tables |
| `backend/functions/profile/handler.js` | Modify | Add roles array to GET /profile response |
| `backend/functions/admin/handler.js` | **Create** | All admin API endpoints with role auth |
| `infra/template.yaml` | Modify | Add AdminFunction + /feedback endpoint to form-handler |
| `frontend/src/context/AuthContext.jsx` | Modify | Add roles state, hasRole(), primaryRole |
| `frontend/src/components/RoleGate.jsx` | **Create** | Role-based route guard component |
| `frontend/src/App.jsx` | Modify | Add /admin route + role-based redirects |
| `frontend/src/pages/AdminDashboard.jsx` | **Create** | Full admin portal with 9 tabs |
| `frontend/src/pages/Confirmation.jsx` | Modify | Add star rating feedback widget |
| `frontend/src/components/TravelChat.jsx` | Modify | Add in-chat feedback prompt after readyToPlan |
| `frontend/src/pages/PlanTrip.jsx` | Modify | Fire analytics.stepReached on each step |

---

## Task 1: DB Schema Migration

**Files:**
- Modify: `infra/schema.sql`

- [ ] **Step 1: Append new tables to schema.sql**

Open `infra/schema.sql` and append at the very end:

```sql
-- ─── RBAC: roles catalogue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('user',       'Standard customer — trip planning access'),
  ('admin',      'Internal team — full monitoring dashboard'),
  ('agency',     'B2B partner — white-label itinerary portal'),
  ('support',    'Support team — view submissions, no revenue/cost data'),
  ('superadmin', 'Owner — full access including role management')
ON CONFLICT (name) DO NOTHING;

-- ─── RBAC: user → role join ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ─── Chat session tracking ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES users(id),
  firebase_uid   VARCHAR(255),
  messages_count INTEGER DEFAULT 0,
  led_to_plan    BOOLEAN DEFAULT FALSE,
  destination    VARCHAR(255),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user    ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(created_at DESC);

-- ─── User feedback ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
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
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating  ON feedback(rating);
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && npm run db:migrate
```
Expected: `CREATE TABLE`, `INSERT 5`, `CREATE INDEX` lines with no errors.

- [ ] **Step 3: Verify**

Connect to RDS and run:
```sql
SELECT name FROM roles ORDER BY id;
-- Expected: user, admin, agency, support, superadmin

SELECT table_name FROM information_schema.tables
WHERE table_name IN ('user_roles','chat_sessions','feedback');
-- Expected: 3 rows
```

To make yourself (Gundeep) a superadmin immediately, run:
```sql
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r
WHERE u.email = 'gundeep07@gmail.com' AND r.name = 'superadmin'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 4: Commit**

```bash
git add infra/schema.sql && git commit -m "feat: add roles, user_roles, chat_sessions, feedback tables to schema"
```

---

## Task 2: Add roles to GET /profile response

**Files:**
- Modify: `backend/functions/profile/handler.js`

- [ ] **Step 1: Add roles query to the GET /profile handler**

Find the GET /profile block (around line 144). After the `userResult` query and before building the response, add a roles query:

Find this section (around line 188):
```js
      const [, tripsResult] = await Promise.all([
        Promise.resolve(),
        db.query(
          `SELECT s.id, s.destination, s.days, s.status, s.created_at,
```

Insert the roles query as a third item in `Promise.all`:

```js
      const [, tripsResult, rolesResult] = await Promise.all([
        Promise.resolve(),
        db.query(
          `SELECT s.id, s.destination, s.days, s.status, s.created_at,
                  i.id AS itinerary_id`,
          // ... rest of existing query unchanged
        ),
        db.query(
          `SELECT r.name FROM user_roles ur
           JOIN roles r ON r.id = ur.role_id
           JOIN users u ON u.id = ur.user_id
           WHERE u.email = $1`,
          [email]
        ).catch(() => ({ rows: [] })),   // graceful — table may not exist yet
      ]);
```

Then in the response object, add `roles`:
```js
        return {
          statusCode: 200,
          headers: CORS,
          body: JSON.stringify({
            profile: userResult.rows[0] || null,
            pastTrips: tripsResult.rows,
            roles: rolesResult.rows.map(r => r.name),   // ADD THIS LINE
          }),
        };
```

- [ ] **Step 2: Verify build**

```bash
node --input-type=module --eval "import('./backend/functions/profile/handler.js').then(()=>console.log('OK')).catch(e=>{if(!e.message.includes('DB_HOST'))console.error(e.message);else console.log('OK');})" 2>&1
```
Expected: `OK`

- [ ] **Step 3: Commit and push (triggers GitHub Actions deploy)**

```bash
git add backend/functions/profile/handler.js && git commit -m "feat: include user roles array in GET /profile response" && git push origin main
```

---

## Task 3: Frontend RBAC — AuthContext + RoleGate + routing

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/components/RoleGate.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Add roles state to AuthContext**

Open `frontend/src/context/AuthContext.jsx`. Find the state declarations at the top of `AuthProvider`:

```js
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
```

Add roles state:
```js
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState([]);
```

Find the `onAuthStateChanged` handler. After `setCurrentUser(user)`, add a roles fetch:

```js
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`${import.meta.env.VITE_API_URL}/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const d = await res.json();
            setUserRoles(d.roles || []);
          }
        } catch { /* graceful */ }
      } else {
        setUserRoles([]);
      }
      setLoading(false);
    });
```

Add helper functions and export them. Find the `return` of `AuthProvider`:

```jsx
  const ROLE_PRIORITY = { superadmin: 5, admin: 4, agency: 3, support: 2, user: 1 };
  const hasRole = (role) => userRoles.includes(role);
  const primaryRole = userRoles.reduce((best, r) =>
    (ROLE_PRIORITY[r] || 0) > (ROLE_PRIORITY[best] || 0) ? r : best,
    'user'
  );

  return (
    <AuthContext.Provider value={{
      currentUser, loading,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, resetPassword, getIdToken,
      isDemo: !FIREBASE_CONFIGURED,
      userRoles, hasRole, primaryRole,   // ADD THESE
    }}>
```

- [ ] **Step 2: Create RoleGate component**

Create `frontend/src/components/RoleGate.jsx`:

```jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const ROLE_LANDING = {
  superadmin: '/admin',
  admin:      '/admin',
  support:    '/admin',
  agency:     '/agency',
  user:       '/dashboard',
};

export function RoleGate({ requiredRoles, children, fallback = null }) {
  const { currentUser, userRoles, loading, primaryRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!currentUser) { navigate('/login'); return; }
    if (requiredRoles && !requiredRoles.some(r => userRoles.includes(r))) {
      navigate(ROLE_LANDING[primaryRole] || '/dashboard');
    }
  }, [loading, currentUser, userRoles]);

  if (loading || !currentUser) return fallback;
  if (requiredRoles && !requiredRoles.some(r => userRoles.includes(r))) return fallback;
  return children;
}

export { ROLE_LANDING };
```

- [ ] **Step 3: Add /admin route and role-based post-login redirect in App.jsx**

Open `frontend/src/App.jsx`. Add the AdminDashboard import:

```jsx
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
```

Add the route (after the `/agency` route):
```jsx
<Route path="/admin" element={<RoleGate requiredRoles={['admin','superadmin','support']}><AdminDashboard /></RoleGate>} />
```

Import RoleGate at the top:
```jsx
import { RoleGate } from './components/RoleGate';
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/components/RoleGate.jsx frontend/src/App.jsx && git commit -m "feat: RBAC frontend — roles in AuthContext, RoleGate component, /admin route"
```

---

## Task 4: Admin Lambda + SAM template

**Files:**
- Create: `backend/functions/admin/handler.js`
- Create: `backend/functions/admin/package.json`
- Modify: `infra/template.yaml`

- [ ] **Step 1: Create package.json for admin Lambda**

Create `backend/functions/admin/package.json`:

```json
{
  "name": "admin-lambda",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.36.0",
    "pg": "^8.11.3"
  }
}
```

Run `npm install` in that directory:
```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/backend/functions/admin && npm install
```

- [ ] **Step 2: Create admin handler**

Create `backend/functions/admin/handler.js`:

```javascript
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// ── Auth middleware ────────────────────────────────────────────────────────────
async function getAdminEmail(event) {
  const auth = event.headers?.Authorization || event.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token || token === 'demo-token') return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.email || null;
  } catch { return null; }
}

async function requireAdmin(email, minRole = 'admin') {
  if (!email) return false;
  const allowedRoles = minRole === 'superadmin'
    ? ['superadmin']
    : ['admin', 'superadmin', 'support'];
  const result = await pool.query(
    `SELECT r.name FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN users u ON u.id = ur.user_id
     WHERE u.email = $1 AND r.name = ANY($2)
     LIMIT 1`,
    [email, allowedRoles]
  );
  return result.rows.length > 0;
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' }, body: '' };
  }

  const email = await getAdminEmail(event);
  const path = event.path?.replace(/^\/admin/, '') || '';
  const method = event.httpMethod;

  // Support role can only access /submissions, /users, /feedback
  const supportOnlyPaths = ['/submissions', '/users', '/feedback'];
  const emailRoles = email ? await pool.query(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id WHERE u.email = $1`,
    [email]
  ).then(r => r.rows.map(x => x.name)).catch(() => []) : [];

  const isSupport = emailRoles.includes('support') && !emailRoles.includes('admin') && !emailRoles.includes('superadmin');
  if (isSupport && !supportOnlyPaths.some(p => path.startsWith(p))) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  const isAdmin = await requireAdmin(email);
  if (!isAdmin) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Admin access required' }) };
  }

  try {
    // ── GET /admin/stats ────────────────────────────────────────────────────
    if (path === '/stats' && method === 'GET') {
      const [total, monthly, active, completion, cost, avgRating] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM submissions`),
        pool.query(`SELECT COUNT(*) FROM submissions WHERE created_at >= date_trunc('month', NOW())`),
        pool.query(`SELECT COUNT(DISTINCT email) FROM submissions WHERE created_at > NOW() - INTERVAL '30 days'`),
        pool.query(`SELECT ROUND(100.0 * SUM(CASE WHEN status='email_sent' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 1) as rate FROM submissions`),
        pool.query(`SELECT ROUND(SUM(claude_input_tokens)*3.0/1000000 + SUM(claude_output_tokens)*15.0/1000000, 2) as cost FROM itineraries WHERE created_at >= date_trunc('month', NOW())`),
        pool.query(`SELECT ROUND(AVG(rating),1) as avg FROM feedback`),
      ]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        totalItineraries: +total.rows[0].count,
        monthlyItineraries: +monthly.rows[0].count,
        activeUsers30d: +active.rows[0].count,
        completionRate: +completion.rows[0].rate || 0,
        monthlyClaudeCostUSD: +cost.rows[0].cost || 0,
        avgRating: +avgRating.rows[0].avg || 0,
      })};
    }

    // ── GET /admin/charts/daily ─────────────────────────────────────────────
    if (path === '/charts/daily' && method === 'GET') {
      const result = await pool.query(
        `SELECT date, total_submissions, completed, failed FROM daily_stats WHERE date >= NOW() - INTERVAL '30 days' ORDER BY date`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    // ── GET /admin/charts/destinations ──────────────────────────────────────
    if (path === '/charts/destinations' && method === 'GET') {
      const result = await pool.query(
        `SELECT destination, COUNT(*) as count FROM submissions GROUP BY destination ORDER BY count DESC LIMIT 20`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    // ── GET /admin/charts/locations ─────────────────────────────────────────
    if (path === '/charts/locations' && method === 'GET') {
      const result = await pool.query(
        `SELECT user_location, COUNT(*) as count FROM submissions WHERE user_location IS NOT NULL AND user_location != '' GROUP BY user_location ORDER BY count DESC LIMIT 20`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    // ── GET /admin/charts/interests ─────────────────────────────────────────
    if (path === '/charts/interests' && method === 'GET') {
      const result = await pool.query(
        `SELECT interest, COUNT(*) as count FROM submissions, jsonb_array_elements_text(travel_style) AS interest GROUP BY interest ORDER BY count DESC LIMIT 10`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    // ── GET /admin/charts/tokens ────────────────────────────────────────────
    if (path === '/charts/tokens' && method === 'GET') {
      const result = await pool.query(
        `SELECT DATE_TRUNC('month', created_at) as month,
                SUM(claude_input_tokens) as input_tokens,
                SUM(claude_output_tokens) as output_tokens,
                ROUND(SUM(claude_input_tokens)*3.0/1000000, 4) as input_cost_usd,
                ROUND(SUM(claude_output_tokens)*15.0/1000000, 4) as output_cost_usd,
                COUNT(*) as itineraries
         FROM itineraries
         WHERE created_at >= NOW() - INTERVAL '12 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY month`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    // ── GET /admin/charts/chat ──────────────────────────────────────────────
    if (path === '/charts/chat' && method === 'GET') {
      const [sessions, conversion] = await Promise.all([
        pool.query(`SELECT DATE(created_at) as date, COUNT(*) as sessions, AVG(messages_count)::int as avg_messages FROM chat_sessions WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY DATE(created_at) ORDER BY date`),
        pool.query(`SELECT COUNT(*) as total, SUM(CASE WHEN led_to_plan THEN 1 ELSE 0 END) as converted FROM chat_sessions`),
      ]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        daily: sessions.rows,
        totalSessions: +conversion.rows[0].total,
        converted: +conversion.rows[0].converted,
        conversionRate: conversion.rows[0].total > 0
          ? Math.round(100 * conversion.rows[0].converted / conversion.rows[0].total)
          : 0,
      })};
    }

    // ── GET /admin/charts/funnel ────────────────────────────────────────────
    if (path === '/charts/funnel' && method === 'GET') {
      const [registered, submitted, delivered] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM users`),
        pool.query(`SELECT COUNT(DISTINCT email) FROM submissions`),
        pool.query(`SELECT COUNT(*) FROM submissions WHERE status = 'email_sent'`),
      ]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify([
        { stage: 'Registered', count: +registered.rows[0].count },
        { stage: 'Submitted', count: +submitted.rows[0].count },
        { stage: 'Delivered', count: +delivered.rows[0].count },
      ])};
    }

    // ── GET /admin/submissions ──────────────────────────────────────────────
    if (path === '/submissions' && method === 'GET') {
      const limit = Math.min(+(event.queryStringParameters?.limit || 50), 200);
      const status = event.queryStringParameters?.status;
      const result = await pool.query(
        `SELECT id, email, destination, days, budget, currency, status, plan, created_at, language, user_location
         FROM submissions
         ${status && status !== 'all' ? 'WHERE status = $2' : ''}
         ORDER BY created_at DESC LIMIT $1`,
        status && status !== 'all' ? [limit, status] : [limit]
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    // ── GET /admin/users ────────────────────────────────────────────────────
    if (path === '/users' && method === 'GET') {
      const result = await pool.query(
        `SELECT u.id, u.email, u.name, u.plan, u.home_city, u.created_at,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') as roles,
                (SELECT COUNT(*) FROM submissions s WHERE s.email = u.email) as itinerary_count
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         GROUP BY u.id ORDER BY u.created_at DESC LIMIT 200`
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify(result.rows) };
    }

    // ── GET /admin/feedback ─────────────────────────────────────────────────
    if (path === '/feedback' && method === 'GET') {
      const [summary, recent] = await Promise.all([
        pool.query(`SELECT rating, COUNT(*) as count FROM feedback GROUP BY rating ORDER BY rating DESC`),
        pool.query(`SELECT rating, comment, destination, source, created_at, email FROM feedback ORDER BY created_at DESC LIMIT 50`),
      ]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        distribution: summary.rows,
        recent: recent.rows,
      })};
    }

    // ── POST /admin/users/:id/roles ─────────────────────────────────────────
    if (path.match(/^\/users\/[^/]+\/roles$/) && method === 'POST') {
      const isSuperAdmin = await requireAdmin(email, 'superadmin');
      if (!isSuperAdmin) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Superadmin only' }) };
      const userId = path.split('/')[2];
      const { roleName } = JSON.parse(event.body || '{}');
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id, assigned_by)
         SELECT $1, r.id, (SELECT id FROM users WHERE email = $3)
         FROM roles r WHERE r.name = $2
         ON CONFLICT DO NOTHING`,
        [userId, roleName, email]
      );
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    // ── DELETE /admin/users/:id/roles/:roleId ───────────────────────────────
    if (path.match(/^\/users\/[^/]+\/roles\/\d+$/) && method === 'DELETE') {
      const isSuperAdmin = await requireAdmin(email, 'superadmin');
      if (!isSuperAdmin) return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Superadmin only' }) };
      const parts = path.split('/');
      const userId = parts[2];
      const roleId = parts[4];
      await pool.query(`DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2`, [userId, roleId]);
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    console.error('Admin handler error:', err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Internal error' }) };
  }
}
```

- [ ] **Step 3: Add AdminFunction to template.yaml**

In `infra/template.yaml`, find the `ProfileFunction` block and add `AdminFunction` AFTER it:

```yaml
  AdminFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub wanderzenai-admin-${Stage}
      CodeUri: ../backend/functions/admin
      Handler: handler.handler
      Timeout: 30
      MemorySize: 512
      Description: Admin monitoring portal API — role-protected
      Events:
        AdminProxy:
          Type: Api
          Properties:
            RestApiId: !Ref WanderZenApi
            Path: /admin/{proxy+}
            Method: ANY
        AdminRoot:
          Type: Api
          Properties:
            RestApiId: !Ref WanderZenApi
            Path: /admin
            Method: ANY
```

Also add `POST /feedback` to the form-handler function events (feedback from users doesn't need auth):

Find `FormHandlerFunction` events block and add:
```yaml
        PostFeedback:
          Type: Api
          Properties:
            RestApiId: !Ref WanderZenApi
            Path: /feedback
            Method: POST
```

- [ ] **Step 4: Verify SAM template**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && sam validate --template infra/template.yaml --lint 2>&1 | head -5
```
Expected: `infra/template.yaml is a valid SAM Template` (or no errors)

- [ ] **Step 5: Commit and push**

```bash
git add backend/functions/admin/ infra/template.yaml && git commit -m "feat: admin Lambda with 12 endpoints + SAM template" && git push origin main
```

---

## Task 5: AdminDashboard frontend page

**Files:**
- Create: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Create AdminDashboard.jsx**

Create `frontend/src/pages/AdminDashboard.jsx` with the full admin portal:

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL;

const TABS = [
  { id: 'overview',  label: '◈ Overview' },
  { id: 'activity',  label: '◎ Activity' },
  { id: 'interests', label: '△ Interests' },
  { id: 'tokens',    label: '◆ Tokens' },
  { id: 'chat',      label: '◑ Chat' },
  { id: 'funnel',    label: '▦ Funnel' },
  { id: 'feedback',  label: '✦ Feedback' },
  { id: 'users',     label: '⊘ Users' },
  { id: 'roles',     label: '⊛ Roles', superadminOnly: true },
];

async function adminFetch(path, token) {
  const res = await fetch(`${API}/admin${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export default function AdminDashboard() {
  const { currentUser, getIdToken, hasRole, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [tabData, setTabData] = useState({});
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = hasRole('superadmin');

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      const token = await getIdToken();
      try {
        const s = await adminFetch('/stats', token);
        setStats(s);
      } catch { /* graceful */ }
      setLoading(false);
    })();
  }, [currentUser]);

  const loadTab = async (tabId) => {
    if (tabData[tabId]) return;
    const token = await getIdToken();
    const paths = {
      activity:  ['/charts/daily', '/charts/destinations', '/submissions'],
      interests: ['/charts/interests'],
      tokens:    ['/charts/tokens'],
      chat:      ['/charts/chat'],
      funnel:    ['/charts/funnel'],
      feedback:  ['/feedback'],
      users:     ['/users'],
      roles:     ['/users'],
    };
    if (!paths[tabId]) return;
    try {
      const results = await Promise.all(paths[tabId].map(p => adminFetch(p, token)));
      setTabData(prev => ({ ...prev, [tabId]: results }));
    } catch { /* graceful */ }
  };

  const handleTabChange = (t) => {
    setTab(t);
    loadTab(t);
  };

  const s = {
    page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
    nav: { padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,9,15,0.95)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 },
    logo: { display: 'flex', alignItems: 'center', gap: 8 },
    logoMark: { width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#06090f' },
    badge: { padding: '3px 10px', borderRadius: 20, background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', fontSize: 10, fontWeight: 800, color: '#ff6b6b', textTransform: 'uppercase', letterSpacing: '0.08em' },
    sidebar: { width: 200, flexShrink: 0, padding: '20px 0', borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' },
    tabBtn: (active) => ({ display: 'block', width: '100%', padding: '10px 20px', background: active ? 'rgba(0,212,170,0.1)' : 'none', border: 'none', borderLeft: `2px solid ${active ? '#00d4aa' : 'transparent'}`, color: active ? '#00d4aa' : 'rgba(255,255,255,0.5)', fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }),
    content: { flex: 1, padding: '28px 32px', overflowY: 'auto' },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 32 },
    kpi: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '16px 18px' },
    kpiNum: { fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, color: '#00d4aa', lineHeight: 1, marginBottom: 4 },
    kpiLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' },
    secTitle: { fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { textAlign: 'left', padding: '8px 12px', fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.07)' },
    td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', verticalAlign: 'middle' },
    statusBadge: (s) => ({
      padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
      background: s === 'email_sent' ? 'rgba(0,212,170,0.12)' : s === 'pending' ? 'rgba(255,217,61,0.1)' : 'rgba(255,255,255,0.06)',
      color: s === 'email_sent' ? '#00d4aa' : s === 'pending' ? '#ffd93d' : 'rgba(255,255,255,0.4)',
    }),
  };

  return (
    <div style={s.page}>
      {/* Nav */}
      <nav style={s.nav}>
        <div style={s.logo}>
          <div style={s.logoMark}>W</div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>WanderZenAI</span>
          <span style={s.badge}>Admin</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{currentUser?.email}</span>
          <button onClick={() => { signOut(); navigate('/login'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Sign out</button>
        </div>
      </nav>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 57px)' }}>
        {/* Sidebar */}
        <div style={s.sidebar}>
          {TABS.filter(t => !t.superadminOnly || isSuperAdmin).map(t => (
            <button key={t.id} style={s.tabBtn(tab === t.id)} onClick={() => handleTabChange(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={s.content}>
          {loading && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Loading…</div>}

          {/* ── Overview ── */}
          {!loading && tab === 'overview' && stats && (
            <div>
              <div style={s.secTitle}>Overview</div>
              <div style={s.kpiGrid}>
                {[
                  { label: 'Total itineraries', value: stats.totalItineraries?.toLocaleString() },
                  { label: 'This month', value: stats.monthlyItineraries?.toLocaleString() },
                  { label: 'Active users (30d)', value: stats.activeUsers30d?.toLocaleString() },
                  { label: 'Completion rate', value: `${stats.completionRate}%` },
                  { label: 'Monthly AI cost', value: `$${stats.monthlyClaudeCostUSD}` },
                  { label: 'Avg rating', value: stats.avgRating ? `${stats.avgRating} ★` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={s.kpi}>
                    <div style={s.kpiNum}>{value ?? '—'}</div>
                    <div style={s.kpiLabel}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Activity ── */}
          {tab === 'activity' && (
            <div>
              <div style={s.secTitle}>Activity</div>
              {tabData.activity ? (
                <>
                  {/* Top destinations */}
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Top destinations</div>
                    {tabData.activity[1]?.slice(0, 10).map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                        <div style={{ width: 140, fontSize: 12, color: '#fff', flexShrink: 0 }}>{d.destination}</div>
                        <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.round(100 * d.count / (tabData.activity[1][0]?.count || 1))}%`, height: '100%', background: '#00d4aa', borderRadius: 3 }} />
                        </div>
                        <div style={{ width: 30, fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}>{d.count}</div>
                      </div>
                    ))}
                  </div>
                  {/* Recent submissions table */}
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Recent submissions</div>
                  <table style={s.table}>
                    <thead>
                      <tr>{['Destination', 'Email', 'Plan', 'Status', 'Date'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {tabData.activity[2]?.slice(0, 30).map(r => (
                        <tr key={r.id}>
                          <td style={s.td}>{r.destination}</td>
                          <td style={s.td}>{r.email?.replace(/(.{3}).*(@.*)/, '$1***$2')}</td>
                          <td style={s.td}><span style={{ color: r.plan === 'paid' ? '#ffd93d' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}>{r.plan}</span></td>
                          <td style={s.td}><span style={s.statusBadge(r.status)}>{r.status}</span></td>
                          <td style={s.td}>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}

          {/* ── Interests ── */}
          {tab === 'interests' && (
            <div>
              <div style={s.secTitle}>Top travel interests</div>
              {tabData.interests ? tabData.interests[0]?.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 120, fontSize: 13, color: '#fff', flexShrink: 0 }}>{d.interest}</div>
                  <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(100 * d.count / (tabData.interests[0][0]?.count || 1))}%`, height: '100%', background: 'linear-gradient(90deg,#00d4aa,#00916a)', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 36, fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'right' }}>{d.count}</div>
                </div>
              )) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}

          {/* ── Tokens ── */}
          {tab === 'tokens' && (
            <div>
              <div style={s.secTitle}>Token utilisation</div>
              {tabData.tokens ? (
                <table style={s.table}>
                  <thead><tr>{['Month', 'Itineraries', 'Input tokens', 'Output tokens', 'Cost (USD)'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.tokens[0]?.map((r, i) => (
                      <tr key={i}>
                        <td style={s.td}>{new Date(r.month).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</td>
                        <td style={s.td}>{r.itineraries}</td>
                        <td style={s.td}>{(+r.input_tokens).toLocaleString()}</td>
                        <td style={s.td}>{(+r.output_tokens).toLocaleString()}</td>
                        <td style={s.td}><span style={{ color: '#ffd93d', fontWeight: 700 }}>${(+r.input_cost_usd + +r.output_cost_usd).toFixed(2)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}

          {/* ── Chat ── */}
          {tab === 'chat' && (
            <div>
              <div style={s.secTitle}>AI Chat usage</div>
              {tabData.chat ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
                  {[
                    { label: 'Total sessions', value: tabData.chat[0]?.totalSessions },
                    { label: 'Led to planning', value: tabData.chat[0]?.converted },
                    { label: 'Conversion rate', value: `${tabData.chat[0]?.conversionRate}%` },
                  ].map(({ label, value }) => (
                    <div key={label} style={s.kpi}><div style={s.kpiNum}>{value ?? '—'}</div><div style={s.kpiLabel}>{label}</div></div>
                  ))}
                </div>
              ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}

          {/* ── Funnel ── */}
          {tab === 'funnel' && (
            <div>
              <div style={s.secTitle}>User funnel</div>
              {tabData.funnel ? tabData.funnel[0]?.map((stage, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 100, fontSize: 13, color: '#fff' }}>{stage.stage}</div>
                  <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(100 * stage.count / (tabData.funnel[0][0]?.count || 1))}%`, height: '100%', background: `linear-gradient(90deg, #00d4aa, #00916a)`, borderRadius: 5, opacity: 1 - i * 0.2 }} />
                  </div>
                  <div style={{ width: 60, fontSize: 13, fontWeight: 700, color: '#00d4aa' }}>{stage.count?.toLocaleString()}</div>
                  {i > 0 && tabData.funnel[0][i - 1]?.count > 0 && (
                    <div style={{ width: 50, fontSize: 10, color: '#ff6b6b' }}>
                      -{Math.round(100 - 100 * stage.count / tabData.funnel[0][i - 1].count)}%
                    </div>
                  )}
                </div>
              )) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}

          {/* ── Feedback ── */}
          {tab === 'feedback' && (
            <div>
              <div style={s.secTitle}>User feedback</div>
              {tabData.feedback ? (
                <>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    {tabData.feedback[0]?.distribution?.map(d => (
                      <div key={d.rating} style={{ ...s.kpi, textAlign: 'center', minWidth: 80 }}>
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{'★'.repeat(d.rating)}</div>
                        <div style={{ ...s.kpiNum, fontSize: 20 }}>{d.count}</div>
                      </div>
                    ))}
                  </div>
                  <table style={s.table}>
                    <thead><tr>{['Rating', 'Comment', 'Destination', 'Source', 'Date'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {tabData.feedback[0]?.recent?.map((r, i) => (
                        <tr key={i}>
                          <td style={s.td}>{'★'.repeat(r.rating)}</td>
                          <td style={{ ...s.td, maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.comment || '—'}</td>
                          <td style={s.td}>{r.destination || '—'}</td>
                          <td style={s.td}>{r.source}</td>
                          <td style={s.td}>{new Date(r.created_at).toLocaleDateString('en-GB')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div>
              <div style={s.secTitle}>Users</div>
              {tabData.users ? (
                <table style={s.table}>
                  <thead><tr>{['Email', 'Name', 'Plan', 'Roles', 'Itineraries', 'Joined'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.users[0]?.map((u, i) => (
                      <tr key={i}>
                        <td style={s.td}>{u.email}</td>
                        <td style={s.td}>{u.name || '—'}</td>
                        <td style={s.td}><span style={{ color: u.plan !== 'free' ? '#ffd93d' : 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 11 }}>{u.plan}</span></td>
                        <td style={s.td}>
                          {u.roles?.filter(r => r).map(r => (
                            <span key={r} style={{ marginRight: 4, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: '#00d4aa', fontSize: 9, fontWeight: 700 }}>{r}</span>
                          ))}
                        </td>
                        <td style={s.td}>{u.itinerary_count}</td>
                        <td style={s.td}>{u.created_at ? new Date(u.created_at).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}

          {/* ── Roles (superadmin) ── */}
          {tab === 'roles' && isSuperAdmin && (
            <div>
              <div style={s.secTitle}>Role management</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Assign or revoke roles per user. Changes take effect on next login.</div>
              {tabData.roles ? (
                <table style={s.table}>
                  <thead><tr>{['Email', 'Current roles', 'Assign role'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {tabData.roles[0]?.map((u, i) => (
                      <RoleRow key={i} user={u} getIdToken={getIdToken} API={API} />
                    ))}
                  </tbody>
                </table>
              ) : <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>Loading…</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleRow({ user, getIdToken, API }) {
  const [roles, setRoles] = useState(user.roles?.filter(Boolean) || []);
  const [assigning, setAssigning] = useState(false);

  const assign = async (roleName) => {
    if (roles.includes(roleName)) return;
    setAssigning(true);
    try {
      const token = await getIdToken();
      await fetch(`${API}/admin/users/${user.id}/roles`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName }),
      });
      setRoles(r => [...r, roleName]);
    } finally { setAssigning(false); }
  };

  const s = {
    td: { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', verticalAlign: 'middle', fontSize: 12 },
    rolePill: { marginRight: 4, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', color: '#00d4aa', fontSize: 9, fontWeight: 700 },
    assignBtn: (active) => ({ marginRight: 5, padding: '4px 10px', borderRadius: 10, background: active ? 'rgba(255,255,255,0.04)' : 'rgba(0,212,170,0.1)', border: `1px solid ${active ? 'rgba(255,255,255,0.08)' : 'rgba(0,212,170,0.25)'}`, color: active ? 'rgba(255,255,255,0.3)' : '#00d4aa', fontSize: 10, fontWeight: 700, cursor: active ? 'default' : 'pointer', fontFamily: 'inherit' }),
  };

  return (
    <tr>
      <td style={s.td}>{user.email}</td>
      <td style={s.td}>{roles.map(r => <span key={r} style={s.rolePill}>{r}</span>)}</td>
      <td style={s.td}>
        {['user','admin','agency','support','superadmin'].map(r => (
          <button key={r} disabled={assigning || roles.includes(r)} style={s.assignBtn(roles.includes(r))} onClick={() => assign(r)}>
            {roles.includes(r) ? `✓ ${r}` : `+ ${r}`}
          </button>
        ))}
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 3: Commit and push**

```bash
git add frontend/src/pages/AdminDashboard.jsx && git commit -m "feat: AdminDashboard — 9 tabs with KPIs, charts, tables, role management" && git push origin main
```

---

## Task 6: Feedback collection — Confirmation page + TravelChat + POST /feedback endpoint

**Files:**
- Modify: `frontend/src/pages/Confirmation.jsx`
- Modify: `frontend/src/components/TravelChat.jsx`
- Modify: `backend/functions/form-handler/index.js`

- [ ] **Step 1: Add POST /feedback to form-handler**

In `backend/functions/form-handler/index.js`, find the main route logic. Add a new path check for `/feedback`:

Find (around line 87, just before the `// ─── POST /submit`):

```js
  // ─── POST /feedback ─────────────────────────────────────────────────────────
  if (event.path === '/feedback' || event.path?.endsWith('/feedback')) {
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }
    const { submission_id, rating, comment, destination, source = 'post_delivery' } = body;
    if (!rating || rating < 1 || rating > 5) return badRequest('rating must be 1-5');
    const db = getDB();
    try {
      await db.query(
        `INSERT INTO feedback (submission_id, email, rating, comment, destination, source)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [submission_id || null, body.email || null, rating, comment || null, destination || null, source]
      );
      return ok({ saved: true });
    } catch (err) {
      log.error('Feedback save failed', { error: err.message });
      return serverError('Failed to save feedback');
    }
  }
```

- [ ] **Step 2: Add star rating widget to Confirmation.jsx**

Open `frontend/src/pages/Confirmation.jsx`. Read the file first to find the right spot. After the main confirmation message (the "Your itinerary is on its way" section), add:

```jsx
{/* Feedback */}
<FeedbackWidget submissionId={submissionId} destination={destination} />
```

Create the `FeedbackWidget` function in the same file:

```jsx
function FeedbackWidget({ submissionId, destination }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hovering, setHovering] = useState(0);

  const submit = async () => {
    if (!rating) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, rating, comment, destination, source: 'post_delivery' }),
      });
      setSubmitted(true);
    } catch { setSubmitted(true); /* silent fail */ }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 12, marginTop: 24 }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🙏</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#00d4aa' }}>Thank you for your feedback!</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28, padding: '20px 24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>How was your planning experience?</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>Takes 10 seconds — helps us improve</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 14 }}>
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHovering(n)}
            onMouseLeave={() => setHovering(0)}
            style={{ fontSize: 28, background: 'none', border: 'none', cursor: 'pointer', opacity: n <= (hovering || rating) ? 1 : 0.3, transition: 'opacity 0.1s', transform: n <= (hovering || rating) ? 'scale(1.1)' : 'scale(1)' }}
          >
            ⭐
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Any comments? (optional)"
            rows={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', resize: 'none', outline: 'none', marginBottom: 10 }}
          />
          <button
            type="button"
            onClick={submit}
            style={{ padding: '9px 24px', background: '#00d4aa', border: 'none', borderRadius: 8, color: '#0a0f1e', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}
          >
            Submit →
          </button>
        </>
      )}
    </div>
  );
}
```

Also add `useState` to the import at the top of Confirmation.jsx.

- [ ] **Step 3: Add in-chat feedback prompt to TravelChat.jsx**

In `TravelChat.jsx`, find the section that handles `data.readyToPlan && data.tripData` (around line 73):

```jsx
      if (data.readyToPlan && data.tripData) {
        setPendingTrip(data.tripData);
      }
```

Replace with:

```jsx
      if (data.readyToPlan && data.tripData) {
        setPendingTrip(data.tripData);
        // Append feedback prompt after the AI response is done streaming
        setTimeout(() => {
          setHistory(h => [...h, { role: 'assistant', content: '✨ How has our chat been so far? Tap a star:', isFeedbackPrompt: true, destination: data.tripData?.destination }]);
        }, 500);
      }
```

In the message rendering section (around line 167), add special rendering for feedback prompts:

```jsx
          {history.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && !msg.isFeedbackPrompt && (
                <div style={{ width: 24, height: 24, ... }}>✦</div>
              )}
              {msg.isFeedbackPrompt ? (
                <ChatFeedback destination={msg.destination} />
              ) : (
                <div style={{ ... }}>{msg.content}</div>
              )}
            </div>
          ))}
```

Add the `ChatFeedback` component inside TravelChat.jsx file:

```jsx
function ChatFeedback({ destination }) {
  const [rating, setRating] = useState(0);
  const [done, setDone] = useState(false);
  if (done) return <div style={{ fontSize: 12, color: '#00d4aa', padding: '8px 12px', background: 'rgba(0,212,170,0.08)', borderRadius: 10 }}>Thanks! ✓</div>;
  return (
    <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px 14px 14px 4px', padding: '10px 14px' }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>✨ How has our chat been so far?</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={async () => {
            setRating(n); setDone(true);
            try {
              await fetch(`${import.meta.env.VITE_API_URL}/feedback`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: n, destination, source: 'chat' }),
              });
            } catch { /* silent */ }
          }} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', opacity: n <= rating ? 1 : 0.4 }}>
            ⭐
          </button>
        ))}
      </div>
    </div>
  );
}
```

Add `useState` to TravelChat imports if not already present.

- [ ] **Step 4: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 5: Commit and push**

```bash
git add frontend/src/pages/Confirmation.jsx frontend/src/components/TravelChat.jsx backend/functions/form-handler/index.js && git commit -m "feat: feedback collection — stars on Confirmation page + in-chat prompt + POST /feedback endpoint" && git push origin main
```

---

## Task 7: Step tracking for funnel analytics

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`
- Modify: `frontend/src/utils/analytics.js`

- [ ] **Step 1: Add stepReached to analytics.js**

Open `frontend/src/utils/analytics.js`. Add a new export:

```js
export const analytics = {
  // ... existing methods ...
  stepReached: (stepName, stepIndex) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'step_reached', {
        event_category: 'PlanTrip',
        step_name: stepName,
        step_index: stepIndex,
      });
    }
  },
};
```

- [ ] **Step 2: Fire stepReached in PlanTrip.jsx next() function**

Find the `next` function in `frontend/src/pages/PlanTrip.jsx`:

```js
  const next = () => {
    if (!validate()) return;
    const nextStep = step + 1;
    goToStep(nextStep);
    if (nextStep === 5) loadPreview(form);
  };
```

Replace with:

```js
  const next = () => {
    if (!validate()) return;
    const nextStep = step + 1;
    goToStep(nextStep);
    analytics.stepReached(STEPS[nextStep], nextStep);
    if (nextStep === 5) loadPreview(form);
  };
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 4: Commit and push**

```bash
git add frontend/src/pages/PlanTrip.jsx frontend/src/utils/analytics.js && git commit -m "feat: fire analytics.stepReached on each plan step for funnel tracking" && git push origin main
```

---

## Done

7 tasks. After completing all:

1. **Make yourself superadmin** by running the SQL in Task 1 Step 3
2. **Access admin portal** at `/admin` — sign in with your account
3. **Test feedback** by submitting a test trip and rating it on the confirmation page
4. **Verify chat feedback** by starting a TravelChat conversation until it triggers `readyToPlan`
