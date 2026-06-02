# P0 Bug Fixes: Submit 500 + destination-insights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two P0 bugs — submissions returning 500 due to missing DB columns, and destination-insights returning nothing due to a missing DB table and no Foursquare integration.

**Architecture:** Task 1 adds missing SQL migrations (run immediately against live RDS). Task 2 rewrites the destination-insights Lambda handler to use Foursquare as primary venue source with Claude as fallback, and wraps all cache operations in try/catch so DB errors never kill the response. Task 3 adds the FOURSQUARE_ENABLED toggle to the SAM template then deploys.

**Tech Stack:** AWS SAM, Node 20, Postgres (RDS), Anthropic SDK, Foursquare Places API v3, AWS Lambda

---

## File Map

| File | Action | What changes |
|---|---|---|
| `infra/schema.sql` | Modify | Add 6 missing submissions columns + destination_insights_cache table |
| `backend/functions/destination-insights/handler.js` | Modify | Full rewrite: Foursquare primary → Claude fallback, style-keyed cache, all cache ops non-fatal |
| `infra/template.yaml` | Modify | Add FoursquareEnabled parameter + env var to Globals; remove redundant CLAUDE_API_KEY override from DestinationInsightsFunction |

**Critical order:** Task 1 (migration) → Task 2 (handler) → Task 3 (template + deploy). The migration must be applied to the live DB before the new Lambda code goes live.

---

## Task 1: DB Schema Migration

**Files:**
- Modify: `infra/schema.sql`

- [ ] **Step 1: Add missing submissions columns to schema.sql**

Open `infra/schema.sql`. At the very end of the file, append:

```sql
-- ─── Submissions: missing columns added post-launch ───────────────────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS language      VARCHAR(50)  DEFAULT 'English';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_age      INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_location VARCHAR(255);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS start_time    VARCHAR(10)  DEFAULT '09:00';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_must_dos TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS selected_venues JSONB      DEFAULT '{}';

-- ─── Destination insights cache ───────────────────────────────────────────────
-- travel_styles_key: sorted lowercased comma-joined styles, e.g. "nature,parks"
-- Unique per (destination, dates, style combination) so different interests get separate entries
CREATE TABLE IF NOT EXISTS destination_insights_cache (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  destination       VARCHAR(255) NOT NULL,
  start_date        DATE         NOT NULL,
  end_date          DATE         NOT NULL,
  travel_styles_key VARCHAR(500) NOT NULL DEFAULT 'general',
  insights          JSONB        NOT NULL,
  expires_at        TIMESTAMPTZ  NOT NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(destination, start_date, end_date, travel_styles_key)
);
CREATE INDEX IF NOT EXISTS idx_insights_cache_dest    ON destination_insights_cache(destination);
CREATE INDEX IF NOT EXISTS idx_insights_cache_expires ON destination_insights_cache(expires_at);
```

- [ ] **Step 2: Run migration against live RDS**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && npm run db:migrate
```

Expected output: Lines like `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` — no errors. If you see `ERROR: column already exists` it's fine (the `IF NOT EXISTS` / `IF NOT EXISTS` guards handle reruns safely).

- [ ] **Step 3: Verify submissions columns exist**

Connect to RDS and run:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'submissions'
ORDER BY ordinal_position;
```

Expected: rows for `language`, `user_age`, `user_location`, `start_time`, `user_must_dos`, `selected_venues` are present.

- [ ] **Step 4: Verify cache table exists**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name = 'destination_insights_cache';
```

Expected: 1 row returned.

- [ ] **Step 5: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add infra/schema.sql && git commit -m "fix: add missing submissions columns + destination_insights_cache table to schema"
```

---

## Task 2: Rewrite destination-insights handler

**Files:**
- Modify: `backend/functions/destination-insights/handler.js`

Replace the **entire file** with the following content:

- [ ] **Step 1: Replace handler.js**

Write `backend/functions/destination-insights/handler.js` with:

```javascript
import { Anthropic } from '@anthropic-ai/sdk';
import pkg from 'pg';
const { Pool } = pkg;

// ── DB + API clients ──────────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }, // RDS SSL — use CA bundle in future for full chain validation
});

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

// ── Config ────────────────────────────────────────────────────────────────────
const FOURSQUARE_ENABLED = process.env.FOURSQUARE_ENABLED !== 'false';
const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// ── Category emoji map ────────────────────────────────────────────────────────
const CATEGORY_EMOJI = {
  restaurant: '🍽️', cafe: '☕', bar: '🍸', park: '🌳', garden: '🌿',
  museum: '🏛️', temple: '⛩️', beach: '🏖️', market: '🏪', hiking: '🥾',
  hotel: '🏨', spa: '🧘', shopping: '🛍️', viewpoint: '⛰️', nature: '🌿',
  nightlife: '🎵', adventure: '🚀', wellness: '🌿', culture: '🏛️',
};

function getCategoryEmoji(categoryName) {
  if (!categoryName) return '📍';
  const lower = categoryName.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return '📍';
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function handler(event) {
  console.log('Destination Insights request:', JSON.stringify(event.queryStringParameters));

  const q = event.queryStringParameters || {};
  const destination = q.destination;
  const startDate = q.startDate;
  const endDate = q.endDate;
  const travelStyles = q.travelStyles
    ? q.travelStyles.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  if (!destination || !startDate || !endDate) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing required fields: destination, startDate, endDate' }),
    };
  }

  // Sorted lowercase key — e.g. ["Nature","Parks"] → "nature,parks"
  const stylesKey = [...travelStyles].sort().join(',').toLowerCase() || 'general';

  // ── 1. Cache check (non-fatal) ───────────────────────────────────────────────
  try {
    const cached = await getFromCache(destination, startDate, endDate, stylesKey);
    if (cached) {
      console.log(`Cache hit: ${destination} [${stylesKey}]`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ insights: cached, cached: true }),
      };
    }
  } catch (cacheErr) {
    console.warn('Cache read failed (non-fatal):', cacheErr.message);
  }

  // ── 2. Foursquare primary (if enabled and key present) ───────────────────────
  let insights = null;

  if (FOURSQUARE_ENABLED && FOURSQUARE_API_KEY) {
    try {
      insights = await getFromFoursquare(destination, travelStyles);
      if (insights) {
        console.log(`Foursquare: ${insights.thingsToDo.length} venues for ${destination} [${stylesKey}]`);
      } else {
        console.log(`Foursquare: no results for ${destination} [${stylesKey}], falling back to Claude`);
      }
    } catch (fsqErr) {
      console.warn('Foursquare failed (falling back to Claude):', fsqErr.message);
    }
  }

  // ── 3. Claude fallback ───────────────────────────────────────────────────────
  if (!insights) {
    try {
      insights = await generateFromClaude(destination, travelStyles, startDate, endDate);
      console.log(`Claude insights generated for ${destination} [${stylesKey}]`);
    } catch (claudeErr) {
      console.error('Claude generation failed:', claudeErr.message);
      return {
        statusCode: 500,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Failed to generate destination insights. Please try again.' }),
      };
    }
  }

  // ── 4. Save to cache (non-fatal) ─────────────────────────────────────────────
  try {
    await saveToCache(destination, startDate, endDate, stylesKey, insights);
  } catch (saveErr) {
    console.warn('Cache save failed (non-fatal):', saveErr.message);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ insights, cached: false }),
  };
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function getFromCache(destination, startDate, endDate, stylesKey) {
  const result = await pool.query(
    `SELECT insights FROM destination_insights_cache
     WHERE destination = $1 AND start_date = $2 AND end_date = $3
       AND travel_styles_key = $4 AND expires_at > NOW()
     LIMIT 1`,
    [destination, startDate, endDate, stylesKey]
  );
  return result.rows.length > 0 ? result.rows[0].insights : null;
}

async function saveToCache(destination, startDate, endDate, stylesKey, insights) {
  await pool.query(
    `INSERT INTO destination_insights_cache
       (destination, start_date, end_date, travel_styles_key, insights, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')
     ON CONFLICT (destination, start_date, end_date, travel_styles_key) DO UPDATE SET
       insights = $5, expires_at = NOW() + INTERVAL '30 days'`,
    [destination, startDate, endDate, stylesKey, JSON.stringify(insights)]
  );
}

// ── Foursquare venue fetch ─────────────────────────────────────────────────────

async function getFromFoursquare(destination, travelStyles) {
  const queries = travelStyles.length > 0 ? travelStyles.slice(0, 3) : ['attractions', 'restaurants'];
  const allVenues = [];

  for (const style of queries) {
    const url = new URL('https://api.foursquare.com/v3/places/search');
    url.searchParams.set('query', style);
    url.searchParams.set('near', destination);
    url.searchParams.set('limit', '6');
    url.searchParams.set('sort', 'RATING');
    url.searchParams.set('fields', 'name,categories,rating,distance,hours,tips,location,fsq_id');

    const res = await fetch(url.toString(), {
      headers: {
        'Authorization': FOURSQUARE_API_KEY,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`Foursquare "${style}" query → HTTP ${res.status}`);
      continue;
    }

    const data = await res.json();
    const venues = (data.results || []).map(v => ({
      name: v.name,
      category: v.categories?.[0]?.name || style,
      reason: `A top-rated ${style.toLowerCase()} spot in ${destination}`,
      emoji: getCategoryEmoji(v.categories?.[0]?.name),
      openingHours: v.hours?.display || 'Check locally for current hours',
      distanceFromCenter: v.distance != null
        ? `${(v.distance / 1000).toFixed(1)}km from centre`
        : 'In the area',
      bestTime: 'Morning or early evening for fewer crowds',
      visitorTip: v.tips?.[0]?.text || `Rated ${v.rating ? v.rating.toFixed(1) : 'highly'} — worth the visit`,
      unsplashKeyword: `${v.name.toLowerCase().split(' ').slice(0, 2).join(' ')} ${destination.toLowerCase()}`,
      foursquareId: v.fsq_id || null,
    }));

    allVenues.push(...venues);
  }

  if (allVenues.length === 0) return null;

  return {
    thingsToDo: allVenues.slice(0, 8),
    weather: 'Check local forecast for your travel dates',
    crowdLevel: 'Moderate',
    seasonalHighlights: `Curated top spots in ${destination} for ${travelStyles.join(', ') || 'all interests'}`,
    travelTip: `Book popular venues in ${destination} ahead of time during peak season`,
    bestMonths: [],
    whyThisMonth: '',
  };
}

// ── Claude fallback generation ────────────────────────────────────────────────

async function generateFromClaude(destination, travelStyles, startDate, endDate) {
  const stylesText = travelStyles.length > 0 ? travelStyles.join(', ') : 'general travel';

  const prompt = `You are a travel expert. Generate destination insights as a JSON object.
Destination: ${destination}
Travel styles: ${stylesText}
Travel dates: ${startDate} to ${endDate}

Return this EXACT JSON structure. No markdown, no code blocks, no explanation — raw JSON only:
{
  "bestMonths": ["June", "July"],
  "whyThisMonth": "Brief explanation of why these months are ideal",
  "thingsToDo": [
    {
      "name": "Specific real place or activity name",
      "category": "Category e.g. Nature, Food, Culture, Adventure, Wellness",
      "reason": "One sentence why this matches the travel style",
      "emoji": "🏛️",
      "openingHours": "Daily 9am–6pm",
      "distanceFromCenter": "2km from city centre",
      "bestTime": "Early morning to avoid crowds",
      "visitorTip": "One specific insider tip most tourists miss",
      "unsplashKeyword": "2-3 word photo search term e.g. ubud rice terraces"
    }
  ],
  "seasonalHighlights": "What makes this season special at this destination",
  "weather": "Expected weather conditions during the travel dates",
  "crowdLevel": "Peak or High or Moderate or Low",
  "travelTip": "One specific actionable tip for this destination and travel style"
}

Return 5–7 thingsToDo. Use real place names, real opening hours, real distances. Keep all text concise.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse Claude response as JSON. Raw: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}
```

- [ ] **Step 2: Verify the file was written correctly**

```bash
node --input-type=module --eval "import('./backend/functions/destination-insights/handler.js').then(() => console.log('OK')).catch(e => console.error(e.message))" 2>&1
```

Expected: `OK` (or a harmless missing-env-var error — not a syntax error).

If you see a syntax error, check the file was saved completely.

- [ ] **Step 3: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add backend/functions/destination-insights/handler.js && git commit -m "fix: destination-insights — Foursquare primary + Claude fallback, style-keyed cache, non-fatal cache errors"
```

---

## Task 3: SAM template — FOURSQUARE_ENABLED parameter + deploy

**Files:**
- Modify: `infra/template.yaml`

- [ ] **Step 1: Add FoursquareEnabled parameter**

In `infra/template.yaml`, find the `Parameters:` block. Add after the `FoursquareApiKey` parameter (around line 74):

```yaml
  FoursquareEnabled:
    Type: String
    Default: 'true'
    AllowedValues: ['true', 'false']
    Description: Set to 'false' to disable Foursquare and use Claude-only for venue enrichment
```

- [ ] **Step 2: Add FOURSQUARE_ENABLED to Globals env vars**

Find the `Globals:` section `Environment.Variables` block (around line 10). Add after `FOURSQUARE_API_KEY`:

```yaml
        FOURSQUARE_ENABLED: !Ref FoursquareEnabled
```

The Globals block should look like:
```yaml
Globals:
  Function:
    Runtime: nodejs20.x
    Timeout: 60
    MemorySize: 512
    Environment:
      Variables:
        STAGE: !Ref Stage
        PDF_BUCKET: !Ref PDFBucket
        DB_HOST: !Ref DBHost
        DB_NAME: !Ref DBName
        DB_USER: !Ref DBUser
        DB_PASSWORD: !Ref DBPassword
        CLAUDE_API_KEY: !Ref ClaudeApiKey
        FROM_EMAIL: !Ref FromEmail
        STRIPE_SECRET_KEY: !Ref StripeSecretKey
        STRIPE_WEBHOOK_SECRET: !Ref StripeWebhookSecret
        STRIPE_SINGLE_PLAN_LINK: !Ref StripeSinglePlanLink
        STRIPE_WANDERER_LINK: !Ref StripeWandererLink
        FRONTEND_URL: !Ref FrontendUrl
        FOURSQUARE_API_KEY: !Ref FoursquareApiKey
        GOOGLE_PLACES_API_KEY: !Ref GooglePlacesApiKey
        FOURSQUARE_ENABLED: !Ref FoursquareEnabled
```

- [ ] **Step 3: Remove redundant CLAUDE_API_KEY from DestinationInsightsFunction**

Find `DestinationInsightsFunction` (around line 339). It currently has:
```yaml
      Environment:
        Variables:
          CLAUDE_API_KEY: !Ref ClaudeApiKey
```

Remove the entire `Environment:` block from this function — it's already provided by Globals:
```yaml
  DestinationInsightsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub wanderzenai-destination-insights-${Stage}
      CodeUri: ../backend/functions/destination-insights
      Handler: handler.handler
      Timeout: 30
      MemorySize: 512
      Description: Generates destination insights via Foursquare (primary) and Claude (fallback)
      Events:
        GetDestinationInsights:
          Type: Api
          Properties:
            RestApiId: !Ref WanderZenApi
            Path: /destination-insights
            Method: GET
```

- [ ] **Step 4: Validate SAM template**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && sam validate --template infra/template.yaml --lint 2>&1
```

Expected: `infra/template.yaml is a valid SAM Template` (or equivalent success message).

- [ ] **Step 5: Commit template changes**

```bash
git add infra/template.yaml && git commit -m "feat: add FOURSQUARE_ENABLED toggle to SAM template globals"
```

- [ ] **Step 6: Deploy to AWS**

```bash
npm run deploy
```

This runs `sam build && sam deploy`. When it prompts for parameter values, pass `FoursquareEnabled=true` (or `false` to disable Foursquare).

Expected: SAM reports `Successfully created/updated stack - wanderzenai-stack`.

- [ ] **Step 7: Verify destination-insights endpoint**

```bash
curl -s "https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/destination-insights?destination=Bali&travelStyles=Nature&startDate=2025-06-28&endDate=2025-07-03" | python3 -m json.tool | head -40
```

Expected: A JSON object with `insights.thingsToDo` array (5–8 venues), `insights.weather`, `insights.crowdLevel`, etc. `cached: false` on first hit.

Run the same command again — should now return `cached: true`.

- [ ] **Step 8: Verify submit no longer 500s**

Submit a test trip via the form (or via curl):

```bash
curl -s -X POST https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/submit \
  -H "Content-Type: application/json" \
  -d '{"destination":"Bali","days":5,"budget":2000,"currency":"USD","travelerType":"Couple","travelStyle":["Nature"],"email":"test@wanderzenai.com","language":"English","travelPace":"balanced","wantsHotelRecs":true}' \
  | python3 -m json.tool
```

Expected: `{"submissionId": "...", "message": "Your itinerary is being crafted..."}` — NOT a 500.

---

## Done

3 commits, 3 tasks. Submit works. Destination insights return real venue data from Foursquare (or Claude when Foursquare has no results). Cache correctly scoped per destination + dates + travel style combination.
