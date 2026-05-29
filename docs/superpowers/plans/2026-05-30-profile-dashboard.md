# Profile, Onboarding & Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 2-screen onboarding flow, the past-trips Dashboard, and wire up profile pre-filling in PlanTrip.

**Architecture:** Onboarding calls `PUT /profile` on completion and sets `onboarding_complete = true`. Dashboard fetches past trips from `GET /profile` (which reads `submissions` by email) and renders trip cards. PlanTrip fetches profile on mount and pre-fills age, language, home city, email fields.

**Tech Stack:** React 18, React Router v6, existing `PUT/GET /profile` Lambda (Plan A)

**PREREQUISITE:** Plan A (`2026-05-30-auth-foundation.md`) must be fully deployed before starting this plan.

---

## File Map

| File | Action |
|---|---|
| `frontend/src/pages/Onboarding.jsx` | Create — 2-screen profile setup |
| `frontend/src/pages/Dashboard.jsx` | Rewrite — past trips + plan new trip CTA |
| `frontend/src/pages/PlanTrip.jsx` | Modify — fetch profile on mount, pre-fill fields |
| `backend/functions/profile/handler.js` | Modify — GET also returns past trips |

---

## Task 1: Extend profile GET to include past trips

**Files:**
- Modify: `backend/functions/profile/handler.js`

- [ ] **Step 1: Add past trips query to GET handler**

In `backend/functions/profile/handler.js`, find the GET block and extend it:

```js
  if (event.httpMethod === 'GET') {
    try {
      const userResult = await db.query(
        `SELECT email, name, gender, age, whatsapp, home_city, language, onboarding_complete, plan
         FROM users WHERE email = $1`,
        [email]
      );

      const tripsResult = await db.query(
        `SELECT s.id, s.destination, s.days, s.status, s.created_at,
                i.id AS itinerary_id
         FROM submissions s
         LEFT JOIN itineraries i ON i.submission_id = s.id
         WHERE s.email = $1
         ORDER BY s.created_at DESC
         LIMIT 20`,
        [email]
      );

      const pastTrips = tripsResult.rows.map(row => ({
        id: row.id,
        destination: row.destination,
        days: row.days,
        status: row.status,
        createdAt: row.created_at,
        hasItinerary: !!row.itinerary_id,
      }));

      if (userResult.rows.length === 0) {
        return {
          statusCode: 200, headers: CORS,
          body: JSON.stringify({ exists: false, pastTrips }),
        };
      }

      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ exists: true, profile: userResult.rows[0], pastTrips }),
      };
    } catch (err) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
  }
```

Also add a helper to get a signed S3 URL for the PDF. Add before `exports.handler`:

```js
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const PDF_BUCKET = process.env.PDF_BUCKET;

async function getPdfUrl(submissionId) {
  if (!PDF_BUCKET || !submissionId) return null;
  try {
    const cmd = new GetObjectCommand({ Bucket: PDF_BUCKET, Key: `${submissionId}.pdf` });
    return await getSignedUrl(s3, cmd, { expiresIn: 86400 }); // 24 hours
  } catch {
    return null;
  }
}
```

And update the trip mapping in GET to include pdf:

```js
      const pastTrips = await Promise.all(tripsResult.rows.map(async row => ({
        id: row.id,
        destination: row.destination,
        days: row.days,
        status: row.status,
        createdAt: row.created_at,
        hasItinerary: !!row.itinerary_id,
        pdfUrl: row.status === 'email_sent' ? await getPdfUrl(row.id) : null,
      })));
```

Also add `PDF_BUCKET` to the ProfileFunction env in `infra/template.yaml`:

```yaml
      Environment:
        Variables:
          DB_HOST: !Ref DBHost
          DB_NAME: !Ref DBName
          DB_USER: !Ref DBUser
          DB_PASSWORD: !Ref DBPassword
          PDF_BUCKET: !Sub wanderzenai-pdfs-${Stage}-${AWS::AccountId}
```

And add S3 read permission to the ProfileFunction in `infra/template.yaml`:

```yaml
      Policies:
        - S3ReadPolicy:
            BucketName: !Sub wanderzenai-pdfs-${Stage}-${AWS::AccountId}
```

- [ ] **Step 2: Install @aws-sdk packages in profile Lambda**

```bash
cd backend/functions/profile && npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner 2>&1 | tail -5
```

- [ ] **Step 3: Verify syntax**

```bash
node --check backend/functions/profile/handler.js && echo "OK"
```

Expected: `OK`

- [ ] **Step 4: Validate SAM**

```bash
cd infra && sam validate --template template.yaml 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add backend/functions/profile/ infra/template.yaml
git commit -m "feat: profile GET returns past trips with signed PDF URLs"
```

---

## Task 2: Onboarding page

**Files:**
- Create: `frontend/src/pages/Onboarding.jsx`

- [ ] **Step 1: Create Onboarding.jsx**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const CURRENCIES = ['USD ($)', 'EUR (€)', 'GBP (£)', 'INR (₹)', 'AUD (A$)', 'CAD (C$)', 'SGD (S$)', 'JPY (¥)'];
const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Arabic', 'Portuguese'];

const s = {
  page: { minHeight: '100vh', background: '#06090f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '24px' },
  box: { width: '100%', maxWidth: 420 },
  progress: { display: 'flex', gap: 4, marginBottom: 24 },
  seg: (done) => ({ flex: 1, height: 3, borderRadius: 2, background: done ? '#00d4aa' : 'rgba(255,255,255,0.1)' }),
  eyebrow: { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00d4aa', marginBottom: 6 },
  title: { fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 6 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: 28 },
  label: { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 7 },
  input: { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', marginBottom: 18, boxSizing: 'border-box' },
  select: { width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, outline: 'none', marginBottom: 18, appearance: 'none', cursor: 'pointer' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 },
  genderRow: { display: 'flex', gap: 8, marginBottom: 18 },
  genderBtn: (sel) => ({ flex: 1, padding: '10px', border: `1px solid ${sel ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`, background: sel ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.04)', color: sel ? '#00d4aa' : 'rgba(255,255,255,0.5)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: sel ? 700 : 400 }),
  btn: { width: '100%', padding: 13, background: 'linear-gradient(135deg,#00d4aa,#00a87e)', border: 'none', borderRadius: 12, color: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 18px rgba(0,212,170,0.25)', marginBottom: 12 },
  skip: { width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 },
};

export default function Onboarding() {
  const [screen, setScreen] = useState(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [currency, setCurrency] = useState('AUD (A$)');
  const [language, setLanguage] = useState('English');
  const [saving, setSaving] = useState(false);
  const { currentUser, getIdToken } = useAuth();
  const navigate = useNavigate();

  const saveProfile = async (complete) => {
    setSaving(true);
    try {
      const token = await getIdToken();
      await fetch(`${API_URL}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: name || currentUser?.displayName || '',
          age: age ? parseInt(age) : null,
          gender: gender || null,
          whatsapp: whatsapp || null,
          home_city: homeCity || null,
          language,
          firebase_uid: currentUser?.uid,
          onboarding_complete: complete,
        }),
      });
    } catch {}
    setSaving(false);
  };

  const handleNext = async () => {
    await saveProfile(false);
    setScreen(2);
  };

  const handleFinish = async () => {
    await saveProfile(true);
    navigate('/dashboard');
  };

  const handleSkip = async () => {
    await saveProfile(screen === 2);
    navigate('/dashboard');
  };

  return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900&display=swap'); input::placeholder,select option{color:rgba(255,255,255,0.2);background:#111827;} select option{color:#fff;}`}</style>
      <div style={s.box}>
        <div style={s.progress}>
          <div style={s.seg(true)} />
          <div style={s.seg(screen === 2)} />
        </div>

        {screen === 1 ? (
          <>
            <div style={s.eyebrow}>{screen} of 2 · About you</div>
            <div style={s.title}>Who are you?</div>
            <div style={s.sub}>Helps us personalise every itinerary</div>

            <label style={s.label}>Your name</label>
            <input style={s.input} placeholder={currentUser?.displayName || 'Full name'} value={name} onChange={e => setName(e.target.value)} />

            <div style={s.row}>
              <div>
                <label style={s.label}>Age</label>
                <input style={{ ...s.input, marginBottom: 0 }} type="number" min="16" max="99" placeholder="e.g. 28" value={age} onChange={e => setAge(e.target.value)} />
              </div>
            </div>

            <label style={s.label}>Gender</label>
            <div style={s.genderRow}>
              {['Male', 'Female', 'Other'].map(g => (
                <button key={g} style={s.genderBtn(gender === g)} onClick={() => setGender(g)}>{g}</button>
              ))}
            </div>

            <label style={s.label}>WhatsApp <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.2)' }}>(optional)</span></label>
            <input style={s.input} placeholder="+61 4xx xxx xxx" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />

            <button style={s.btn} onClick={handleNext} disabled={saving}>Next →</button>
            <button style={s.skip} onClick={handleSkip}>Skip for now</button>
          </>
        ) : (
          <>
            <div style={s.eyebrow}>{screen} of 2 · Your defaults</div>
            <div style={s.title}>Travel preferences</div>
            <div style={s.sub}>Pre-fills your trips so you type less</div>

            <label style={s.label}>Home city</label>
            <input style={s.input} placeholder="Sydney, Australia" value={homeCity} onChange={e => setHomeCity(e.target.value)} />

            <label style={s.label}>Preferred currency</label>
            <select style={s.select} value={currency} onChange={e => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </select>

            <label style={s.label}>Itinerary language</label>
            <select style={s.select} value={language} onChange={e => setLanguage(e.target.value)}>
              {LANGUAGES.map(l => <option key={l}>{l}</option>)}
            </select>

            <button style={s.btn} onClick={handleFinish} disabled={saving}>
              {saving ? '…' : "Let's explore →"}
            </button>
            <button style={s.skip} onClick={handleSkip}>Skip for now</button>
          </>
        )}
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
git add frontend/src/pages/Onboarding.jsx
git commit -m "feat: Onboarding — 2-screen profile setup with save to /profile"
```

---

## Task 3: Dashboard — past trips + plan new trip

**Files:**
- Rewrite: `frontend/src/pages/Dashboard.jsx`

- [ ] **Step 1: Rewrite Dashboard.jsx**

```jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL;

const s = {
  page: { minHeight: '100vh', background: '#06090f', fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#fff' },
  nav: { padding: '14px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  logo: { width: 30, height: 30, background: 'linear-gradient(135deg,#00d4aa,#00916a)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#06090f' },
  logoText: { fontSize: 14, fontWeight: 700 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#00d4aa,#00916a)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#06090f', overflow: 'hidden' },
  signOutBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
  inner: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
  greeting: { fontFamily: "'Fraunces', serif", fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 4 },
  greetingSub: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32, fontStyle: 'italic' },
  cta: { background: 'linear-gradient(135deg,rgba(0,212,170,0.15),rgba(0,168,126,0.1))', border: '1px solid rgba(0,212,170,0.3)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40, cursor: 'pointer' },
  ctaLeft: {},
  ctaTitle: { fontSize: 18, fontWeight: 800, color: '#00d4aa', marginBottom: 4 },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  ctaArrow: { fontSize: 24, color: '#00d4aa' },
  sectionLabel: { fontSize: 10, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 14 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  tripCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 18px' },
  tripDest: { fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 },
  tripMeta: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 12 },
  tripBtns: { display: 'flex', gap: 8 },
  pdfBtn: { padding: '6px 12px', background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 7, fontSize: 11, color: '#00d4aa', cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' },
  replanBtn: { padding: '6px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, fontSize: 11, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit' },
  empty: { textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  badge: (status) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
    background: status === 'email_sent' ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.06)',
    color: status === 'email_sent' ? '#00d4aa' : 'rgba(255,255,255,0.4)',
    marginBottom: 4,
  }),
};

function getInitial(user) {
  if (!user) return 'U';
  return (user.displayName || user.email || 'U')[0].toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function getCountryFlag(destination) {
  const flags = { japan: '🇯🇵', mexico: '🇲🇽', india: '🇮🇳', france: '🇫🇷', germany: '🇩🇪', thailand: '🇹🇭', indonesia: '🇮🇩', australia: '🇦🇺', italy: '🇮🇹', spain: '🇪🇸', usa: '🇺🇸', uk: '🇬🇧' };
  if (!destination) return '✦';
  const lower = destination.toLowerCase();
  for (const [key, flag] of Object.entries(flags)) {
    if (lower.includes(key)) return flag;
  }
  return '✦';
}

export default function Dashboard() {
  const { currentUser, signOut, getIdToken } = useAuth();
  const [pastTrips, setPastTrips] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [loadingTrips, setLoadingTrips] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`${API_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.profile?.name) setProfileName(data.profile.name);
        if (data.pastTrips) setPastTrips(data.pastTrips);
      } catch {}
      setLoadingTrips(false);
    })();
  }, [currentUser]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profileName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Explorer';

  return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,900;1,9..144,300&display=swap');`}</style>
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.logo}>W</div>
          <span style={s.logoText}>WanderZenAI</span>
        </div>
        <div style={s.navRight}>
          <div style={s.avatar}>
            {currentUser?.photoURL
              ? <img src={currentUser.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : getInitial(currentUser)}
          </div>
          <button style={s.signOutBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      </nav>

      <div style={s.inner}>
        <div style={s.greeting}>Hey, {displayName.split(' ')[0]} ✦</div>
        <div style={s.greetingSub}>Welcome back to your slow travel hub</div>

        {/* Plan new trip CTA */}
        <div style={s.cta} onClick={() => navigate('/plan')}>
          <div style={s.ctaLeft}>
            <div style={s.ctaTitle}>✦ Plan a new trip</div>
            <div style={s.ctaSub}>AI-powered · slow travel · no tourist traps</div>
          </div>
          <div style={s.ctaArrow}>→</div>
        </div>

        {/* Past trips */}
        <div style={s.sectionLabel}>Your trips</div>

        {loadingTrips ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading your trips…</div>
        ) : pastTrips.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌍</div>
            <div>No trips yet</div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <span style={{ color: '#00d4aa', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/plan')}>
                Plan your first trip →
              </span>
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            {pastTrips.map(trip => (
              <div key={trip.id} style={s.tripCard}>
                <div style={s.badge(trip.status)}>
                  {trip.status === 'email_sent' ? 'Completed' : 'Processing'}
                </div>
                <div style={s.tripDest}>
                  {getCountryFlag(trip.destination)} {trip.destination}
                </div>
                <div style={s.tripMeta}>
                  {trip.days} days · {formatDate(trip.createdAt)}
                </div>
                <div style={s.tripBtns}>
                  {trip.pdfUrl && (
                    <a href={trip.pdfUrl} target="_blank" rel="noreferrer" style={s.pdfBtn}>
                      📥 PDF
                    </a>
                  )}
                  <button
                    style={s.replanBtn}
                    onClick={() => navigate('/plan', { state: { prefill: { destinations: [{ name: trip.destination, lat: 0, lng: 0 }] } } })}
                  >
                    Re-plan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
git add frontend/src/pages/Dashboard.jsx
git commit -m "feat: Dashboard — past trips grid, PDF download, re-plan, plan new trip CTA"
```

---

## Task 4: PlanTrip — pre-fill from profile on mount

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

- [ ] **Step 1: Import useAuth and fetch profile on mount**

In `frontend/src/pages/PlanTrip.jsx`, add the import at the top:

```js
import { useAuth } from '../context/AuthContext';
```

Inside the `PlanTrip` component, after the existing state declarations, add:

```js
const { currentUser, getIdToken } = useAuth();

// Pre-fill form from profile on mount
useEffect(() => {
  if (!currentUser) return;
  (async () => {
    try {
      const token = await getIdToken();
      const res = await fetch(`${import.meta.env.VITE_API_URL}/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.profile) {
        const p = data.profile;
        setForm(f => ({
          ...f,
          email:        currentUser.email || f.email,
          userAge:      p.age ? String(p.age) : f.userAge,
          userLocation: p.home_city || f.userLocation,
          language:     p.language || f.language,
        }));
      }
    } catch {}
  })();
}, [currentUser]);
```

- [ ] **Step 2: Build check**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit and push**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "feat: PlanTrip pre-fills age, language, location from user profile"
git push origin main
```

Expected: GitHub Actions deploys, profile Lambda + new Dashboard live.
