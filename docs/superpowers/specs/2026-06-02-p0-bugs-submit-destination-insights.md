# P0 Bug Fixes: Submit 500 + destination-insights no response

**Date:** 2026-06-02
**Status:** Approved, ready for implementation
**Priority:** P0 — users cannot submit itineraries or see venue suggestions

---

## Root Causes

### Bug 1: Submit 500 (POST /submit)

The `form-handler` Lambda inserts 6 columns that don't exist in the live DB:
`language`, `user_age`, `user_location`, `start_time`, `user_must_dos`, `selected_venues`.

These were added to the Lambda code but the schema migration was never run. Every submission fails with a Postgres "column does not exist" error which surfaces as a 500.

### Bug 2: destination-insights returns nothing (GET /destination-insights)

The `destination-insights` Lambda tries to read from a `destination_insights_cache` table that doesn't exist in the DB schema. This throws a Postgres error on every request. There is also no Foursquare integration — the handler currently only has Claude, but even that is unreachable because the DB error fires first.

---

## Fix 1: DB Schema Migration

**File:** `infra/schema.sql`

Append at the end of the file:

```sql
-- ─── Submissions: missing columns added post-launch ───────────────────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS language     VARCHAR(50) DEFAULT 'English';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_age     INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_location VARCHAR(255);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS start_time   VARCHAR(10) DEFAULT '09:00';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_must_dos TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS selected_venues JSONB DEFAULT '{}';

-- ─── Destination insights cache ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS destination_insights_cache (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  destination  VARCHAR(255) NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  travel_styles JSONB DEFAULT '[]',
  insights     JSONB NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(destination, start_date, end_date)
);
CREATE INDEX IF NOT EXISTS idx_insights_cache_dest    ON destination_insights_cache(destination);
CREATE INDEX IF NOT EXISTS idx_insights_cache_expires ON destination_insights_cache(expires_at);
```

Note: UNIQUE on `(destination, start_date, end_date)` only — JSONB cannot be part of a unique index. Travel styles are stored but not part of the cache key; different style selections for the same destination + dates share a cache entry.

**Run migration:** `npm run db:migrate` (from repo root)

---

## Fix 2: destination-insights handler — Foursquare primary + Claude fallback

**File:** `backend/functions/destination-insights/handler.js`

### Full rewritten handler:

```javascript
import { Anthropic } from '@anthropic-ai/sdk';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const FOURSQUARE_ENABLED = process.env.FOURSQUARE_ENABLED !== 'false';
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

const CATEGORY_EMOJI = {
  'Restaurant': '🍽️', 'Cafe': '☕', 'Bar': '🍸', 'Park': '🌳', 'Garden': '🌿',
  'Museum': '🏛️', 'Temple': '⛩️', 'Beach': '🏖️', 'Market': '🏪', 'Hiking': '🥾',
  'Hotel': '🏨', 'Spa': '🧘', 'Shopping': '🛍️', 'Viewpoint': '⛰️', 'Nature': '🌿',
  'default': '📍',
};

function getCategoryEmoji(categoryName) {
  if (!categoryName) return '📍';
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (categoryName.toLowerCase().includes(key.toLowerCase())) return emoji;
  }
  return '📍';
}

export async function handler(event) {
  console.log('Destination Insights request:', JSON.stringify(event.queryStringParameters));

  const q = event.queryStringParameters || {};
  const destination = q.destination;
  const startDate = q.startDate;
  const endDate = q.endDate;
  const travelStyles = q.travelStyles ? q.travelStyles.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (!destination || !startDate || !endDate) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing required fields: destination, startDate, endDate' }),
    };
  }

  // ── 1. Cache check ──────────────────────────────────────────────────────────
  try {
    const cached = await getFromCache(destination, startDate, endDate);
    if (cached) {
      console.log(`Cache hit for ${destination}`);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ insights: cached, cached: true }) };
    }
  } catch (cacheErr) {
    console.warn('Cache read failed (non-fatal):', cacheErr.message);
  }

  // ── 2. Foursquare primary (if enabled) ──────────────────────────────────────
  let insights = null;

  if (FOURSQUARE_ENABLED && FOURSQUARE_API_KEY) {
    try {
      insights = await getFromFoursquare(destination, travelStyles);
      if (insights) console.log(`Foursquare data fetched for ${destination}: ${insights.thingsToDo.length} venues`);
    } catch (fsqErr) {
      console.warn('Foursquare fetch failed (falling back to Claude):', fsqErr.message);
    }
  }

  // ── 3. Claude fallback ──────────────────────────────────────────────────────
  if (!insights) {
    try {
      insights = await generateFromClaude(destination, travelStyles, startDate, endDate);
      console.log(`Claude insights generated for ${destination}`);
    } catch (claudeErr) {
      console.error('Claude generation failed:', claudeErr.message);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Failed to generate insights' }),
      };
    }
  }

  // ── 4. Save to cache (non-fatal) ────────────────────────────────────────────
  try {
    await saveToCache(destination, startDate, endDate, travelStyles, insights);
  } catch (saveErr) {
    console.warn('Cache save failed (non-fatal):', saveErr.message);
  }

  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ insights, cached: false }) };
}

// ── Cache helpers ────────────────────────────────────────────────────────────

async function getFromCache(destination, startDate, endDate) {
  const result = await pool.query(
    `SELECT insights FROM destination_insights_cache
     WHERE destination = $1 AND start_date = $2 AND end_date = $3 AND expires_at > NOW()
     LIMIT 1`,
    [destination, startDate, endDate]
  );
  return result.rows.length > 0 ? result.rows[0].insights : null;
}

async function saveToCache(destination, startDate, endDate, travelStyles, insights) {
  await pool.query(
    `INSERT INTO destination_insights_cache
       (destination, start_date, end_date, travel_styles, insights, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')
     ON CONFLICT (destination, start_date, end_date) DO UPDATE SET
       insights = $5, travel_styles = $4, expires_at = NOW() + INTERVAL '30 days'`,
    [destination, startDate, endDate, JSON.stringify(travelStyles), JSON.stringify(insights)]
  );
}

// ── Foursquare data fetch ────────────────────────────────────────────────────

async function getFromFoursquare(destination, travelStyles) {
  const queries = travelStyles.length > 0 ? travelStyles.slice(0, 3) : ['attractions', 'restaurants'];
  const allVenues = [];

  for (const style of queries) {
    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('query', style);
    url.searchParams.set('near', destination);
    url.searchParams.set('limit', '6');
    url.searchParams.set('sort', 'RATING');
    url.searchParams.set('fields', 'name,categories,rating,distance,hours,tips,location');

    const res = await fetch(url.toString(), {
      headers: { 'Authorization': FOURSQUARE_API_KEY, 'Accept': 'application/json' },
    });

    if (!res.ok) {
      console.warn(`Foursquare ${style} query returned ${res.status}`);
      continue;
    }

    const data = await res.json();
    const venues = (data.results || []).map(v => ({
      name: v.name,
      category: v.categories?.[0]?.name || style,
      reason: `A top-rated ${style.toLowerCase()} spot in ${destination}`,
      emoji: getCategoryEmoji(v.categories?.[0]?.name),
      openingHours: v.hours?.display || 'Check locally for hours',
      distanceFromCenter: v.distance != null ? `${(v.distance / 1000).toFixed(1)}km from centre` : 'In the area',
      bestTime: 'Morning or early evening for fewer crowds',
      visitorTip: v.tips?.[0]?.text || `Rated ${v.rating ? v.rating.toFixed(1) : 'highly'} — worth the visit`,
      unsplashKeyword: `${v.name.toLowerCase().split(' ').slice(0, 2).join(' ')} ${destination.toLowerCase()}`,
      foursquareId: v.fsq_id,
    }));

    allVenues.push(...venues);
  }

  if (allVenues.length === 0) return null;

  return {
    thingsToDo: allVenues.slice(0, 8),
    weather: 'Check local forecast for your travel dates',
    crowdLevel: 'Moderate',
    seasonalHighlights: `Curated top spots in ${destination} for ${travelStyles.join(', ') || 'all interests'}`,
    travelTip: `Book popular venues in ${destination} ahead of time to avoid queues`,
    bestMonths: [],
    whyThisMonth: '',
  };
}

// ── Claude generation (fallback) ─────────────────────────────────────────────

async function generateFromClaude(destination, travelStyles, startDate, endDate) {
  const stylesText = travelStyles.length > 0 ? travelStyles.join(', ') : 'general travel';

  const prompt = `You are a travel expert. Generate destination insights as a JSON object.
Destination: ${destination}
Travel styles: ${stylesText}
Dates: ${startDate} to ${endDate}

Return this exact JSON structure (no markdown, no code blocks):
{
  "bestMonths": ["month1", "month2"],
  "whyThisMonth": "Brief explanation",
  "thingsToDo": [
    {
      "name": "Specific real place name",
      "category": "Category",
      "reason": "One sentence why this matches the travel style",
      "emoji": "🏛️",
      "openingHours": "Daily 9am–6pm",
      "distanceFromCenter": "2km from city centre",
      "bestTime": "Early morning to avoid crowds",
      "visitorTip": "One specific insider tip",
      "unsplashKeyword": "2-3 word photo search term"
    }
  ],
  "seasonalHighlights": "What makes this season special",
  "weather": "Expected weather conditions",
  "crowdLevel": "Peak/High/Moderate/Low",
  "travelTip": "One specific actionable tip"
}

Return 5–7 thingsToDo. Use real place names and real details.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse Claude response as JSON');
  return JSON.parse(match[0]);
}
```

---

## Fix 3: FOURSQUARE_ENABLED env var in SAM template

**File:** `infra/template.yaml`

### Add parameter (in the Parameters block):

```yaml
  FoursquareEnabled:
    Type: String
    Default: 'true'
    AllowedValues: ['true', 'false']
    Description: Set to false to disable Foursquare and use Claude-only for venue enrichment
```

### Add to Globals Environment Variables:

```yaml
        FOURSQUARE_ENABLED: !Ref FoursquareEnabled
```

### Remove redundant CLAUDE_API_KEY override in DestinationInsightsFunction:

The `DestinationInsightsFunction` currently has its own `Environment.Variables` block with `CLAUDE_API_KEY` — this is redundant since it's in Globals. Remove it to keep the function config clean (Globals already provides all needed env vars).

---

## Deploy steps

After applying code changes:

1. Run DB migration: `npm run db:migrate`
2. Deploy Lambda: `npm run deploy` (SAM build + deploy)
3. Verify: `curl "https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/destination-insights?destination=Bali&travelStyles=Nature&startDate=2025-06-28&endDate=2025-07-03"` should return a 200 with insights
4. Verify: Submit a test trip via the form — should no longer 500

---

## Out of scope

- Foursquare venue photo URLs (separate enhancement)
- Google Maps links in venue cards (separate enhancement)
- Step 6 redesign, accommodation/flights (separate sub-projects)
