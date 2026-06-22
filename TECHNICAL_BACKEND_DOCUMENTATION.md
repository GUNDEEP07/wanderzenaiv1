# WanderZenAI - Comprehensive Backend Technical Documentation

**Last Updated:** June 22, 2026  
**Version:** 1.0.0  
**Status:** Production Live

---

## TABLE OF CONTENTS

1. [API Endpoints](#1-api-endpoints-complete-mapping)
2. [AI Models & Use Cases](#2-ai-models--use-cases)
3. [Database Schema & Relationships](#3-database-schema--relationships)
4. [Database Call Flow](#4-database-call-flow---when--why)
5. [External API Integrations](#5-external-api-integrations)
6. [Lambda Function Details](#6-lambda-function-details)
7. [Request/Response Flows](#7-requestresponse-flows)
8. [Error Handling & Fallbacks](#8-error-handling--fallbacks)

---

## 1. API ENDPOINTS - COMPLETE MAPPING

### 1.1 FormHandler Lambda - Core Planning Endpoints

#### **POST /preview**
**Purpose:** Generate lightweight 5-7 day themes without database writes  
**Auth:** None required  
**Request Body:**
```json
{
  "destinations": [{"name": "Paris", "country": "France", "lat": 48.86, "lng": 2.35}],
  "days": 5,
  "budget": "2000",
  "currency": "USD",
  "travelerType": "Couple",
  "travelStyle": ["Cultural", "Foodie"],
  "interests": "museums, wine tasting, cafes",
  "travelDate": "2026-07-15",
  "travelDateEnd": "2026-07-20",
  "language": "English",
  "travelPace": "relaxed"
}
```

**Response (200):**
```json
{
  "success": true,
  "days": [
    {
      "day": 1,
      "theme": "Arrival & Latin Quarter Exploration",
      "vibe": "Leisurely introduction to Parisian culture"
    },
    {
      "day": 2,
      "theme": "Museum & Café Culture",
      "vibe": "Slow morning at cafés, afternoon in galleries"
    }
  ]
}
```

**Response (400 - Validation Error):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "budget": "Budget must be a positive number",
    "interests": "Interests required (min 5 characters)"
  }
}
```

**Database Calls:** NONE (read-only, no state)  
**Claude API Call:** 1 call to Haiku (~1-4 tokens)  
**Response Time:** 2-4 seconds  
**Cost:** ~$0.0003 per request

---

#### **POST /submit**
**Purpose:** Full form submission triggering async itinerary generation  
**Auth:** None required  
**Request Body:** Same as `/preview` + email field

**Response (200):**
```json
{
  "success": true,
  "data": {
    "submissionId": "wz_1719056400000_a7f9k2",
    "message": "Itinerary generation started",
    "estimatedTime": "2-3 minutes"
  }
}
```

**Database Calls:**
```sql
-- 1. INSERT into submissions table
INSERT INTO submissions (
  id, email, destination, days, budget, currency,
  traveler_type, travel_style, interests, travel_date,
  travel_date_end, travel_pace, language, status, created_at
) VALUES (
  'wz_1719056400000_a7f9k2', 'user@example.com', 'Paris', 5, 2000, 'USD',
  'Couple', '["Cultural","Foodie"]', 'museums, wine tasting, cafes',
  '2026-07-15', '2026-07-20', 'relaxed', 'English', 'pending', NOW()
)
ON CONFLICT DO NOTHING;

-- 2. SELECT to verify insert
SELECT id FROM submissions WHERE id = 'wz_1719056400000_a7f9k2';

-- 3. ASYNC: Invoke ItineraryGen Lambda
```

**Async Operations:**
- Calls `ItineraryGen` Lambda with full form data
- Sets Lambda `InvocationType: 'Event'` (non-blocking)
- User sees confirmation page immediately

**Response Time:** 1-2 seconds (form validation only)  
**Payment Check:** If free tier, checks `submissions.created_at` for current month count

---

#### **POST /feedback**
**Purpose:** Collect user feedback on generated itineraries  
**Auth:** None required  
**Request Body:**
```json
{
  "submissionId": "wz_1719056400000_a7f9k2",
  "email": "user@example.com",
  "rating": 4,
  "comment": "Great itinerary, but wish there were more restaurant recommendations",
  "destination": "Paris"
}
```

**Database Calls:**
```sql
INSERT INTO feedback (
  id, submission_id, email, rating, comment, destination, created_at
) VALUES (
  'fb_' || gen_random_uuid(), 'wz_1719056400000_a7f9k2', 'user@example.com',
  4, 'Great itinerary...', 'Paris', NOW()
);
```

**Response (200):**
```json
{
  "success": true,
  "message": "Thank you for your feedback!"
}
```

---

### 1.2 Recommendations Lambda - Discovery & Venues

#### **GET /recommendations/autocomplete?query=par**
**Purpose:** City autocomplete for destination search  
**Cache:** `autocomplete_cache` table (24-hour TTL)  
**Query Params:**
- `query` (required) — User input string (min 2 chars)

**Response (200):**
```json
{
  "suggestions": [
    {
      "fsq_id": "4b8c3f02f964a520fa0e32e3",
      "name": "Paris",
      "country": "France",
      "lat": 48.8566,
      "lng": 2.3522
    },
    {
      "fsq_id": "4b8c3f02f964a520fa0e32e4",
      "name": "Parma",
      "country": "Italy",
      "lat": 44.8019,
      "lng": 10.3281
    }
  ]
}
```

**Database Calls:**
```sql
-- 1. CHECK cache
SELECT suggestions FROM autocomplete_cache 
WHERE query = 'par' AND created_at > NOW() - INTERVAL '24 hours'
LIMIT 1;

-- 2. IF NOT in cache:
  -- Foursquare API call to get cities
  -- INSERT into autocomplete_cache for future use
  INSERT INTO autocomplete_cache (query, suggestions, created_at)
  VALUES ('par', '[...]', NOW())
  ON CONFLICT (query) DO UPDATE SET 
    suggestions = EXCLUDED.suggestions,
    created_at = NOW();
```

**Fallback:** If Foursquare fails, returns hardcoded `FALLBACK_DESTINATIONS` (20+ slow-travel cities)

---

#### **GET /recommendations/venues?destination=Paris&category=restaurant&limit=10**
**Purpose:** Search venues by category near destination  
**Query Params:**
- `destination` (required) — City name
- `category` (required) — Venue type (restaurant, park, temple, etc.)
- `limit` (optional, default 10)

**Response (200):**
```json
{
  "venues": [
    {
      "fsqPlaceId": "4b8c3f02f964a520fa0e32e3",
      "name": "L'Ami Jean",
      "category": "French Restaurant",
      "address": "27 Rue de la Clef, Paris",
      "phone": "+33 1 43 54 86 83",
      "website": "https://lamijean.fr",
      "socialMedia": {
        "instagram": "@lamijeanparis",
        "facebook": "lamijean"
      }
    }
  ]
}
```

**Database Calls:**
```sql
-- 1. CHECK recommendations_cache
SELECT * FROM recommendations_cache 
WHERE destination = 'Paris' AND category = 'restaurant'
AND expires_at > NOW();

-- 2. IF cache miss:
  -- Foursquare API: POST /places/search
  -- INSERT into recommendations_cache for 7 days
```

**Foursquare API Call Details:**
- **Endpoint:** `https://places-api.foursquare.com/places/search`
- **Method:** POST
- **Auth:** Bearer token + X-Places-Api-Version header
- **Payload:**
  ```json
  {
    "query": "restaurant",
    "near": "Paris, France",
    "limit": 10
  }
  ```
- **Fields Returned:** name, location, categories, tel, website, social_media
- **Cost:** Free tier (100 req/day)

---

#### **GET /recommendations/categories**
**Purpose:** Get list of available venue categories  
**Cache:** `foursquare_categories` table (permanent, seeded on init)

**Response (200):**
```json
{
  "categories": [
    {"id": "restaurant", "label": "Restaurant", "emoji": "🍽️"},
    {"id": "cafe", "label": "Café", "emoji": "☕"},
    {"id": "park", "label": "Park", "emoji": "🌳"},
    {"id": "museum", "label": "Museum", "emoji": "🏛️"}
  ]
}
```

**Database Calls:**
```sql
SELECT id, name as label FROM foursquare_categories
ORDER BY name;
```

---

#### **POST /recommendations/chat**
**Purpose:** Travel planning chatbot  
**Auth:** Optional Firebase auth (user_id used for session context)  
**Request Body:**
```json
{
  "message": "What should I do in Paris for 3 days?",
  "destination": "Paris",
  "sessionId": "chat_session_123",
  "userId": "firebase_uid_or_anonymous"
}
```

**Response (200):**
```json
{
  "response": "For a 3-day Paris trip, I recommend focusing on these themes...",
  "suggestedActivities": [
    {"activity": "Louvre Museum", "duration": "4 hours", "cost": "€17"},
    {"activity": "Seine River Walk", "duration": "2 hours", "cost": "€0"}
  ]
}
```

**Database Calls:**
```sql
-- 1. CREATE or UPDATE chat_session
INSERT INTO chat_sessions (id, user_id, destination, messages_count, created_at)
VALUES ('chat_session_123', 'firebase_uid', 'Paris', 1, NOW())
ON CONFLICT (id) DO UPDATE SET
  messages_count = messages_count + 1,
  updated_at = NOW();

-- 2. INSERT chat message
INSERT INTO chat_messages (session_id, role, message, created_at)
VALUES ('chat_session_123', 'user', 'What should I do...', NOW());

-- 3. INSERT Claude response
INSERT INTO chat_messages (session_id, role, message, created_at)
VALUES ('chat_session_123', 'assistant', 'For a 3-day Paris trip...', NOW());
```

**Claude API Call:**
- **Model:** claude-haiku-4-5-20251001
- **Max Tokens:** 1000
- **System Prompt:** "You are a travel planning expert specializing in slow travel..."
- **Cost:** ~$0.0008 per message

---

### 1.3 Destination Insights Lambda

#### **GET /destination-insights?destination=Paris&startDate=2026-07-15&endDate=2026-07-20&travelStyles=Cultural,Foodie**
**Purpose:** Fetch destination brief with climate, culture, budget, activities  
**Query Params:**
- `destination` (required)
- `startDate` (required)
- `endDate` (required)
- `travelStyles` (optional, comma-separated)

**Response (200):**
```json
{
  "destination": "Paris",
  "bestAreas": ["Le Marais", "Latin Quarter", "Montmartre"],
  "weather": {
    "temperature": "22°C",
    "conditions": "Mostly sunny",
    "bestActivities": ["Outdoor cafés", "Seine walks", "Park picnics"]
  },
  "budget": {
    "low": 50,
    "high": 150,
    "currency": "EUR",
    "estimatedTotal": 250
  },
  "culture": {
    "localLanguage": "French",
    "mainCuisine": "French bistro",
    "festivals": ["Paris Jazz Festival (July)"]
  },
  "tips": [
    "Use public transport (Metro is efficient)",
    "Book museums online to skip queues",
    "Visit markets early morning for best selection"
  ]
}
```

**Database Calls:**
```sql
-- 1. CHECK destination_insights_cache
SELECT insights FROM destination_insights_cache
WHERE destination = 'Paris' 
  AND start_date <= '2026-07-15'
  AND end_date >= '2026-07-20'
  AND expires_at > NOW()
LIMIT 1;

-- 2. IF cache miss:
  -- Foursquare API: GET nearby venues by category
  -- Claude API: Generate insights from venue data + travel style
  -- INSERT into destination_insights_cache (7-day TTL)
  INSERT INTO destination_insights_cache (
    destination, start_date, end_date, travel_styles_key,
    insights, expires_at
  ) VALUES (
    'Paris', '2026-07-15', '2026-07-20', 'Cultural_Foodie',
    '{"bestAreas": [...]}', NOW() + INTERVAL '7 days'
  );
```

**Cache Key Logic:**
```
travel_styles_key = SORT(travelStyles).JOIN('_')
// Example: ['Cultural', 'Foodie'] → 'Cultural_Foodie'
```

**Fallback:** If Foursquare disabled, Claude generates insights from training data

---

### 1.4 Profile Lambda - User Data

#### **GET /profile**
**Purpose:** Fetch user profile + itinerary history  
**Auth:** Required (Firebase JWT in Authorization header)  
**Request Header:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (200):**
```json
{
  "user": {
    "id": "firebase_uid_123",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "subscriber",
    "role": "user",
    "preferences": {
      "language": "English",
      "currency": "USD"
    }
  },
  "pastTrips": [
    {
      "submissionId": "wz_1719056400000_a7f9k2",
      "destination": "Paris",
      "days": 5,
      "createdAt": "2026-06-20T10:30:00Z",
      "pdfUrl": "https://s3.amazonaws.com/wanderzenai-pdfs/wz_1719056400000_a7f9k2.pdf?X-Amz-Signature=...",
      "pdfExpiresAt": "2026-06-27T10:30:00Z"
    }
  ],
  "itinerariesRemaining": 2
}
```

**Database Calls:**
```sql
-- 1. GET user profile (using Firebase UID from JWT)
SELECT id, email, name, plan, language, currency, itineraries_remaining
FROM users
WHERE firebase_uid = 'firebase_uid_123';

-- 2. GET past itineraries (last 10)
SELECT submissions.id as submission_id, submissions.destination,
       submissions.days, submissions.created_at,
       itineraries.pdf_s3_key
FROM submissions
LEFT JOIN itineraries ON submissions.id = itineraries.submission_id
WHERE submissions.email = 'user@example.com'
ORDER BY submissions.created_at DESC
LIMIT 10;

-- 3. FOR each PDF: Generate signed S3 URL (7-day expiry)
```

**S3 Signed URL Generation:**
```javascript
const signedUrl = s3.getSignedUrl('getObject', {
  Bucket: 'wanderzenai-pdfs-prod',
  Key: 'wz_1719056400000_a7f9k2.pdf',
  Expires: 7 * 24 * 60 * 60  // 7 days in seconds
});
```

---

#### **PUT /profile**
**Purpose:** Update user preferences  
**Auth:** Required  
**Request Body:**
```json
{
  "name": "Jane Doe",
  "language": "French",
  "currency": "EUR",
  "preferences": {
    "emailNotifications": true
  }
}
```

**Database Calls:**
```sql
UPDATE users
SET name = 'Jane Doe',
    language = 'French',
    currency = 'EUR',
    updated_at = NOW()
WHERE firebase_uid = 'firebase_uid_123';
```

---

### 1.5 Stripe Webhook Lambda

#### **POST /webhook/stripe**
**Purpose:** Handle Stripe payment events  
**Auth:** Stripe signature verification (X-Stripe-Signature header)  
**Event Types Handled:**
- `checkout.session.completed` — User purchased Single Plan ($7)
- `customer.subscription.created` — User subscribed to Wanderer ($9/month)
- `customer.subscription.updated` — Plan change or renewal
- `customer.subscription.deleted` — Subscription cancelled

**Processing Example (checkout.session.completed):**

**Request Header:**
```
X-Stripe-Signature: t=1714000000,v1=abcd1234...
```

**Request Body:**
```json
{
  "id": "evt_1234567890",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_123",
      "customer": "cus_test_456",
      "client_reference_id": "user@example.com",
      "amount_total": 700,
      "currency": "usd"
    }
  }
}
```

**Database Calls:**
```sql
-- 1. Parse Stripe event (verify signature first)

-- 2. UPDATE user plan
UPDATE users
SET plan = 'paid_once',  -- or 'subscriber' for subscription
    stripe_customer_id = 'cus_test_456',
    stripe_subscription_id = 'sub_test_789',  -- if subscription
    itineraries_remaining = 5,  -- for paid_once
    updated_at = NOW()
WHERE email = 'user@example.com';

-- 3. INSERT into audit log
INSERT INTO stripe_audit_log (event_id, event_type, user_id, created_at)
VALUES ('evt_1234567890', 'checkout.session.completed', ..., NOW());
```

**Response (200):**
```json
{
  "received": true
}
```

---

## 2. AI MODELS & USE CASES

### 2.1 Claude Haiku - Primary Model

**Model ID:** `claude-haiku-4-5-20251001`  
**Context Window:** 200K tokens  
**Cost:** $0.80 per 1M input tokens, $4.00 per 1M output tokens

#### **Use Case 1: /preview Endpoint (Lightweight Theme Generation)**
**Purpose:** Generate 5-7 day themes without heavy computation  
**Prompt Structure:**
```
System: "You are a travel itinerary expert..."

User: "Create a {days}-day slow travel day outline for {destination} focusing on {travelStyles}.
Return ONLY valid JSON array of day themes."

Example return:
[
  {"day": 1, "theme": "Arrival & Area Exploration", "vibe": "Leisurely"},
  {"day": 2, "theme": "Cultural Deep Dive", "vibe": "Educational"}
]
```

**Token Usage:**
- Input: ~200-300 tokens (prompt + destination/style details)
- Output: ~100-150 tokens (7-8 day themes)
- **Total: ~300-450 tokens per request**
- **Cost: ~$0.0003 per request**

**Response Time:** 2-4 seconds  
**Used In:** Step 0 preview (form-handler Lambda)

---

#### **Use Case 2: Full Itinerary Generation (2-Phase)**

**Phase 1: Metadata Generation (1 Claude call)**
**Purpose:** Generate overview, accommodation recommendations, budget, tips

**Prompt:**
```
System: "You are a slow travel expert. User details: {userPrefs}
Destination: {destination}
Dates: {travelDate} to {travelDateEnd} ({days} days)

Foursquare venue enrichment (if available):
{venueList}

Generate travel metadata for a {days}-day {travelStyle} trip."

User: "Generate ONLY valid JSON:
{
  title: 'string',
  summary: 'string',
  accommodation: {type: 'string', description: 'string'},
  practicaltips: ['string'],
  totalCost: number,
  avoidList: ['string']
}"
```

**Token Usage:**
- Input: ~400-600 tokens (prompt + venue list if enriched)
- Output: ~200-300 tokens (metadata)
- **Total: ~600-900 tokens**
- **Cost: ~$0.0006-0.0009 per call**

**Database Writes:** None (stored later)

---

**Phase 2: Days Batch Generation (3 calls for 9-day trip)**
**Purpose:** Generate detailed day-by-day itinerary in 3-day batches

**Prompt Example (Days 1-3):**
```
System: "Generate realistic, slow-travel itineraries for {destination}.
User is {travelerType}, {travelPace} pace.
Foursquare venues (real places):
{venueData}"

User: "Generate Day 1-3 itinerary for {destination}, {travelDate} to {travelDate+2}.
ONLY return valid JSON:
[
  {
    dayNumber: 1,
    theme: 'string',
    morningActivity: {time: '09:00', activity: '...', venue: '...'},
    afternoonActivity: {...},
    eveningActivity: {...},
    hiddenGem: 'string',
    dailyCost: number
  }
]"
```

**Token Usage per Batch:**
- Input: ~300-400 tokens (3 days of context)
- Output: ~400-500 tokens (3 detailed days)
- **Total per call: ~700-900 tokens**
- **Total for 9 days: 2,100-2,700 tokens (3 calls)**
- **Cost: ~$0.002-0.003 per 9-day itinerary**

**Database Writes:**
```sql
INSERT INTO itineraries (id, submission_id, itinerary_data, ...)
VALUES ('itin_123', 'wz_1719056400000_a7f9k2', '{...JSON...}', ...);

UPDATE submissions SET status = 'itinerary_ready' WHERE id = '...';
```

**Used In:** ItineraryGen Lambda (async from form submission)

---

#### **Use Case 3: Destination Insights Generation (Fallback)**
**Purpose:** Generate destination brief if Foursquare API disabled or fails

**Prompt:**
```
System: "You are a travel expert. Generate destination insights."

User: "For {destination}, visited {travelDate} to {travelDateEnd}
with interests in {travelStyles}, generate:
{
  bestAreas: ['string'],
  weather: {...},
  budget: {...},
  culture: {...}
}"
```

**Token Usage:**
- Input: ~150-200 tokens
- Output: ~300-400 tokens
- **Total: ~450-600 tokens**
- **Cost: ~$0.0004-0.0006**

**Cache Duration:** 7 days in `destination_insights_cache` table  
**Used In:** DestinationInsights Lambda

---

#### **Use Case 4: Travel Chatbot Responses**
**Purpose:** Answer user travel planning questions

**Prompt:**
```
System: "You are a slow travel planning assistant for {destination}."

User: "What should I do in Paris for 3 days?"

Response: "For Paris, I recommend..."
```

**Token Usage:**
- Input: ~100-300 tokens (conversation history + new question)
- Output: ~200-500 tokens (detailed answer)
- **Total: ~300-800 tokens per message**
- **Cost: ~$0.0003-0.0008 per message**

**Used In:** Recommendations Lambda `/recommendations/chat` endpoint  
**Database Tracking:** Stored in `chat_messages` table for context

---

### 2.2 Claude Sonnet - Fallback Model

**Model ID:** `claude-sonnet-4-6`  
**Context Window:** 200K tokens  
**Cost:** $3.00 per 1M input tokens, $15.00 per 1M output tokens  
**Used When:** Haiku response is truncated (stop_reason=max_tokens)

**Fallback Logic (ItineraryGen Lambda):**
```javascript
let itinerary = await generateWithHaiku(formData);

if (itinerary.stop_reason === 'max_tokens') {
  console.warn('Haiku truncated, retrying with Sonnet...');
  itinerary = await generateWithSonnet(formData, { max_tokens: 8000 });
  trackMetric('fallback_to_sonnet', true);
}
```

**Cost Multiplier:** ~4x more expensive  
**Used In:** ItineraryGen Lambda (automatic retry on truncation)

---

## 3. DATABASE SCHEMA & RELATIONSHIPS

### 3.1 Core Tables

#### **users** — User Accounts & Subscription Status
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Auth
  firebase_uid VARCHAR UNIQUE NOT NULL,
  email VARCHAR UNIQUE NOT NULL,
  
  -- Subscription
  plan VARCHAR NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'paid_once', 'subscriber')),
  itineraries_remaining INTEGER DEFAULT 1,
  
  -- Stripe
  stripe_customer_id VARCHAR UNIQUE,
  stripe_subscription_id VARCHAR UNIQUE,
  
  -- Profile
  name VARCHAR,
  gender VARCHAR,
  age INTEGER CHECK (age > 0 AND age < 150),
  whatsapp VARCHAR,
  home_city VARCHAR,
  
  -- Preferences
  language VARCHAR DEFAULT 'English',
  currency VARCHAR DEFAULT 'USD',
  
  -- Status
  onboarding_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan ON users(plan);
```

**Relationships:**
- `users → submissions` (1 to many via email)
- `users → chat_sessions` (1 to many via firebase_uid)
- `users → feedback` (1 to many via email)

**Access Patterns:**
- `WHERE firebase_uid = 'uid'` — Auth lookup
- `WHERE email = 'email@x.com'` — Find user from email
- `WHERE plan = 'subscriber'` — Billing queries

---

#### **submissions** — Trip Planning Submissions
```sql
CREATE TABLE submissions (
  id VARCHAR PRIMARY KEY,  -- Format: wz_${timestamp}_${random}
  
  -- User
  email VARCHAR NOT NULL,
  user_id UUID REFERENCES users(id),
  
  -- Trip Details
  destination VARCHAR NOT NULL,
  days INTEGER NOT NULL CHECK (days >= 2 AND days <= 30),
  budget DECIMAL(10,2) NOT NULL CHECK (budget > 0),
  currency VARCHAR NOT NULL DEFAULT 'USD',
  travel_date DATE NOT NULL,
  travel_date_end DATE NOT NULL,
  
  -- Preferences
  traveler_type VARCHAR,  -- Solo, Couple, Family, Group
  travel_style JSONB,  -- ["Cultural", "Foodie", ...]
  interests TEXT,  -- Comma-separated or free-form
  travel_pace VARCHAR CHECK (travel_pace IN ('relaxed', 'balanced', 'packed')),
  
  -- Generation
  language VARCHAR DEFAULT 'English',
  start_time VARCHAR DEFAULT '09:00',
  
  -- Budget Scope (NEW)
  budget_scope VARCHAR DEFAULT 'full-trip' 
    CHECK (budget_scope IN ('full-trip', 'activities-only')),
  
  -- Optional User Info
  user_age INTEGER,
  user_location VARCHAR,
  user_must_dos TEXT,
  
  -- Venues (from Step 3)
  selected_venues JSONB,  -- {"activities": {...}, "venues": {...}}
  day_assignments JSONB,  -- {"day": [...], ...}
  
  -- Status
  status VARCHAR NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'itinerary_ready', 
                      'pdf_ready', 'email_sent', 'failed')),
  itinerary_id VARCHAR REFERENCES itineraries(id),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent_at TIMESTAMPTZ
);

CREATE INDEX idx_submissions_email ON submissions(email);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);
CREATE INDEX idx_submissions_user_id ON submissions(user_id);
```

**Relationships:**
- `submissions → itineraries` (1 to 1 via id)
- `submissions → feedback` (1 to many via id)
- `submissions → email_log` (1 to many via id)

**Access Patterns:**
- `WHERE email = 'x@y.com' ORDER BY created_at DESC` — User history
- `WHERE status = 'pending'` — Processing queue
- `WHERE DATE(created_at) = CURRENT_DATE AND email = 'x'` — Daily limit check

---

#### **itineraries** — Generated Itineraries (Full JSON)
```sql
CREATE TABLE itineraries (
  id VARCHAR PRIMARY KEY,  -- Format: itin_${timestamp}_${random}
  
  -- Reference
  submission_id VARCHAR NOT NULL REFERENCES submissions(id),
  email VARCHAR NOT NULL,
  
  -- Content
  destination VARCHAR NOT NULL,
  itinerary_data JSONB NOT NULL,  -- Full structured itinerary
  
  -- Metadata
  total_cost DECIMAL(10,2),
  currency VARCHAR,
  days INTEGER,
  
  -- S3 Storage
  pdf_s3_key VARCHAR,  -- e.g., "itin_123/itinerary.pdf"
  pdf_generated_at TIMESTAMPTZ,
  
  -- Token Tracking
  claude_input_tokens INTEGER,
  claude_output_tokens INTEGER,
  claude_model_used VARCHAR DEFAULT 'haiku-4-5',
  fallback_to_sonnet BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_itineraries_submission_id ON itineraries(submission_id);
CREATE INDEX idx_itineraries_email ON itineraries(email);
CREATE INDEX idx_itineraries_created_at ON itineraries(created_at);
```

**JSONB Structure Example:**
```json
{
  "title": "5 Days of Parisian Charm",
  "summary": "A slow-paced exploration of Paris...",
  "accommodation": {
    "type": "Boutique Hotel",
    "description": "Mid-range hotel in Latin Quarter"
  },
  "days": [
    {
      "dayNumber": 1,
      "theme": "Arrival & Wandering",
      "morningActivity": {
        "time": "09:00",
        "activity": "Arrive at CDG, train to hotel",
        "venueName": "Gare du Nord"
      },
      "afternoonActivity": {...},
      "eveningActivity": {...},
      "hiddenGem": "Café de Flore's lesser-known back room",
      "dailyCost": 85
    }
  ],
  "totalCost": 425,
  "practicalTips": ["Use Metro...", "Book museums online..."]
}
```

**Relationships:**
- `itineraries → submissions` (1 to 1 via submission_id)
- `itineraries → email_log` (1 to many via id)

---

#### **email_log** — Email Delivery Tracking
```sql
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference
  submission_id VARCHAR REFERENCES submissions(id),
  itinerary_id VARCHAR REFERENCES itineraries(id),
  
  -- Recipient
  email VARCHAR NOT NULL,
  
  -- S3 URL (signed)
  pdf_signed_url VARCHAR,
  
  -- Expiry
  signed_url_expires_at TIMESTAMPTZ,  -- 7 days from send
  
  -- Status
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bounce_status VARCHAR,  -- null, 'permanent', 'transient'
  opened_at TIMESTAMPTZ,  -- If tracked
  
  -- Metadata
  email_provider VARCHAR DEFAULT 'SES',
  ses_message_id VARCHAR
);

CREATE INDEX idx_email_log_email ON email_log(email);
CREATE INDEX idx_email_log_submission_id ON email_log(submission_id);
```

---

### 3.2 Caching Tables

#### **destination_insights_cache**
```sql
CREATE TABLE destination_insights_cache (
  id SERIAL PRIMARY KEY,
  destination VARCHAR NOT NULL,
  start_date DATE,
  end_date DATE,
  travel_styles_key VARCHAR,  -- e.g., "Cultural_Foodie"
  
  insights JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- TTL: 7 days
  
  UNIQUE(destination, start_date, end_date, travel_styles_key)
);

CREATE INDEX idx_dest_insights_expires ON destination_insights_cache(expires_at);
```

**Query Pattern:**
```sql
SELECT insights FROM destination_insights_cache
WHERE destination = 'Paris'
  AND expires_at > NOW()
LIMIT 1;
```

---

#### **autocomplete_cache**
```sql
CREATE TABLE autocomplete_cache (
  query VARCHAR(100) PRIMARY KEY,
  suggestions JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  
  UNIQUE(query)
);

CREATE INDEX idx_autocomplete_expires ON autocomplete_cache(expires_at);
```

---

#### **recommendations_cache**
```sql
CREATE TABLE recommendations_cache (
  id SERIAL PRIMARY KEY,
  email VARCHAR,  -- NULL for anonymous
  destination VARCHAR NOT NULL,
  category VARCHAR NOT NULL,
  
  recommendations JSONB NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  
  UNIQUE NULLS NOT DISTINCT (email, destination, category)
);

CREATE INDEX idx_rec_cache_expires ON recommendations_cache(expires_at);
```

---

### 3.3 RBAC Tables

#### **roles**
```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,  -- user, admin, agency, support, superadmin
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name) VALUES ('user'), ('admin'), ('agency'), ('support'), ('superadmin');
```

---

#### **user_roles** — Role Assignments
```sql
CREATE TABLE user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  role_id INTEGER NOT NULL REFERENCES roles(id),
  
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
```

---

### 3.4 Analytical Views

#### **daily_stats** View
```sql
CREATE VIEW daily_stats AS
SELECT 
  DATE(created_at)::DATE as date,
  COUNT(*) as total_submissions,
  COUNT(CASE WHEN status = 'email_sent' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  AVG(claude_input_tokens + claude_output_tokens) as avg_tokens
FROM submissions
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

## 4. DATABASE CALL FLOW - WHEN & WHY

### 4.1 User Registration Flow

```
1. User signs up via Firebase Auth (frontend)
   └─> Firebase generates firebase_uid

2. Welcome Email Lambda triggered
   DB Call: INSERT INTO users (firebase_uid, email, plan='free', ...)
   └─> Reason: Create user record

3. GET /profile
   DB Call: SELECT * FROM users WHERE firebase_uid = '{uid}'
   └─> Reason: Populate user profile page
```

---

### 4.2 Trip Planning Flow

```
1. User submits form (Step 0-1)
   ↓
2. POST /preview (optional, real-time feedback)
   DB Calls: NONE
   Claude: 1 call (themes only)
   ↓
3. POST /submit
   DB Calls: 
     - INSERT INTO submissions (status='pending')
     - SELECT count(*) FROM submissions WHERE email='x' AND DATE(created_at)=TODAY
       └─> Reason: Check free-tier daily limit
   
   Async: Invoke ItineraryGen Lambda
   ↓
4. ItineraryGen Lambda executes
   DB Calls:
     - SELECT * FROM submissions WHERE id='{submissionId}' (get form data)
     - UPDATE submissions SET status='processing'
   
   Claude: 1 call (metadata) + 3 calls (9 days in 3-day batches)
   
   DB Call: INSERT INTO itineraries (itinerary_data JSONB, ...)
   DB Call: UPDATE submissions SET itinerary_id='{id}', status='itinerary_ready'
   
   Async: Invoke PDFBuilder Lambda
   ↓
5. PDFBuilder Lambda executes
   DB Calls:
     - SELECT itinerary_data FROM itineraries WHERE id='{id}'
       └─> Reason: Fetch HTML content
   
   S3: Upload PDF to wanderzenai-pdfs/{submissionId}.pdf
   
   DB Call: UPDATE itineraries SET pdf_s3_key='{key}', pdf_generated_at=NOW()
   DB Call: UPDATE submissions SET status='pdf_ready'
   
   Async: Invoke EmailSender Lambda
   ↓
6. EmailSender Lambda executes
   DB Calls:
     - SELECT * FROM itineraries WHERE id='{id}'
     - S3: Generate signed URL (7-day expiry)
     - INSERT INTO email_log (email, signed_url, expires_at, ...)
   
   SES: Send email
   
   DB Call: UPDATE submissions SET status='email_sent', email_sent_at=NOW()
```

---

### 4.3 Dashboard Access Flow

```
1. User navigates to Dashboard
   ↓
2. GET /profile (requires Firebase auth)
   DB Calls:
     - SELECT * FROM users WHERE firebase_uid='{uid}'
     - SELECT * FROM submissions WHERE email='{email}' ORDER BY created_at DESC LIMIT 10
     - FOR each submission: 
         SELECT pdf_s3_key FROM itineraries WHERE submission_id='{id}'
         └─> Generate signed URL for download
   ↓
3. User clicks "View Itinerary"
   ↓
4. GET /itinerary/{id}
   DB Call: SELECT itinerary_data FROM itineraries WHERE id='{id}'
   ↓
5. Render itinerary (HTML from JSONB)
```

---

### 4.4 Destination Discovery Flow

```
1. User opens ExplorePage
   ↓
2. GET /recommendations/categories
   DB Call: SELECT * FROM foursquare_categories
   └─> Reason: Show category pills
   ↓
3. User searches for destination
   ↓
4. GET /recommendations/autocomplete?query='par'
   DB Calls:
     - SELECT * FROM autocomplete_cache WHERE query='par' AND expires_at > NOW()
     - IF cache miss:
         Foursquare API: Search cities named 'par*'
         INSERT INTO autocomplete_cache (query, suggestions, ...)
   ↓
5. User selects destination + category
   ↓
6. GET /recommendations/venues?destination=Paris&category=restaurant
   DB Calls:
     - SELECT * FROM recommendations_cache 
       WHERE destination='Paris' AND category='restaurant' AND expires_at > NOW()
     - IF cache miss:
         Foursquare API: Search restaurants in Paris
         INSERT INTO recommendations_cache (...)
   ↓
7. Render venues on map
```

---

### 4.5 Chat Interaction Flow

```
1. User opens chat widget on Dashboard
   ↓
2. POST /recommendations/chat { message: "...", sessionId: "..." }
   DB Calls:
     - INSERT INTO chat_sessions (user_id, destination, ...) ON CONFLICT UPDATE
     - INSERT INTO chat_messages (session_id, role='user', message)
   
   Claude: 1 call (travel advice)
   
   DB Call: INSERT INTO chat_messages (session_id, role='assistant', response)
   ↓
3. Response displayed to user
```

---

## 5. EXTERNAL API INTEGRATIONS

### 5.1 Claude (Anthropic) API

**Endpoint:** `https://api.anthropic.com/v1/messages`  
**Auth Method:** Bearer token in Authorization header  
**Request Format:** JSON POST

**Integration Point:** All Lambda functions generating content

**Example Call (Haiku):**
```javascript
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': process.env.CLAUDE_API_KEY,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: 'Generate day themes for Paris...'
    }]
  })
});

const data = await response.json();
return data.content[0].text;
```

**Error Handling:**
- `429 Too Many Requests` → Retry with exponential backoff
- `503 Service Unavailable` → Use cached response or fallback
- `Invalid API Key` → Log security alert, fail with clear error

---

### 5.2 Foursquare Places API v3

**Endpoint:** `https://places-api.foursquare.com/places/search`  
**Auth:** Bearer token + X-Places-Api-Version header  
**Rate Limit:** 100 requests/day (free tier)

**Example Call:**
```javascript
const response = await fetch('https://places-api.foursquare.com/places/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.FOURSQUARE_API_KEY}`,
    'X-Places-Api-Version': '20231201'
  },
  body: JSON.stringify({
    query: 'restaurant',
    near: 'Paris, France',
    limit: 10
  })
})
```

**Fallback Strategy:**
- If API disabled (FOURSQUARE_ENABLED=false) → Use Claude for venue suggestions
- If rate limit hit → Use cached data or empty array
- If network timeout → Return cached data with warning

---

### 5.3 Firebase Authentication

**SDK:** `firebase/auth`  
**Integration:** Frontend only (React Context)

**Flow:**
```javascript
// Frontend
const auth = initializeAuth();
const user = await signInWithGoogle();  // or email/password
const idToken = await user.getIdToken();

// Backend
const decodedToken = await admin.auth().verifyIdToken(idToken);
const uid = decodedToken.uid;
```

---

### 5.4 Stripe Payment API

**Endpoint:** `https://api.stripe.com/v1`  
**Auth:** Secret key in Authorization header  
**Webhook URL:** `/webhook/stripe` (Lambda)

**Integration Points:**
1. Frontend: Load Stripe checkout session
2. Backend: Webhook listener for payment events
3. Database: Update user plan on success

---

### 5.5 AWS SES (Simple Email Service)

**Service:** AWS SES  
**From Address:** `travel@wanderzenai.com` (verified)  
**Integration:** EmailSender Lambda

**Example Call:**
```javascript
const ses = new SESClient();
const params = {
  Source: 'travel@wanderzenai.com',
  Destination: { ToAddresses: ['user@example.com'] },
  Message: {
    Subject: { Data: 'Your WanderZenAI Itinerary' },
    Body: { Html: { Data: htmlTemplate } }
  }
};

await ses.send(new SendEmailCommand(params));
```

---

## 6. LAMBDA FUNCTION DETAILS

### 6.1 FormHandler Lambda - Entry Point

**File:** `backend/functions/form-handler/index.js`  
**Timeout:** 60 seconds  
**Memory:** 512 MB  
**Endpoints:** POST /preview, POST /submit, POST /feedback

**Execution Flow:**
```javascript
exports.handler = async (event) => {
  // 1. Parse request
  const body = JSON.parse(event.body);
  const path = event.requestContext.resourcePath;
  
  // 2. CORS headers
  const responseHeaders = corsHeaders();
  
  // 3. Route
  if (path === '/preview') {
    return handlePreview(body);
  } else if (path === '/submit') {
    return handleSubmit(body);
  } else if (path === '/feedback') {
    return handleFeedback(body);
  }
};
```

**Key Functions:**
- `validateFormInput(body)` — Validate all required fields
- `generateSubmissionId()` — Format: `wz_${Date.now()}_${randomString}`
- `checkFreeTierLimit(email)` — Count submissions this month for free users
- `invokeItineraryGen(submission)` — Lambda invoke with `InvocationType: Event`

---

### 6.2 ItineraryGen Lambda - AI Generation

**File:** `backend/functions/itinerary-gen/index.js`  
**Timeout:** 300 seconds (5 minutes)  
**Memory:** 1 GB  
**Async from:** FormHandler

**Execution Flow:**
```javascript
exports.handler = async (event) => {
  const submission = JSON.parse(event.body);
  
  // 1. Fetch enrichment data (optional Foursquare)
  const venueEnrichment = await fetchFoursquareTips(submission.destination);
  
  // 2. Phase 1: Generate metadata
  const metadata = await generateMetadata(submission, venueEnrichment);
  
  // 3. Phase 2: Generate days in batches
  const days = [];
  for (let i = 0; i < submission.days; i += 3) {
    const daysBatch = await generateDaysBatch(submission, venueEnrichment, i, i+3);
    days.push(...daysBatch);
  }
  
  // 4. Assemble full itinerary
  const itinerary = { ...metadata, days };
  
  // 5. Store in RDS
  await db.query('INSERT INTO itineraries (...)', [itinerary]);
  
  // 6. Invoke PDFBuilder (async)
  await lambda.invoke({ FunctionName: 'pdf-builder', InvocationType: 'Event' });
};
```

---

## 7. REQUEST/RESPONSE FLOWS

### 7.1 Full Trip Planning Flow (User Perspective)

```
┌─────────────────────────────────────────────────────┐
│ User navigates to /plan                              │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Step 0: Destination & Preferences                    │
│ - Select destination (autocomplete → /autocomplete) │
│ - Set duration, budget, interests                    │
│ - Select budget scope (full trip / activities only) │
│                                                      │
│ [Optional] Click Preview                             │
│   → POST /preview                                    │
│   → Claude generates 5-7 day themes (instant)       │
│   → Display in real-time                            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Step 1: Travel Dates                                 │
│ - Pick start date                                    │
│ - Pick end date                                      │
│                                                      │
│ [If budget_scope='activities-only']                 │
│   → SKIP Step 2, GO TO Step 3                       │
└─────────────────────────────────────────────────────┘
                      ↓
         (Step 2 skipped if activities-only)
                      ↓
┌─────────────────────────────────────────────────────┐
│ Step 2: Trip Overview (if full trip)                │
│ - Display flight price ranges                        │
│ - Show cheapest dates recommendations               │
│ - Display hotel price estimates                      │
│ - Show budget health indicator                       │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Step 3: Choose Your Experiences                      │
│ - Browse activities by category                      │
│ - See venue listings (Foursquare)                    │
│ - Assign venues to specific days                     │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Step 4: Review Your Trip                             │
│ - Summary of all selections                          │
│ - Edit option for any field                          │
│ - Enter email address                                │
│ - [Submit]                                           │
│                                                      │
│ POST /submit                                        │
│   → DB: INSERT submissions (status='pending')       │
│   → Async: Invoke ItineraryGen                      │
│   → User sees confirmation page immediately         │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ Background Processing (Async)                        │
│                                                      │
│ ItineraryGen Lambda:                                │
│   → Claude: Generate metadata (1 call)              │
│   → Claude: Generate days (3 calls for 9 days)      │
│   → DB: INSERT itineraries (JSONB)                  │
│   → Invoke PDFBuilder (async)                       │
│                                                      │
│ PDFBuilder Lambda:                                  │
│   → Puppeteer: Render itinerary to HTML             │
│   → Puppeteer: Convert HTML to PDF                  │
│   → S3: Upload PDF                                  │
│   → DB: UPDATE itineraries (pdf_s3_key)             │
│   → Invoke EmailSender (async)                      │
│                                                      │
│ EmailSender Lambda:                                 │
│   → S3: Generate signed URL (7-day expiry)          │
│   → SES: Send email with download link              │
│   → DB: UPDATE submissions (status='email_sent')    │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ User receives email with PDF download link          │
│ → PDF available for 7 days via signed URL           │
│ → User can access on Dashboard via GET /profile     │
└─────────────────────────────────────────────────────┘
```

---

## 8. ERROR HANDLING & FALLBACKS

### 8.1 Claude API Errors

**Error Type:** max_tokens  
**Response:** `{stop_reason: 'max_tokens', ...}`  
**Handling:**
```javascript
if (response.stop_reason === 'max_tokens') {
  console.warn('Haiku truncated, retrying with Sonnet...');
  const fallbackResponse = await callClaude('sonnet-4-6', {
    ...params,
    max_tokens: 8000
  });
  trackMetric('fallback_to_sonnet', true);
}
```

**Error Type:** 429 Too Many Requests  
**Handling:** Exponential backoff (1s → 2s → 4s → 8s)

**Error Type:** Invalid API Key  
**Handling:** Log security alert, return 500 error

---

### 8.2 Foursquare API Errors

**Error Type:** Rate limit exceeded  
**Handling:** Use cached data or return empty array

**Error Type:** Network timeout  
**Handling:** Return fallback DESTINATIONS list or cached data

**Error Type:** Disabled (FOURSQUARE_ENABLED=false)  
**Handling:** Skip venue enrichment, let Claude generate descriptions

---

### 8.3 Database Errors

**Error Type:** Connection pool exhausted  
**Handling:** Queue request, retry with backoff

**Error Type:** Unique constraint violation  
**Handling:** Log and continue (idempotent operations)

**Error Type:** Transaction rollback  
**Handling:** Retry entire Lambda invocation

---

### 8.4 S3/PDF Errors

**Error Type:** Upload timeout  
**Handling:** Retry 3x with exponential backoff, then log error

**Error Type:** Permission denied  
**Handling:** Log security alert, verify IAM role

---

## Summary Table: Database Calls by Lambda

| Lambda | Endpoint | DB Calls | Purpose |
|--------|----------|----------|---------|
| FormHandler | /preview | 0 | Theme generation only |
| FormHandler | /submit | 2 | Submission insert + limit check |
| ItineraryGen | Async | 4 | Fetch, update status, insert itinerary, update submission |
| PDFBuilder | Async | 2 | Fetch itinerary, update S3 key |
| EmailSender | Async | 3 | Fetch itinerary, insert log, update submission |
| Recommendations | /chat | 3 | Session create/update, message insert (2×) |
| DestinationInsights | / | 1-3 | Cache check, fallback query, cache insert |
| Profile | GET | 2 | User fetch, submission history |
| Profile | PUT | 1 | Profile update |
| StripeWebhook | POST | 1-2 | User plan update + audit log |

---

**End of Technical Backend Documentation**

*This document covers the complete backend stack, all database calls, API integrations, and error handling paths. For frontend documentation, see TECHNICAL_FRONTEND_DOCUMENTATION.md (to be created).*
