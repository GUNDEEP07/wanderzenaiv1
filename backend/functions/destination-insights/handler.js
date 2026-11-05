import { Anthropic } from '@anthropic-ai/sdk';
import pkg from 'pg';
import { createRequire } from 'module';
const { Pool } = pkg;

const require = createRequire(import.meta.url);
const {
  getDB, optionalUser, checkRateLimit, userSubject, ipSubject, rateLimitBody,
} = require('/opt/nodejs/index');
const { MODELS, firstText } = require('/opt/nodejs/claude');

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
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

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

  // Inputs feed a Claude prompt and the cache key — reject oversized values.
  if (destination.length > 200 || startDate.length > 30 || endDate.length > 30 ||
      travelStyles.length > 12 || travelStyles.some(s => s.length > 40)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid request parameters' }),
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

  // ── 2. Generate with Claude ──────────────────────────────────────────────────
  // There used to be a Foursquare-first path here, calling the legacy v3 API
  // (api.foursquare.com/v3), which Foursquare shut down on May 15, 2026. Every request
  // failed (up to three wasted HTTP calls) and fell through to Claude, so removing it
  // changes nothing users see. It also returned no budget/accommodation estimates, which
  // Step 2 needs. Mixing real venues from the shared places-api adapter into thingsToDo is
  // a product decision — see Notion A5.
  let insights = null;
  {
    // Public endpoint: cap Claude spend per caller (hashed IP, or uid when signed in).
    let caller = null;
    try { caller = await optionalUser(event); } catch { /* treat as anonymous */ }
    const blocked = await checkRateLimit(getDB(), 'insights', caller ? userSubject(caller) : ipSubject(event));
    if (blocked) {
      return {
        statusCode: 429,
        headers: { ...CORS_HEADERS, 'Retry-After': String(blocked.retryAfterSeconds) },
        body: JSON.stringify(rateLimitBody(blocked.retryAfterSeconds)),
      };
    }
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
  if (result.rows.length === 0) return null;
  const insights = result.rows[0].insights;
  // Invalidate cache entries created before accommodation field was added
  if (!insights.accommodation || insights.accommodation.length === 0) {
    console.log(`Cache miss (stale — no accommodation): ${destination}`);
    return null;
  }
  return insights;
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

// ── Claude generation ─────────────────────────────────────────────────────────

async function generateFromClaude(destination, travelStyles, startDate, endDate) {
  const stylesText = travelStyles.length > 0 ? travelStyles.join(', ') : 'general travel';

  const prompt = `Travel expert. Return ONLY raw JSON, no markdown:
{"bestMonths":["Jun","Jul"],"seasonalHighlights":"10 words max","weather":"10 words max","crowdLevel":"Peak|High|Moderate|Low","travelTip":"one tip","thingsToDo":[{"name":"Real place","category":"Nature","reason":"one sentence","emoji":"🏛️","visitorTip":"one insider tip","unsplashKeyword":"2-3 words"}],"accommodation":[{"type":"Eco-lodge","style":"homestay","priceRangePerNightUSD":{"low":35,"high":70},"description":"one sentence","searchKeyword":"eco lodge ${destination.toLowerCase()}"}],"budgetEstimateUSD":{"flightsLow":300,"flightsHigh":600,"accommodationPerNightLow":25,"accommodationPerNightHigh":120,"activitiesPerDayLow":20,"activitiesPerDayHigh":60,"cheaperMonths":["Apr","May"]}}

Destination: ${destination}. Travel styles: ${stylesText}. Dates: ${startDate} to ${endDate}.
Rules: exactly 3 thingsToDo, exactly 4 accommodation (styles: hotel/airbnb/homestay/surprise), all values concise. Real place names.`;

  const response = await anthropic.messages.create({
    model: MODELS.fast,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = firstText(response);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse Claude response as JSON. Raw: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}
