# WanderZenAI - Frontend Technical Documentation

**Last Updated:** June 22, 2026  
**Version:** 1.0.0  
**Framework:** React 18 + Vite  
**Status:** Production Live

---

## TABLE OF CONTENTS

1. [React Component Architecture](#1-react-component-architecture)
2. [State Management Pattern](#2-state-management-pattern)
3. [API Integration Layer](#3-api-integration-layer)
4. [Multi-Step Form Flow](#4-multi-step-form-flow)
5. [Routing & Navigation](#5-routing--navigation)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [External Integrations (Frontend)](#7-external-integrations-frontend)
8. [Performance & Caching](#8-performance--caching)

---

## 1. REACT COMPONENT ARCHITECTURE

### 1.1 Component Hierarchy

```
App.jsx (Router setup)
├── ProtectedRoute.jsx (Auth guard)
│   ├── Dashboard.jsx (User itinerary history)
│   │   ├── TravelChat.jsx (Chatbot widget)
│   │   └── TripCard (Mini previews)
│   ├── PlanTrip.jsx (Multi-step form orchestrator)
│   │   ├── Step 0: Destination & Preferences
│   │   │   ├── DestinationSearch.jsx (Autocomplete)
│   │   │   └── CustomInterestModal.jsx
│   │   ├── Step 1: Travel Dates
│   │   ├── Step 2: Trip Overview
│   │   │   ├── FlightsSection.jsx
│   │   │   ├── AccommodationSection.jsx
│   │   │   └── BudgetClarificationBox.jsx
│   │   ├── Step 3: Choose Experiences (VenueSelection)
│   │   │   ├── VenueSelection.jsx (Full-page)
│   │   │   ├── ActivityTabs.jsx
│   │   │   ├── ActivityGrid.jsx
│   │   │   └── DestinationInsightsPanel.jsx
│   │   ├── Step 4: Review Your Trip
│   │   │   └── StepReview.jsx
│   │   └── Navigation Buttons
│   ├── ItineraryView.jsx (Shareable itinerary)
│   ├── Settings.jsx
│   ├── Feedback.jsx
│   └── AdminDashboard.jsx (Role-gated)
├── Landing.jsx (Homepage)
├── Login.jsx / Signup.jsx (Auth)
├── Onboarding.jsx
├── ExplorePage.jsx (Discovery)
├── Pricing.jsx (Plans & CTA)
├── RoleGate.jsx (Admin/Agency gate)
├── CookieBanner.jsx (GDPR)
└── ErrorBoundary.jsx (Error catching)
```

---

### 1.2 Key Components Deep Dive

#### **PlanTrip.jsx — Multi-Step Form Orchestrator**

**Props:** None (uses internal state + route params)  
**State Variables:**
```javascript
const [step, setStep] = useState(0);  // 0-4 steps
const [form, setForm] = useState(INITIAL_FORM);
const [errors, setErrors] = useState({});
const [preview, setPreview] = useState(null);
const [previewLoading, setPreviewLoading] = useState(false);
const [destinationInsights, setDestinationInsights] = useState(null);
const [submitting, setSubmitting] = useState(false);
const [submitError, setSubmitError] = useState('');

// Budget Scope (NEW)
// form.budgetScope: 'full-trip' | 'activities-only'
// form.alreadyBooked: boolean
```

**Key Functions:**
- `validate()` — Per-step validation logic
- `next()` — Advance to next step (skip Step 2 if alreadyBooked=true)
- `back()` — Go back (handle skip logic)
- `goToStep(n)` — Jump to specific step
- `loadPreview(formData)` — Fetch /preview endpoint
- `handleSubmit()` — POST /submit + navigate to confirmation

**Effect Hooks:**
```javascript
// Persist form to sessionStorage
useEffect(() => {
  sessionStorage.setItem('wz_plan_form', JSON.stringify(form));
}, [form]);

// Fetch destination insights when step 2 entered
useEffect(() => {
  if (step !== 2) return;
  fetchDestinationInsights(form.destinations[0], form.travelStyle, ...);
}, [step, form.destinations, form.travelDate, form.travelDateEnd]);

// Auto-detect currency from IP
useEffect(() => {
  getUserLocationFromIP().then(loc => {
    const detected = getCurrencyForCountry(loc.countryCode);
    if (SUPPORTED.includes(detected)) {
      setForm(f => ({ ...f, currency: detected }));
    }
  });
}, []);
```

---

#### **DestinationSearch.jsx — Autocomplete Component**

**Props:**
```javascript
{
  onSelect: (destination) => void,
  disabled: boolean,
  allowMultiple: boolean,
  initialSelected: destination[]
}
```

**API Calls:**
```javascript
const fetchCitySuggestions = async (cityName) => {
  const res = await fetch(`${API_URL}/recommendations/autocomplete?query=${encodeURIComponent(cityName)}`);
  const data = await res.json();
  // Returns: { suggestions: [{fsq_id, name, country, lat, lng}, ...] }
};
```

**State:**
```javascript
const [suggestions, setSuggestions] = useState([]);
const [showSuggestions, setShowSuggestions] = useState(false);
```

---

#### **VenueSelection.jsx — Full-Page Activity Selector**

**Props:**
```javascript
{
  destinations: destination[],
  travelStyles: string[],
  startDate: string,
  endDate: string,
  days: number,
  onSubmit: (venueData) => void,
  onSkip: () => void,
  onBack: () => void,
  savedState: {...},
  onSave: (state) => void,
  preferredActivities: string[],
  currency: string,
  budget: number
}
```

**Features:**
- 3 activity tabs (Preset, Custom, Favorites)
- YouTube video carousel per activity
- Foursquare venue listings (real data)
- Day-by-day venue assignment
- Save state to parent component

**API Calls:**
```javascript
// Foursquare venues (browser fallback, legacy)
const fetchVenuesForActivity = async (activity, destination) => {
  // Note: Backend handles Foursquare; frontend has fallback
  const venues = await fetch(`${API_URL}/recommendations/venues?...`);
};

// YouTube videos
const fetchTrendingVideos = async (activity, destination, countryCode) => {
  // Returns: [{videoId, title, thumbnail}, ...]
};
```

---

#### **TravelChat.jsx — Chatbot Widget**

**Props:**
```javascript
{
  destination: string,
  userId: string,  // Firebase UID
  onClose: () => void
}
```

**State:**
```javascript
const [messages, setMessages] = useState([]);
const [input, setInput] = useState('');
const [loading, setLoading] = useState(false);
const [sessionId, setSessionId] = useState(null);
```

**API Call:**
```javascript
const sendMessage = async () => {
  const res = await fetch(`${API_URL}/recommendations/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message: input,
      destination,
      sessionId,
      userId
    })
  });
  // Returns: { response: '...', suggestedActivities: [...] }
};
```

**Features:**
- Persistent chat session per destination
- Suggestion pills below input
- Auto-scroll to latest message
- Loading state during response

---

### 1.3 Styling Pattern

**s-object Pattern** (inline styles)
```javascript
const s = {
  page: { minHeight: '100vh', background: '#0a0f1e', ... },
  card: { background: '#111827', border: '1px solid rgba(...)' },
  input: { padding: '0.875rem 1rem', background: 'rgba(...)' },
  button: { background: 'linear-gradient(135deg,#00d4aa,#00a87e)' },
  // ...
};

// Usage in JSX
<div style={s.page}>
  <div style={s.card}>
    <input style={s.input} />
    <button style={s.button}>Submit</button>
  </div>
</div>
```

**Per-Page CSS Files:**
- `PlanTrip.css` — Multi-step form styles
- `Dashboard.css` — Trip card grid
- `Landing.css` — Hero section

---

## 2. STATE MANAGEMENT PATTERN

### 2.1 Form State (PlanTrip.jsx)

**Central State:**
```javascript
const [form, setForm] = useState({
  // Step 0
  destinations: [],
  days: 5,
  budget: '',
  currency: 'USD',
  travelerType: '',
  travelStyle: [],
  interests: '',
  travelPace: 'balanced',
  language: 'English',
  budgetScope: 'full-trip',  // NEW
  alreadyBooked: false,  // NEW
  
  // Step 1
  travelDate: '',
  travelDateEnd: '',
  startTime: '09:00',
  
  // Step 3 (from VenueSelection)
  selected_venues: {},
  day_assignments: {},
  
  // Step 4
  email: '',
  userAge: '',
  userLocation: '',
  userMustDos: ''
});
```

**Setter Pattern:**
```javascript
const set = (key, val) => {
  setForm(f => ({ ...f, [key]: val }));
  setErrors(e => ({ ...e, [key]: '' }));  // Clear error on change
};

// Usage
<input onChange={(e) => set('budget', e.target.value)} />
```

**Persistence:**
```javascript
useEffect(() => {
  try {
    sessionStorage.setItem('wz_plan_form', JSON.stringify(form));
  } catch { /* ignore */ }
}, [form]);

// On mount: restore from sessionStorage
const [form, setForm] = useState(() => {
  const saved = sessionStorage.getItem('wz_plan_form');
  return saved ? JSON.parse(saved) : INITIAL_FORM;
});
```

---

### 2.2 Preview State (Separate from Form)

**Why separate?** Prevents stale-state bugs when user edits form while preview loads.

```javascript
const [preview, setPreview] = useState(null);
const [previewLoading, setPreviewLoading] = useState(false);

// Load preview (doesn't update form state)
const loadPreview = async (formData) => {
  setPreviewLoading(true);
  try {
    const { days } = await fetchPreview(formData);
    setPreview(days);  // Separate from form
  } finally {
    setPreviewLoading(false);
  }
};
```

---

## 3. API INTEGRATION LAYER

### 3.1 Frontend API Service (`src/api/itinerary.js`)

**File Structure:**
```javascript
const API_URL = import.meta.env.VITE_API_URL;

export async function fetchPreview(formData) {
  const res = await fetch(`${API_URL}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  return res.json();
}

export async function submitItinerary(formData) {
  const res = await fetch(`${API_URL}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData)
  });
  if (!res.ok) {
    const err = await res.json();
    return { status: res.status, error: err };
  }
  return { status: 200, data: await res.json() };
}
```

**Error Handling:**
```javascript
try {
  const result = await submitItinerary(form);
  if (result.status === 402) {
    // Free tier limit reached
    navigate('/pricing', { state: { reason: 'free_limit' } });
    return;
  }
  if (!result.data.success) throw new Error(result.data.message);
  // Success
} catch (e) {
  setSubmitError(e.message || 'Submission failed');
}
```

---

### 3.2 DestinationInsights Service

**File:** `src/api/destinationInsights.js`

```javascript
export async function fetchDestinationInsights(destination, travelStyles, startDate, endDate) {
  const params = new URLSearchParams({
    destination,
    startDate,
    endDate,
    travelStyles: travelStyles.join(',')
  });
  
  const res = await fetch(`${API_URL}/destination-insights?${params}`);
  if (!res.ok) return null;
  return res.json();
}
```

---

## 4. MULTI-STEP FORM FLOW

### 4.1 Step Progression Logic

**Current Step Validation:**
```javascript
const validate = () => {
  const errs = {};
  
  if (step === 0) {
    if (form.destinations.length === 0) errs.destination = 'Select destination';
    if (form.days < 2 || form.days > 30) errs.days = 'Duration must be 2-30 days';
    if (!form.budgetScope) errs.budgetScope = 'Tell us what your budget covers';
    // ... more validations
  }
  
  if (step === 1) {
    const dateVal = validateDateRange(form.travelDate, form.travelDateEnd);
    if (!dateVal.valid) errs.travelDate = dateVal.errors[0];
  }
  
  setErrors(errs);
  return Object.keys(errs).length === 0;
};
```

**Next Button Logic:**
```javascript
const next = () => {
  if (!validate()) return;
  
  let nextStep = step + 1;
  
  // If alreadyBooked, skip Step 2 (Trip Overview)
  if (step === 1 && form.alreadyBooked) {
    nextStep = 3;  // Jump to Step 3 (Activities)
  }
  
  goToStep(nextStep);
  analytics.stepReached(STEPS[nextStep], nextStep);
  
  if (nextStep === 4) loadPreview(form);  // Auto-preview on step 4
};
```

**Back Button Logic:**
```javascript
const back = () => {
  if (step === 3 && form.alreadyBooked) {
    goToStep(1);  // Skip back over Step 2
  } else {
    goToStep(step - 1);
  }
};
```

---

### 4.2 Step 0: Destination & Preferences

**Features:**
- Destination search w/ autocomplete
- Days spinner (2-30)
- Budget input
- Currency selector (auto-detected)
- Travel style pills (toggle)
- Custom interests textarea
- Travel pace selector (pills)
- Language dropdown
- **Budget scope selector** (NEW)

**Form Fields Set:**
```javascript
{
  destinations, days, budget, currency,
  travelerType, travelStyle, interests,
  travelPace, language, budgetScope
}
```

---

### 4.3 Step 1: Travel Dates

**Features:**
- Start date picker (HTML date input)
- End date picker
- Auto-calculates trip duration
- Validates: future dates, min 2 days, max 30 days
- Optional: Departure time selector

**Form Fields Set:**
```javascript
{
  travelDate, travelDateEnd, startTime
}
```

**Decision Point:**
- If `budgetScope === 'activities-only'` → Skip Step 2

---

### 4.4 Step 2: Trip Overview

**Components:**
- FlightsSection — Price ranges + cheapest dates
- AccommodationSection — Hotel options + costs
- BudgetClarificationBox — Breakdown visualization

**Data Flow:**
```javascript
useEffect(() => {
  if (step !== 2) return;
  // Fetch destination insights when entering step 2
  fetchDestinationInsights(
    form.destinations[0].name,
    form.travelStyle,
    form.travelDate,
    form.travelDateEnd
  ).then(setDestinationInsights);
}, [step, form.destinations, form.travelDate, form.travelDateEnd]);
```

---

### 4.5 Step 3: VenueSelection (Full-Page)

**Layout:**
```
┌──────────────────────────────────────────┐
│ [W] WanderZenAI                    [✕]  │  Header
├──────────────────────────────────────────┤
│ Progress bar                              │
│ "Step 4 of 5 — Choose your experiences" │
├──────────────────────────────────────────┤
│                                           │
│ [Activity Tabs] [Custom] [Favorites]     │
│                                           │
│ ┌─ Activity Grid / Venue List ───────┐  │
│ │                                    │  │
│ │ [Venue Card] [Venue Card] ...       │  │
│ │                                    │  │
│ └────────────────────────────────────┘  │
│                                           │
│ [← Back]                    [Submit →]  │
│                                           │
└──────────────────────────────────────────┘
```

**State Persistence:**
```javascript
const [selectedActivities, setSelectedActivities] = useState(
  () => savedState?.activities || {}
);
const [selectedVenues, setSelectedVenues] = useState(
  () => savedState?.venues ? new Set(...) : {}
);
const [dayAssignments, setDayAssignments] = useState(
  () => savedState?.dayAssignments || {}
);

// Parent saves on unmount
const handleVenueSelect = (venueData) => {
  setForm(f => ({
    ...f,
    selected_venues: venueData.venues,
    day_assignments: venueData.dayAssignments
  }));
  goToStep(4);  // Move to review step
};
```

---

### 4.6 Step 4: Review Your Trip

**Component:** `StepReview.jsx`

**Features:**
- Summary card (all selections)
- Email input
- "Generate My Itinerary" button

**On Submit:**
```javascript
const handleSubmit = async () => {
  setSubmitting(true);
  try {
    const result = await submitItinerary(form);
    if (result.status === 402) {
      // Free tier limit
      navigate('/pricing', { state: { reason: 'free_limit' } });
      return;
    }
    if (!result.data.success) throw new Error(result.data.message);
    
    // Clear session storage
    sessionStorage.removeItem('wz_plan_step');
    sessionStorage.removeItem('wz_plan_form');
    
    // Navigate to confirmation
    navigate('/confirmation', {
      state: {
        submissionId: result.data.data.submissionId,
        destination: form.destinations[0].name,
        email: form.email
      }
    });
  } catch (e) {
    setSubmitError(e.message);
  }
};
```

---

## 5. ROUTING & NAVIGATION

### 5.1 React Router Setup (`App.jsx`)

```javascript
const router = createBrowserRouter([
  {
    path: '/',
    element: <Landing />
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/signup',
    element: <Signup />
  },
  {
    path: '/plan',
    element: <ProtectedRoute><PlanTrip /></ProtectedRoute>
  },
  {
    path: '/dashboard',
    element: <ProtectedRoute><Dashboard /></ProtectedRoute>
  },
  {
    path: '/itinerary/:id',
    element: <ProtectedRoute><ItineraryView /></ProtectedRoute>
  },
  {
    path: '/confirmation',
    element: <ProtectedRoute><Confirmation /></ProtectedRoute>
  },
  {
    path: '/admin',
    element: <RoleGate roles={['admin']}><AdminDashboard /></RoleGate>
  }
]);
```

---

## 6. AUTHENTICATION & AUTHORIZATION

### 6.1 Firebase Auth Context (`src/context/AuthContext.jsx`)

**State:**
```javascript
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        // Fetch user role from backend (optional)
        const role = await fetch(`/api/profile`).then(r => r.json());
        setUserRole(role.user.role);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, userRole }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Usage:**
```javascript
const { currentUser, loading } = useContext(AuthContext);

if (loading) return <Spinner />;
if (!currentUser) return <Redirect to="/login" />;
```

---

### 6.2 ProtectedRoute Component

```javascript
function ProtectedRoute({ children }) {
  const { currentUser, loading } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !currentUser) {
      navigate('/login', { replace: true });
    }
  }, [currentUser, loading]);

  if (loading) return <Spinner />;
  return currentUser ? children : null;
}
```

---

### 6.3 RoleGate Component

```javascript
function RoleGate({ children, roles }) {
  const { currentUser, userRole, loading } = useContext(AuthContext);

  if (loading) return <Spinner />;
  if (!currentUser) return <Redirect to="/login" />;
  if (!roles.includes(userRole)) return <Unauthorized />;

  return children;
}
```

---

## 7. EXTERNAL INTEGRATIONS (FRONTEND)

### 7.1 Firebase (`src/firebase.js`)

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'wanderzenai-9c343.firebaseapp.com',
  projectId: 'wanderzenai-9c343',
  storageBucket: 'wanderzenai-9c343.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

**Auth Methods:**
- `signInWithGoogle()`
- `signInWithEmailAndPassword()`
- `createUserWithEmailAndPassword()`
- `signOut()`

---

### 7.2 Stripe (`src/utils/stripe.js`)

**Load Stripe.js:**
```javascript
import { loadStripe } from '@stripe/js';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
);

export default stripePromise;
```

**Redirect to Checkout:**
```javascript
const handleCheckout = async (planLink) => {
  const stripe = await stripePromise;
  await stripe.redirectToCheckout({ sessionId });
};
```

---

### 7.3 Unsplash (`src/utils/destinationPhotos.js`)

```javascript
const UNSPLASH_API_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export async function fetchDestinationPhoto(query, type = 'hero') {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
    { headers: { 'Authorization': `Client-ID ${UNSPLASH_API_KEY}` } }
  );
  const data = await res.json();
  return data.results?.[0]?.urls?.regular || FALLBACK_IMAGE;
}
```

---

### 7.4 YouTube (`src/utils/youtube.js`)

```javascript
export function getYoutubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1`;
}

export function getYoutubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
```

---

## 8. PERFORMANCE & CACHING

### 8.1 localStorage for Preferences

```javascript
// Save currency preference
useEffect(() => {
  if (form.currency) {
    localStorage.setItem('wz_currency', form.currency);
  }
}, [form.currency]);

// Restore on mount
const [form, setForm] = useState(() => ({
  ...INITIAL_FORM,
  currency: localStorage.getItem('wz_currency') || 'USD'
}));
```

---

### 8.2 sessionStorage for Form State

```javascript
// Save entire form on change
useEffect(() => {
  sessionStorage.setItem('wz_plan_form', JSON.stringify(form));
}, [form]);

// Restore on mount (if user returns to /plan)
const [form, setForm] = useState(() => {
  const saved = sessionStorage.getItem('wz_plan_form');
  return saved ? JSON.parse(saved) : INITIAL_FORM;
});

// Clear after submission
sessionStorage.removeItem('wz_plan_form');
sessionStorage.removeItem('wz_plan_step');
```

---

### 8.3 Memoization

```javascript
// Prevent re-renders of expensive components
const MemoizedVenueCard = memo(VenueCard, (prevProps, nextProps) => {
  return (
    prevProps.venue.id === nextProps.venue.id &&
    prevProps.selected === nextProps.selected
  );
});
```

---

### 8.4 Lazy Loading

```javascript
// Code-split large pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

// Route with suspense boundary
<Route
  path="/admin"
  element={
    <Suspense fallback={<Spinner />}>
      <RoleGate roles={['admin']}>
        <AdminDashboard />
      </RoleGate>
    </Suspense>
  }
/>
```

---

## Environment Variables

**Required VITE_ Prefixed (Vite injection at build time):**

| Variable | Source | Purpose |
|----------|--------|---------|
| `VITE_API_URL` | Build step | Backend API endpoint |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe | Client-side payment key |
| `VITE_FIREBASE_API_KEY` | Firebase | Auth SDK init |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase | OAuth redirect |
| `VITE_FIREBASE_PROJECT_ID` | Firebase | Project identifier |
| `VITE_UNSPLASH_ACCESS_KEY` | Unsplash | Photo API key |

**GitHub Actions Injection:**
```yaml
env:
  VITE_API_URL: ${{ steps.backend.outputs.api_url }}
  VITE_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
  VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
  # ...
```

---

## Performance Metrics

- **Initial load:** ~2.5s (React + dependencies)
- **Route transitions:** ~300ms (lazy-loaded route)
- **Form submission:** ~1-2s (preview) + async backend processing
- **Autocomplete:** ~300ms (debounced API call)

---

**End of Frontend Technical Documentation**

*Covers React architecture, state management, API integration, routing, auth, and performance patterns. See TECHNICAL_BACKEND_DOCUMENTATION.md for backend APIs and database details.*
