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
    accommodation: [],
    budgetEstimateUSD: null,
  };
}

// ── Claude fallback generation ────────────────────────────────────────────────

async function generateFromClaude(destination, travelStyles, startDate, endDate) {
  const stylesText = travelStyles.length > 0 ? travelStyles.join(', ') : 'general travel';

  const prompt = `Travel expert. Return ONLY raw JSON, no markdown:
{"bestMonths":["Jun","Jul"],"seasonalHighlights":"10 words max","weather":"10 words max","crowdLevel":"Peak|High|Moderate|Low","travelTip":"one tip","thingsToDo":[{"name":"Real place","category":"Nature","reason":"one sentence","emoji":"🏛️","visitorTip":"one insider tip","unsplashKeyword":"2-3 words"}],"accommodation":[{"type":"Eco-lodge","style":"homestay","priceRangePerNightUSD":{"low":35,"high":70},"description":"one sentence","searchKeyword":"eco lodge ${destination.toLowerCase()}"}],"budgetEstimateUSD":{"flightsLow":300,"flightsHigh":600,"accommodationPerNightLow":25,"accommodationPerNightHigh":120,"activitiesPerDayLow":20,"activitiesPerDayHigh":60,"cheaperMonths":["Apr","May"]}}

Destination: ${destination}. Travel styles: ${stylesText}. Dates: ${startDate} to ${endDate}.
Rules: exactly 3 thingsToDo, exactly 4 accommodation (styles: hotel/airbnb/homestay/surprise), all values concise. Real place names.`;

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
