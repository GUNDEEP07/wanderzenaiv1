import { Anthropic } from '@anthropic-ai/sdk';
import pkg from 'pg';
import { createRequire } from 'module';
const { Pool } = pkg;

const require = createRequire(import.meta.url);
const {
  getDB, optionalUser, checkRateLimit, userSubject, ipSubject, rateLimitBody,
} = require('/opt/nodejs/index');
const { MODELS, firstText, withEffort, maxTokensFor } = require('/opt/nodejs/claude');
const { searchVenues } = require('/opt/nodejs/venue-enrichment/foursquare');
const { formatVenueChoices, groundThingsToDo } = require('/opt/nodejs/venue-enrichment/verified');

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
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://www.wanderzenai.com', // only our site (P2-10)
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

  // Optional (Nov 22 2026, trip cost estimate): estimates in the traveller's currency, and return
  // flights from their home city (the planner sends `from` for the route's first stop only).
  const currency = q.currency ? String(q.currency).toUpperCase() : '';
  const from = q.from ? String(q.from).replace(/\s+/g, ' ').trim() : '';
  if ((currency && !/^[A-Z]{3}$/.test(currency)) || from.length > 80 || /[<>{}\[\]`$\\"]/.test(from)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Invalid request parameters' }),
    };
  }

  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Dates must be YYYY-MM-DD' }),
    };
  }

  // Sorted lowercase key — e.g. ["Nature","Parks"] → "nature,parks"
  const stylesKey = [
    [...travelStyles].sort().join(',').toLowerCase() || 'general',
    currency ? `cur:${currency}` : '',
    from ? `from:${from.toLowerCase()}` : '',
  ].filter(Boolean).join('|');
  // Cached per destination + travel MONTH (not exact dates): the planner's step 3 asks for every
  // stop, and "dates not fixed" trips used a date that moved daily, so the cache never hit.
  const month = monthOf(startDate);

  // ── 1. Cache check (non-fatal) ───────────────────────────────────────────────
  try {
    const cached = await getFromCache(destination, month, month, stylesKey);
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

  // ── 2. Generate with Claude, things to do grounded in Foursquare venues ─────
  // Season, budget and stay estimates come from Claude (labelled as estimates in the UI);
  // thingsToDo are chosen from real Foursquare places — see generateFromClaude.
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
      insights = await generateFromClaude(destination, travelStyles, month, { currency, from });
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
    await saveToCache(destination, month, month, stylesKey, insights);
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
  // Invalidate cache entries created before accommodation field was added, or before
  // things to do were grounded in real places (no placesSource).
  if (!insights.accommodation || insights.accommodation.length === 0 || !insights.placesSource || insights.version !== INSIGHTS_VERSION) {
    console.log(`Cache miss (stale entry): ${destination}`);
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

// v2 (Nov 22 2026): 6 things to do (the planner's must-see list), cached per travel month.
const INSIGHTS_VERSION = 2;
const THINGS_TO_DO = 6;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/**
 * Extra JSON field for the planner's trip-cost estimate: typical stay prices per night for three
 * slow-travel styles and, with a home city, return economy fares per person. Estimates only —
 * the UI labels them so and links to the booking sites for live prices.
 */
function estimatesRule(destination, travelMonth, currency, from) {
  if (!currency) return '';
  return `Also add "estimates" (all money in ${currency}, whole numbers, typical ${travelMonth} prices, never live quotes):
"estimates":{"stays":[{"style":"homestay","label":"Homestay or guesthouse","low":0,"high":0},{"style":"boutique","label":"Boutique hotel or lodge","low":0,"high":0},{"style":"apartment","label":"Apartment or cottage","low":0,"high":0}]${from ? `,"flights":{"cheapest":{"low":0,"high":0},"direct":{"low":0,"high":0} or null if there are no direct flights,"note":"under 12 words, e.g. the usual connection"}` : ''}}
stays: per night for one room for two in ${destination}; keep the three styles but word the labels for the place (e.g. "Lakeside motel", "Farm stay").${from ? ` flights: return economy per person from ${from} to the nearest airport for ${destination}.` : ''}`;
}

const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 1e7 ? Math.round(Number(v)) : null);
const range = (r) => {
  const low = num(r?.low), high = num(r?.high);
  return low != null && high != null && high >= low && high > 0 ? { low, high } : null;
};
/** Keep only well-formed numbers; drop anything else Claude sent. */
function cleanEstimates(e, currency, withFlights) {
  const stays = (Array.isArray(e?.stays) ? e.stays : []).slice(0, 3).map((x) => {
    const r = range(x);
    return r && { style: String(x.style || '').slice(0, 20), label: String(x.label || x.style || 'Stay').slice(0, 40), ...r };
  }).filter(Boolean);
  let flights = null;
  if (withFlights && e?.flights) {
    const cheapest = range(e.flights.cheapest);
    if (cheapest) flights = { cheapest, direct: range(e.flights.direct), note: String(e.flights.note || '').slice(0, 80) };
  }
  return { currency, stays, flights };
}

/** "2027-04-06" → "2027-04-01" (the cache key's date). */
function monthOf(iso) { return `${iso.slice(0, 7)}-01`; }

async function generateFromClaude(destination, travelStyles, month, { currency = '', from = '' } = {}) {
  const travelMonth = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
  const stylesText = travelStyles.length > 0 ? travelStyles.join(', ') : 'general travel';

  // Real places first (Foursquare Places API). Empty on any failure — Claude then
  // suggests places itself and they are labelled as AI suggestions.
  const venues = await searchVenues(destination, { limit: 20 });
  const venueRule = venues.length
    ? `\nthingsToDo: choose ${THINGS_TO_DO} from this list of real places where you can, copying "name" exactly as written; add your own only if the list lacks enough good ones. Prefer quiet nature, local and slow-travel spots over famous landmarks:\n${formatVenueChoices(venues)}\n`
    : '\nthingsToDo: real place names only.\n';

  const prompt = `Travel expert. Return ONLY raw JSON, no markdown:
{"bestMonths":["Jun","Jul"],"seasonalHighlights":"10 words max","weather":"10 words max","crowdLevel":"Peak|High|Moderate|Low","travelTip":"one tip","thingsToDo":[{"name":"Real place","category":"Nature","reason":"one sentence","emoji":"🏛️","visitorTip":"one insider tip","unsplashKeyword":"2-3 words"}],"accommodation":[{"type":"Eco-lodge","style":"homestay","priceRangePerNightUSD":{"low":35,"high":70},"description":"one sentence","searchKeyword":"eco lodge ${destination.toLowerCase()}"}],"budgetEstimateUSD":{"flightsLow":300,"flightsHigh":600,"accommodationPerNightLow":25,"accommodationPerNightHigh":120,"activitiesPerDayLow":20,"activitiesPerDayHigh":60,"cheaperMonths":["Apr","May"]}}

Destination: ${destination}. Travel styles: ${stylesText}. Travel month: ${travelMonth}.
${estimatesRule(destination, travelMonth, currency, from)}
Rules: exactly ${THINGS_TO_DO} thingsToDo — a mix a slow traveller would want (a short walk or trail, a view, a local café or food stop, a nature spot, a local experience, a day trip), good in ${travelMonth}; each "reason" says why it's worth it in under 15 words; exactly 4 accommodation (styles: hotel/airbnb/homestay/surprise), all values concise.${venueRule}`;

  const response = await anthropic.messages.create(withEffort({
    model: MODELS.fast,
    max_tokens: maxTokensFor(MODELS.fast, 3200, { thinkingHeadroom: 1500 }),
    messages: [{ role: 'user', content: prompt }],
  }, 'low'));

  const text = firstText(response);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Could not parse Claude response as JSON. Raw: ${text.slice(0, 200)}`);
  const insights = JSON.parse(match[0]);

  // Matched back in code: verified places get real name/address/map link; anything
  // Claude invented is kept only as a labelled suggestion.
  insights.thingsToDo = groundThingsToDo(insights.thingsToDo, venues, THINGS_TO_DO);
  insights.version = INSIGHTS_VERSION;
  if (currency) insights.estimates = cleanEstimates(insights.estimates, currency, !!from);
  else delete insights.estimates;
  insights.placesSource = venues.length ? 'foursquare' : 'ai';
  console.log(JSON.stringify({
    level: 'INFO', msg: 'Insights things to do grounded', destination,
    venuesOffered: venues.length,
    verified: insights.thingsToDo.filter(t => t.verified).length,
    suggestions: insights.thingsToDo.filter(t => !t.verified).length,
  }));
  return insights;
}
