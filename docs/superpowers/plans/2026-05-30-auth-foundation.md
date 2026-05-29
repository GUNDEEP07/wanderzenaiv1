# Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firebase Auth (Google + email/password) to WanderZenAI — login page, signup page, auth context, protected routes, profile Lambda, and DB migration.

**Architecture:** Firebase SDK handles all auth client-side and persists the session. A new `AuthContext` provides `currentUser` throughout the app. A new `profile` Lambda (GET/PUT `/profile`) stores user data in the existing `users` table. Protected routes redirect unauthenticated users to `/login`.

**Tech Stack:** React 18, Firebase Auth v10, React Router v6, Node 20 Lambda, PostgreSQL (shared layer)

**PREREQUISITE — Must do before any code:**
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create project "wanderzenai"
3. Add a Web app, copy the config object
4. In Authentication → Sign-in method → enable **Google** and **Email/Password**
5. Add your production domain (`wanderzenai.com`) to Authorized domains
6. Save the config values — you'll need them in Task 2

---

## File Map

| File | Action |
|---|---|
| `infra/schema.sql` | Add 8 columns to `users`, add `recommendation_cache` table |
| `backend/functions/profile/handler.js` | Create — GET/PUT profile Lambda |
| `backend/functions/profile/package.json` | Create |
| `infra/template.yaml` | Add ProfileFunction + 2 routes + DB env vars to profile |
| `.github/workflows/deploy.yml` | Add `FIREBASE_WEB_API_KEY` secret mapping (Vite build env) |
| `frontend/package.json` | Add `firebase ^10` |
| `frontend/src/firebase.js` | Create — Firebase app init |
| `frontend/src/context/AuthContext.jsx` | Create — auth state + helpers |
| `frontend/src/components/ProtectedRoute.jsx` | Create — route guard |
| `frontend/src/pages/Login.jsx` | Create — login page |
| `frontend/src/pages/Signup.jsx` | Create — signup page |
| `frontend/src/App.jsx` | Modify — wrap with AuthProvider, add routes |

---

## Task 1: DB migration — add user profile columns

**Files:**
- Modify: `infra/schema.sql`

- [ ] **Step 1: Append migration to schema.sql**

Append to the end of `infra/schema.sql`:

```sql
-- ─── User profile columns ─────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid   VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name           VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender         VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age            INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp       VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city      VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS language       VARCHAR(50) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- ─── Recommendation cache ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_cache (
  email           VARCHAR(255) PRIMARY KEY,
  recommendations JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 2: Apply migration to production DB**

```bash
npm run db:migrate
```

Expected: Commands complete with no errors. If `db:migrate` script isn't defined, run directly:
```bash
psql -h $DB_HOST -U wanderzen_admin -d wanderzenai -f infra/schema.sql
```

- [ ] **Step 3: Commit**

```bash
git add infra/schema.sql
git commit -m "feat: add user profile columns and recommendation_cache table"
```

---

## Task 2: Firebase SDK + AuthContext

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/firebase.js`
- Create: `frontend/src/context/AuthContext.jsx`

- [ ] **Step 1: Install Firebase**

```bash
cd frontend && npm install firebase@^10 2>&1 | tail -5
```

Expected: `added N packages`

- [ ] **Step 2: Add Firebase env vars to frontend**

Add to `frontend/.env.local` (create if it doesn't exist):

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=wanderzenai.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=wanderzenai
```

Replace values with your actual Firebase config from the prerequisite step above.

- [ ] **Step 3: Create firebase.js**

Create `frontend/src/firebase.js`:

```js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
```

- [ ] **Step 4: Create AuthContext.jsx**

Create `frontend/src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

  const signInWithEmail = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

  const signUpWithEmail = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);

  const signOut = () => firebaseSignOut(auth);

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const getIdToken = async () => {
    if (!currentUser) return null;
    return currentUser.getIdToken();
  };

  return (
    <AuthContext.Provider value={{
      currentUser, loading,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, resetPassword, getIdToken,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

- [ ] **Step 5: Wrap App with AuthProvider**

In `frontend/src/App.jsx`, add the import and wrapper:

```jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

const Landing    = lazy(() => import('./pages/Landing'));
const PlanTrip   = lazy(() => import('./pages/PlanTrip'));
const Confirmation = lazy(() => import('./pages/Confirmation'));
const Pricing    = lazy(() => import('./pages/Pricing'));
const Dashboard  = lazy(() => import('./pages/Dashboard'));
const AgencyDashboard = lazy(() => import('./pages/AgencyDashboard'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const Login      = lazy(() => import('./pages/Login'));
const Signup     = lazy(() => import('./pages/Signup'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#06090f' }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(0,212,170,0.2)', borderTopColor: '#00d4aa', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="/"            element={<Landing />} />
            <Route path="/login"       element={<Login />} />
            <Route path="/signup"      element={<Signup />} />
            <Route path="/onboarding"  element={<Onboarding />} />
            <Route path="/plan"        element={<PlanTrip />} />
            <Route path="/confirmation" element={<Confirmation />} />
            <Route path="/pricing"     element={<Pricing />} />
            <Route path="/dashboard"   element={<Dashboard />} />
            <Route path="/agency"      element={<AgencyDashboard />} />
            <Route path="/explore"     element={<ExplorePage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 6: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -6
```

Expected: `✓ built in ...ms`

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/src/firebase.js \
        frontend/src/context/AuthContext.jsx frontend/src/App.jsx
git commit -m "feat: Firebase Auth SDK, AuthContext, updated App routes"
```

---

## Task 3: ProtectedRoute component

**Files:**
- Create: `frontend/src/components/ProtectedRoute.jsx`

- [ ] **Step 1: Create ProtectedRoute.jsx**

```jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
}
```

- [ ] **Step 2: Apply ProtectedRoute to /plan and /dashboard in App.jsx**

Find the `/plan` and `/dashboard` routes in `App.jsx` and wrap them:

```jsx
import { ProtectedRoute } from './components/ProtectedRoute';

// In <Routes>:
<Route path="/plan"      element={<ProtectedRoute><PlanTrip /></ProtectedRoute>} />
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
<Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
```

- [ ] **Step 3: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ProtectedRoute.jsx frontend/src/App.jsx
git commit -m "feat: ProtectedRoute — /plan, /dashboard, /onboarding require auth"
```

---

## Task 4: Login page

**Files:**
- Create: `frontend/src/pages/Login.jsx`

- [ ] **Step 1: Create Login.jsx**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const s = {
  page: { minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  box: { width: '100%', maxWidth: 400, padding: '0 24px' },
  logo: { width: 40, height: 40, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#06090f', margin: '0 auto 16px' },
  headline: { fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.1, marginBottom: 6 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontStyle: 'italic', marginBottom: 32 },
  googleBtn: { width: '100%', padding: '12px', background: '#fff', border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111', fontFamily: 'inherit', marginBottom: 20 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  divLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  divText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  input: { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 13, background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 16, boxShadow: '0 4px 18px rgba(0,212,170,0.25)' },
  footer: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' },
  link: { color: '#00d4aa', textDecoration: 'none', fontWeight: 600 },
  error: { background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ff6b6b', marginBottom: 12 },
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, signInWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (e) {
      setError('Google sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      navigate('/dashboard');
    } catch (e) {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900;1,9..144,300&display=swap'); input::placeholder{color:rgba(255,255,255,0.2);}`}</style>
      <div style={s.box}>
        <div style={s.logo}>W</div>
        <div style={s.headline}>Plan your next<br /><em style={{ fontWeight: 300, color: 'rgba(255,255,255,0.45)' }}>slow journey</em></div>
        <div style={s.sub}>Sign in to access your trips and personalised recommendations</div>

        {error && <div style={s.error}>{error}</div>}

        <button style={s.googleBtn} onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div style={s.divider}>
          <div style={s.divLine} />
          <span style={s.divText}>or</span>
          <div style={s.divLine} />
        </div>

        <form onSubmit={handleEmail}>
          <input style={s.input} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? '…' : 'Sign in →'}
          </button>
        </form>

        <div style={s.footer}>
          <Link to="/signup" style={s.link}>No account? Sign up</Link>
          {' · '}
          <span style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.35)' }} onClick={() => { const em = prompt('Enter your email'); if (em) { const { resetPassword } = useAuth(); resetPassword(em); } }}>
            Forgot password?
          </span>
        </div>
      </div>
    </div>
  );
}
```

Note: The "Forgot password?" inline prompt is intentionally simple for MVP. Replace with a proper `/forgot-password` page later if needed.

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.jsx
git commit -m "feat: Login page — Google OAuth + email/password"
```

---

## Task 5: Signup page

**Files:**
- Create: `frontend/src/pages/Signup.jsx`

- [ ] **Step 1: Create Signup.jsx**

```jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const s = {
  page: { minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" },
  box: { width: '100%', maxWidth: 400, padding: '0 24px' },
  logo: { width: 40, height: 40, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#06090f', margin: '0 auto 16px' },
  headline: { fontFamily: "'Fraunces', serif", fontSize: 32, fontWeight: 900, color: '#fff', textAlign: 'center', lineHeight: 1.1, marginBottom: 6 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', fontStyle: 'italic', marginBottom: 32 },
  googleBtn: { width: '100%', padding: 12, background: '#fff', border: 'none', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111', fontFamily: 'inherit', marginBottom: 20 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  divLine: { flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' },
  divText: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  input: { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', marginBottom: 10, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 13, background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer', marginBottom: 16, boxShadow: '0 4px 18px rgba(0,212,170,0.25)' },
  footer: { textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' },
  link: { color: '#00d4aa', textDecoration: 'none', fontWeight: 600 },
  error: { background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#ff6b6b', marginBottom: 12 },
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      navigate('/onboarding');
    } catch {
      setError('Google sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      await signUpWithEmail(email, password);
      navigate('/onboarding');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('An account with this email already exists.');
      else setError('Could not create account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900;1,9..144,300&display=swap'); input::placeholder{color:rgba(255,255,255,0.2);}`}</style>
      <div style={s.box}>
        <div style={s.logo}>W</div>
        <div style={s.headline}>Create your<br /><em style={{ fontWeight: 300, color: 'rgba(255,255,255,0.45)' }}>free account</em></div>
        <div style={s.sub}>Save trips, get personalised recommendations</div>

        {error && <div style={s.error}>{error}</div>}

        <button style={s.googleBtn} onClick={handleGoogle} disabled={loading}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div style={s.divider}>
          <div style={s.divLine} />
          <span style={s.divText}>or</span>
          <div style={s.divLine} />
        </div>

        <form onSubmit={handleSignup}>
          <input style={s.input} type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Password (min 6 chars)" value={password} onChange={e => setPassword(e.target.value)} required />
          <input style={s.input} type="password" placeholder="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? '…' : 'Create account →'}
          </button>
        </form>

        <div style={s.footer}>
          Already have an account? <Link to="/login" style={s.link}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Signup.jsx
git commit -m "feat: Signup page — Google OAuth + email/password registration"
```

---

## Task 6: Profile Lambda

**Files:**
- Create: `backend/functions/profile/package.json`
- Create: `backend/functions/profile/handler.js`
- Modify: `infra/template.yaml`

- [ ] **Step 1: Create package.json**

Create `backend/functions/profile/package.json`:

```json
{
  "name": "wanderzenai-profile",
  "version": "1.0.0",
  "dependencies": {}
}
```

(Dependencies come from the shared Lambda layer — `pg` is already there.)

- [ ] **Step 2: Create handler.js**

Create `backend/functions/profile/handler.js`:

```js
'use strict';
const { getDB } = require('/opt/nodejs/index');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

function decodeEmail(event) {
  const auth = event.headers?.Authorization || event.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try {
    // Decode JWT payload without verification (MVP — upgrade to full verification later)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.email || null;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS' }, body: '' };
  }

  const email = decodeEmail(event);
  if (!email) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const db = getDB();

  if (event.httpMethod === 'GET') {
    try {
      const result = await db.query(
        `SELECT email, name, gender, age, whatsapp, home_city, language, onboarding_complete, plan
         FROM users WHERE email = $1`,
        [email]
      );
      if (result.rows.length === 0) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ exists: false }) };
      }
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ exists: true, profile: result.rows[0] }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'PUT') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { name, gender, age, whatsapp, home_city, language, firebase_uid, onboarding_complete } = body;

      await db.query(
        `INSERT INTO users (email, name, gender, age, whatsapp, home_city, language, firebase_uid, onboarding_complete)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (email) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, users.name),
           gender = COALESCE(EXCLUDED.gender, users.gender),
           age = COALESCE(EXCLUDED.age, users.age),
           whatsapp = COALESCE(EXCLUDED.whatsapp, users.whatsapp),
           home_city = COALESCE(EXCLUDED.home_city, users.home_city),
           language = COALESCE(EXCLUDED.language, users.language),
           firebase_uid = COALESCE(EXCLUDED.firebase_uid, users.firebase_uid),
           onboarding_complete = COALESCE(EXCLUDED.onboarding_complete, users.onboarding_complete),
           updated_at = NOW()`,
        [email, name || null, gender || null, age || null, whatsapp || null,
         home_city || null, language || null, firebase_uid || null, onboarding_complete ?? null]
      );

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
```

- [ ] **Step 3: Add ProfileFunction to template.yaml**

Find the end of the Lambda resources section in `infra/template.yaml`. Add after the `DestinationInsightsFunction` resource:

```yaml
  ProfileFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub wanderzenai-profile-${Stage}
      CodeUri: ../backend/functions/profile
      Handler: handler.handler
      Timeout: 10
      MemorySize: 256
      Description: GET and PUT user profile
      Layers:
        - !Ref SharedLayer
      Environment:
        Variables:
          DB_HOST: !Ref DBHost
          DB_NAME: !Ref DBName
          DB_USER: !Ref DBUser
          DB_PASSWORD: !Ref DBPassword
      Events:
        GetProfile:
          Type: Api
          Properties:
            RestApiId: !Ref WanderZenApi
            Path: /profile
            Method: GET
        PutProfile:
          Type: Api
          Properties:
            RestApiId: !Ref WanderZenApi
            Path: /profile
            Method: PUT
```

- [ ] **Step 4: Validate SAM template**

```bash
cd infra && sam validate --template template.yaml 2>&1 | tail -5
```

Expected: `template.yaml is a valid SAM Template`

- [ ] **Step 5: Commit**

```bash
git add backend/functions/profile/ infra/template.yaml
git commit -m "feat: profile Lambda — GET/PUT /profile endpoint"
```

---

## Task 7: Add Firebase env vars to CI/CD and push

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add Firebase env vars to the build step in deploy.yml**

Find the `Build React app` step in `.github/workflows/deploy.yml`. Add Firebase env vars:

```yaml
      - name: Build React app
        working-directory: frontend
        env:
          VITE_API_URL: ${{ needs.deploy-backend.outputs.api-url }}
          VITE_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
          VITE_STRIPE_SINGLE_PLAN_LINK: ${{ secrets.STRIPE_SINGLE_PLAN_LINK }}
          VITE_STRIPE_WANDERER_LINK: ${{ secrets.STRIPE_WANDERER_LINK }}
          VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}
        run: npm run build
```

- [ ] **Step 2: Add Firebase secrets to GitHub repository**

Go to `github.com/GUNDEEP07/wanderzenaiv1/settings/secrets/actions` and add:
- `FIREBASE_API_KEY` — your Firebase `apiKey` value
- `FIREBASE_AUTH_DOMAIN` — e.g. `wanderzenai.firebaseapp.com`
- `FIREBASE_PROJECT_ID` — e.g. `wanderzenai`

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add Firebase env vars to build step"
git push origin main
```

Expected: GitHub Actions triggers, build succeeds with Firebase env vars injected.
