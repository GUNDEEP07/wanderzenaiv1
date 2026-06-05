'use strict';

const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const { log, getDB } = require('/opt/nodejs/index');

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const FOURSQUARE_BASE = 'https://places-api.foursquare.com';
const FOURSQUARE_API_VERSION = '2025-06-17';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const anthropic = CLAUDE_API_KEY ? new Anthropic({ apiKey: CLAUDE_API_KEY }) : null;
const aiVenueCache = new Map();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

const FEATURED_CATEGORIES = [
  { id: '4d4b7105d754a06374d81259', name: 'restaurant' },
  { id: '4bf58dd8d48988d16d941735', name: 'cafe' },
  { id: '4bf58dd8d48988d163941735', name: 'park' },
  { id: '4bf58dd8d48988d139941735', name: 'temple' },
  { id: '4bf58dd8d48988d181941735', name: 'museum' },
  { id: '4bf58dd8d48988d159941735', name: 'hiking_trail' },
  { id: '4bf58dd8d48988d165941735', name: 'viewpoint' },
  { id: '50be8ee891d4fa8dcc7199a7', name: 'market' },
  { id: '4bf58dd8d48988d116941735', name: 'bar' },
  { id: '4bf58dd8d48988d1fa931735', name: 'accommodation' },
];

// Fallback destinations if Foursquare is down
const FALLBACK_DESTINATIONS = [
  { fsq_id: 'kyoto', name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
  { fsq_id: 'bangkok', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
  { fsq_id: 'bali', name: 'Bali', country: 'Indonesia', lat: -8.6705, lng: 115.2126 },
  { fsq_id: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { fsq_id: 'oaxaca', name: 'Oaxaca', country: 'Mexico', lat: 17.0732, lng: -96.7266 },
  { fsq_id: 'munich', name: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.5820 },
  { fsq_id: 'new-delhi', name: 'New Delhi', country: 'India', lat: 28.6139, lng: 77.2090 },
  { fsq_id: 'shimla', name: 'Shimla', country: 'India', lat: 31.7773, lng: 77.1063 },
  { fsq_id: 'bir', name: 'Bir', country: 'India', lat: 32.1848, lng: 76.8185 },
  { fsq_id: 'manali', name: 'Manali', country: 'India', lat: 32.2431, lng: 77.1892 },
  { fsq_id: 'goa', name: 'Goa', country: 'India', lat: 15.2993, lng: 73.8243 },
  { fsq_id: 'tokyo', name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { fsq_id: 'london', name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { fsq_id: 'barcelona', name: 'Barcelona', country: 'Spain', lat: 41.3851, lng: 2.1734 },
  { fsq_id: 'amsterdam', name: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041 },
  { fsq_id: 'rome', name: 'Rome', country: 'Italy', lat: 41.9028, lng: 12.4964 },
  { fsq_id: 'singapore', name: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { fsq_id: 'hong-kong', name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { fsq_id: 'dubai', name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsHeaders(200, '', event);
  }

  const path = event.path || event.resource || '';
  log.info('Recommendations request', { path, method: event.httpMethod });

  try {
    if (path.includes('/autocomplete')) {
      return await handleAutocomplete(event);
    } else if (path.includes('/venues')) {
      return await handleVenues(event);
    } else if (path.includes('/trending')) {
      return await handleTrending(event);
    } else if (path.includes('/public/stats')) {
      return await handlePublicStats(event);
    } else if (path.includes('/personalised')) {
      return await handlePersonalised(event);
    } else if (path.includes('/chat')) {
      return await handleChat(event);
    } else if (path.includes('/categories')) {
      return await handleCategories(event);
    } else {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }
  } catch (err) {
    log.error('Unexpected error', { error: err.message });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

async function handleAutocomplete(event) {
  const query = event.queryStringParameters?.query || '';
  const location = event.queryStringParameters?.location || '';
  const radius = event.queryStringParameters?.radius || '';

  if (!query || query.trim().length < 2) {
    return ok({ suggestions: [] }, event);
  }

  try {
    log.info('Autocomplete request', { query, location, radius });

    // Check cache first
    try {
      const cacheResult = await getDB().query(
        'SELECT suggestions FROM autocomplete_cache WHERE query = $1',
        [query.toLowerCase()]
      );

      if (cacheResult.rows.length > 0) {
        log.info('Autocomplete success (from cache)', { query });
        return ok({ suggestions: cacheResult.rows[0].suggestions }, event);
      }
    } catch (cacheErr) {
      log.warn('Cache lookup failed', { error: cacheErr.message });
    }

    // Check fallback destinations by query
    const lowerQuery = query.toLowerCase();
    const nameMatches = FALLBACK_DESTINATIONS.filter(dest =>
      dest.name.toLowerCase().includes(lowerQuery)
    );

    const countryMatches = query.length >= 3
      ? FALLBACK_DESTINATIONS.filter(dest =>
          !nameMatches.includes(dest) &&
          dest.country.toLowerCase().includes(lowerQuery)
        )
      : [];

    const fallbackMatches = [...nameMatches, ...countryMatches];

    // If we found matches in fallback destinations, return those first
    if (fallbackMatches.length > 0) {
      log.info('Autocomplete success (from fallback)', { count: fallbackMatches.length });
      return ok({ suggestions: fallbackMatches }, event);
    }

    // Otherwise, try Google Places Autocomplete API
    const params = {
      input: query,
      key: GOOGLE_PLACES_API_KEY,
    };

    if (location) {
      params.location = location;
      if (radius) params.radius = radius;
    }

    const res = await axios.get(`${GOOGLE_PLACES_BASE}/autocomplete/json`, {
      params,
      timeout: 5000,
    });

    if (!res.data.predictions || res.data.predictions.length === 0) {
      log.info('Autocomplete no results from Google Places', {
        status: res.status,
        statusText: res.statusText,
        data: res.data,
      });
      return ok({ suggestions: [] }, event);
    }

    const suggestions = await Promise.all(
      res.data.predictions.slice(0, 5).map(async (prediction) => {
        try {
          const detailsRes = await axios.get(`${GOOGLE_PLACES_BASE}/details/json`, {
            params: {
              place_id: prediction.place_id,
              key: GOOGLE_PLACES_API_KEY,
              fields: 'geometry,formatted_address',
            },
            timeout: 5000,
          });

          const location = detailsRes.data.result?.geometry?.location;
          const formatted = detailsRes.data.result?.formatted_address || prediction.description;

          let name = prediction.main_text || prediction.description?.split(',')[0];
          if (!name && prediction.structured_formatting) {
            name = prediction.structured_formatting.main_text;
          }

          if (!name) return null;

          let country = 'Unknown';
          if (prediction.terms?.length > 0) {
            country = prediction.terms[prediction.terms.length - 1]?.value || 'Unknown';
          } else if (prediction.structured_formatting?.secondary_text) {
            country = prediction.structured_formatting.secondary_text;
          }

          return {
            fsq_id: prediction.place_id,
            name: name,
            country: country,
            lat: location?.lat || null,
            lng: location?.lng || null,
            description: formatted,
          };
        } catch (detailErr) {
          log.warn('Failed to get place details', { place_id: prediction.place_id, error: detailErr.message });
          return null;
        }
      })
    );

    const validSuggestions = suggestions.filter(s => s !== null);

    // Cache the results
    if (validSuggestions.length > 0) {
      try {
        await getDB().query(
          'INSERT INTO autocomplete_cache (query, suggestions) VALUES ($1, $2) ON CONFLICT (query) DO UPDATE SET suggestions = $2',
          [query.toLowerCase(), JSON.stringify(validSuggestions)]
        );
      } catch (cacheInsertErr) {
        log.warn('Failed to cache results', { error: cacheInsertErr.message });
      }
    }

    log.info('Autocomplete success (from Google Places)', { count: validSuggestions.length });
    return ok({ suggestions: validSuggestions }, event);
  } catch (err) {
    log.error('Autocomplete failed', {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      code: err.code,
      query,
    });
    return ok({ suggestions: FALLBACK_DESTINATIONS }, event);
  }
}

async function interpretNaturalQuery(query, destination) {
  if (!anthropic) return null;
  const safe = query.replace(/[\n\r`\\]/g, ' ').trim().slice(0, 200);
  try {
    const msg = await anthropic.messages.create(
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: `Extract the venue type from this search query for ${destination}: "${safe}"\nReturn JSON only: {"venueType": "...", "searchTerms": ["term1","term2"], "foursquareCategory": "restaurant|cafe|park|temple|museum|hiking_trail|viewpoint|market|bar|spa|beach|shopping"}`,
        }],
      },
      { timeout: 5000 }
    );
    const text = msg.content[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}
  return null;
}

async function handleVenues(event) {
  const { destination, lat, lng, activity, query } = event.queryStringParameters || {};

  if (!lat || !lng) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing lat and lng parameters' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Natural language query path
  if (query) {
    log.info('Natural language search', { destination, query });
    const intent = await interpretNaturalQuery(query, destination || 'this city');
    const resolvedActivity = intent?.foursquareCategory || intent?.venueType || query;
    log.info('Interpreted intent', { intent, resolvedActivity });

    const aiVenues = await generateAIVenues(
      destination || 'Unknown',
      intent?.venueType || query,
      lat,
      lng,
      query
    );
    if (aiVenues.length > 0) {
      return ok({
        destination,
        categories: [{ category: intent?.venueType || query, venues: aiVenues, source: 'ai' }],
      }, event);
    }
    return ok({ destination, categories: [] }, event);
  }

  try {
    log.info('Venues request', { destination, lat, lng, activity });
    const categories = [];

    // Filter to requested activity if specified, otherwise use all featured categories
    let categoriesToFetch = FEATURED_CATEGORIES;
    if (activity) {
      const lowerActivity = activity.toLowerCase();
      const activityMap = {
        'hiking': { id: '4bf58dd8d48988d159941735', name: 'hiking_trail' },
        'food': [
          { id: '4d4b7105d754a06374d81259', name: 'restaurant' },
          { id: '4bf58dd8d48988d16d941735', name: 'cafe' },
          { id: '50be8ee891d4fa8dcc7199a7', name: 'market' },
        ],
        'nature': { id: '4bf58dd8d48988d163941735', name: 'park' },
        'culture': [
          { id: '4bf58dd8d48988d139941735', name: 'temple' },
          { id: '4bf58dd8d48988d181941735', name: 'museum' },
        ],
        'views': { id: '4bf58dd8d48988d165941735', name: 'viewpoint' },
        'nightlife': { id: '4bf58dd8d48988d116941735', name: 'bar' },
      };

      const mapped = activityMap[lowerActivity];
      if (mapped) {
        categoriesToFetch = Array.isArray(mapped)
          ? FEATURED_CATEGORIES.filter(cat => mapped.some(m => m.id === cat.id))
          : FEATURED_CATEGORIES.filter(cat => cat.id === mapped.id);
      }
    }

    const fsqResults = await Promise.allSettled(
      categoriesToFetch.map(activityCat => {
        const fsqCategoryId = activityCat.id;
        return axios.get(
          `${FOURSQUARE_BASE}/places/search`,
          {
            params: {
              'll': `${lat},${lng}`,
              'fsq_category_ids': fsqCategoryId,
              'limit': 5,
              'radius': 2000,
              'fields': 'fsq_place_id,name,categories,rating,location,photos,website,tel,hours,social_media,attributes,distance',
            },
            headers: {
              'Authorization': `Bearer ${FOURSQUARE_API_KEY}`,
              'X-Places-Api-Version': FOURSQUARE_API_VERSION,
              'accept': 'application/json',
            },
            timeout: 5000,
          }
        ).then(res => ({ res, activityCat }));
      })
    );

    for (const result of fsqResults) {
      if (result.status === 'rejected') {
        log.warn('Category fetch failed', { error: result.reason?.message });
        continue;
      }
      const { res, activityCat } = result.value;
      if (!res.data.results || res.data.results.length === 0) continue;

      const venues = res.data.results.map(place => {
        const photoUrl = place.photos?.[0]?.prefix
          ? `${place.photos[0].prefix}300x300${place.photos[0].suffix}`
          : null;
        const categoryName = place.categories?.[0]?.name || activityCat.name;
        let instagramUrl = null;
        if (place.social_media?.instagram) {
          instagramUrl = place.social_media.instagram;
        }
        return {
          fsq_id: place.fsq_place_id,
          name: place.name,
          category: categoryName,
          rating: place.rating || 0,
          reviewCount: place.review_count || 0,
          address: place.location?.formatted_address || '',
          lat: place.latitude || null,
          lng: place.longitude || null,
          instagramUrl,
          photoUrl,
          photos: place.photos || [],
          attributes: place.attributes || null,
          hours: {
            open_now: place.hours?.open_now || null,
            display: place.hours?.display || null,
          },
          website: place.website || null,
          tel: place.tel || null,
          tips: place.tips || [],
        };
      });

      const maxReviews = Math.max(...venues.map(v => v.reviewCount || 0), 1);
      venues.forEach(venue => {
        const ratingScore = (venue.rating || 0) / 5;
        const reviewScore = (venue.reviewCount || 0) / maxReviews;
        venue.score = (ratingScore * 0.4) + (reviewScore * 0.6);
      });
      venues.sort((a, b) => (b.score || 0) - (a.score || 0));

      if (venues.length > 0) {
        categories.push({
          category: formatCategory(activityCat.name),
          venues,
        });
      }
    }

    // If Foursquare returned nothing, fall back to Claude AI
    if (categories.length === 0) {
      log.info('Foursquare returned 0 venues, trying AI fallback', { destination, activity });
      const aiVenues = await generateAIVenues(destination, activity, lat, lng);
      if (aiVenues.length > 0) {
        categories.push({
          category: activity,
          venues: aiVenues,
          source: 'ai',
        });
        log.info('AI fallback success', { destination, activity, count: aiVenues.length });
      }
    }

    log.info('Venues success', { destination, categoryCount: categories.length });
    return ok({
      destination,
      categories: categories.slice(0, 10),
    }, event);
  } catch (err) {
    log.error('Venues fetch failed', { error: err.message });
    return ok({
      destination,
      categories: [],
      error: 'Unable to fetch venues'
    }, event);
  }
}

async function generateAIVenues(destination, activity, lat, lng, naturalQuery) {
  if (!anthropic) return [];

  const cacheKey = `${destination}::${naturalQuery || activity}`;
  if (aiVenueCache.has(cacheKey)) {
    log.info('AI venue cache hit', { destination, activity });
    return aiVenueCache.get(cacheKey);
  }

  const safeDestination = destination.replace(/[\n\r`\\]/g, ' ').trim().slice(0, 100);
  const safeActivity = activity.replace(/[\n\r`\\]/g, ' ').trim().slice(0, 50);
  const safeQuery = naturalQuery ? naturalQuery.replace(/[\n\r`\\]/g, ' ').trim().slice(0, 200) : null;
  const promptContext = safeQuery
    ? `A traveller searched: "${safeQuery}". List 5 real, specific matching places in ${safeDestination}.`
    : `List 5 real, specific places for "${safeActivity}" in ${safeDestination}.`;

  const prompt = `You are a local travel expert. ${promptContext}

Return a JSON array ONLY — no explanation, no markdown:
[
  {
    "name": "Exact name of the place",
    "address": "Street address or neighbourhood name",
    "description": "One sentence on why a slow traveller would love this",
    "openingHours": "e.g. Daily 8am–9pm or Mon–Sat 10am–6pm",
    "category": "${safeActivity}"
  }
]

Rules:
- Use real, verifiable places
- Be specific — no generic names like "Local Cafe"
- If you are not sure of exact hours, give a typical range for that type of place`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let message;
    try {
      message = await anthropic.messages.create(
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const places = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(places)) return [];

    const results = places.slice(0, 5).map((place, i) => ({
      fsq_id: `ai-${(destination || '').replace(/\s+/g, '-').toLowerCase()}-${safeActivity}-${i}`,
      name: place.name || 'Unknown',
      category: place.category || safeActivity,
      rating: null,
      reviewCount: 0,
      score: 0,
      address: place.address || '',
      description: place.description || '',
      openingHours: place.openingHours || '',
      lat: parseFloat(lat) || null,
      lng: parseFloat(lng) || null,
      source: 'ai',
      photoUrl: null,
      photos: [],
      instagramUrl: null,
      hours: { open_now: null, display: place.openingHours || null },
      website: null,
      tel: null,
    }));

    aiVenueCache.set(cacheKey, results);
    return results;
  } catch (err) {
    log.warn('AI venue fallback failed', { error: err.message, destination, activity });
    return [];
  }
}

async function handlePersonalised(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  let email = null;
  try {
    if (token && token !== 'demo-token') {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      email = payload.email || null;
    }
  } catch { /* invalid token */ }

  if (!email) return ok({ recommendations: [], preferred_activities: [] }, event);

  // Check 7-day cache
  try {
    const cached = await getDB().query(
      `SELECT recommendations FROM recommendation_cache
       WHERE email = $1 AND created_at > NOW() - INTERVAL '7 days'`,
      [email]
    );
    if (cached.rows.length > 0) {
      log.info('Personalised recs cache hit', { email });
      return ok(cached.rows[0].recommendations, event);
    }
  } catch (cacheErr) {
    log.warn('Recs cache lookup failed', { error: cacheErr.message });
  }

  if (!anthropic) return ok({ recommendations: [], preferred_activities: [] }, event);

  try {
    // Fetch past destinations and profile in parallel
    const [tripsResult, profileResult] = await Promise.all([
      getDB().query(
        `SELECT DISTINCT destination FROM submissions WHERE email = $1 ORDER BY destination LIMIT 10`,
        [email]
      ),
      getDB().query(
        `SELECT age, gender, home_city FROM users WHERE email = $1`,
        [email]
      ),
    ]);

    const pastDestinations = tripsResult.rows.map(r => r.destination).filter(Boolean);
    const profile = profileResult.rows[0] || {};

    const profileDesc = [
      profile.age    ? `age ${profile.age}`          : null,
      profile.gender || null,
      profile.home_city ? `based in ${profile.home_city}` : null,
    ].filter(Boolean).join(', ');

    const pastDesc = pastDestinations.length > 0
      ? `has visited: ${pastDestinations.join(', ')}`
      : 'has no past trips yet';

    const prompt = `You are a slow-travel expert. A traveller (${profileDesc || 'profile unknown'}) ${pastDesc}.

Recommend 3 new slow-travel destinations they haven't visited yet.
Return JSON array ONLY — no explanation:
[
  { "destination": "City, Country", "country": "Country", "emoji": "🇯🇵", "reason": "One sentence why this suits them" }
]`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let message;
    try {
      message = await anthropic.messages.create(
        { model: 'claude-haiku-4-5-20251001', max_tokens: 512, messages: [{ role: 'user', content: prompt }] },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }

    const text = message.content[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    const recommendations = match ? JSON.parse(match[0]).slice(0, 3) : [];

    // Compute preferred activities from travel_style column
    const activitiesResult = await getDB().query(
      `SELECT travel_style, traveler_type FROM submissions WHERE email = $1 AND travel_style IS NOT NULL LIMIT 15`,
      [email]
    );
    const counts = {};
    for (const row of activitiesResult.rows) {
      try {
        const styles = Array.isArray(row.travel_style) ? row.travel_style : JSON.parse(row.travel_style || '[]');
        styles.forEach(s => { if (s) counts[s] = (counts[s] || 0) + 1; });
      } catch { /* skip */ }
    }
    const preferred_activities = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]).slice(0, 4).map(([s]) => s);

    // Most common traveler type
    const travelerCounts = {};
    activitiesResult.rows.forEach(r => { if (r.traveler_type) travelerCounts[r.traveler_type] = (travelerCounts[r.traveler_type] || 0) + 1; });
    const top_traveler_type = Object.entries(travelerCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || null;

    const result = { recommendations, preferred_activities, top_traveler_type };

    // Cache result
    try {
      await getDB().query(
        `INSERT INTO recommendation_cache (email, recommendations)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET recommendations = $2, created_at = NOW()`,
        [email, JSON.stringify(result)]
      );
    } catch (cacheErr) {
      log.warn('Recs cache write failed', { error: cacheErr.message });
    }

    return ok(result, event);
  } catch (err) {
    log.error('Personalised recs failed', { error: err.message });
    return ok({ recommendations: [], preferred_activities: [] }, event);
  }
}

async function handleChat(event) {
  if (!anthropic) return ok({ reply: 'AI advisor is not configured yet.' }, event);

  // Decode user email from JWT
  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let email = null;
  try {
    if (token && token !== 'demo-token') {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      email = payload.email;
    }
  } catch { /* skip */ }

  const body = JSON.parse(event.body || '{}');
  const { message, history = [] } = body;

  if (!message?.trim()) return ok({ reply: 'Please send a message.' }, event);

  // Track chat session — upsert so multiple messages in one session increment the count
  // Uses session fingerprint: email + date (one session per user per day)
  const sessionDate = new Date().toISOString().split('T')[0];
  const sessionKey = email ? `${email}_${sessionDate}` : null;
  if (sessionKey) {
    getDB().query(
      `INSERT INTO chat_sessions (user_id, firebase_uid, messages_count, destination, created_at)
       SELECT u.id, $2, 1, $3, NOW() FROM users u WHERE u.email = $1
       ON CONFLICT DO NOTHING`,
      [email, null, body.destination || null]
    ).then(() =>
      getDB().query(
        `UPDATE chat_sessions SET messages_count = messages_count + 1
         WHERE user_id = (SELECT id FROM users WHERE email = $1)
           AND DATE(created_at) = $2::date AND led_to_plan = FALSE`,
        [email, sessionDate]
      )
    ).catch(() => { /* non-fatal */ });
  }

  // Load user context
  let userContext = 'The user is a WanderZenAI member who loves slow travel.';
  if (email) {
    try {
      const [profileRes, tripsRes] = await Promise.all([
        getDB().query('SELECT name, home_city, age, language FROM users WHERE email = $1', [email]),
        getDB().query('SELECT DISTINCT destination FROM submissions WHERE email = $1 ORDER BY destination LIMIT 15', [email]),
      ]);
      const p = profileRes.rows[0] || {};
      const destinations = tripsRes.rows.map(r => r.destination).filter(Boolean);
      userContext = [
        p.name ? `The user's name is ${p.name}.` : '',
        p.home_city ? `They are based in ${p.home_city}.` : '',
        p.age ? `They are ${p.age} years old.` : '',
        destinations.length > 0
          ? `Past trips: ${destinations.join(', ')}.`
          : 'They haven\'t planned any trips yet.',
      ].filter(Boolean).join(' ');
    } catch { /* use default context */ }
  }

  const systemPrompt = `You are a friendly trip planning assistant for WanderZenAI — a slow travel app. You guide users through planning a trip by collecting details conversationally, then hand off to the full planner.

User context: ${userContext}

FLOW — collect these details one at a time, in this order:
1. Destination
2. How many days?
3. When? (travel date or month — ok if vague)
4. Travelling as — Solo / Couple / Family / Group of friends?
5. Travel vibe — Nature / Cultural / Foodie / Adventure / Relaxation / Wellness (can pick multiple)
6. Budget — Budget / Mid-range / Luxury?

Rules:
- Ask EXACTLY ONE question per reply. Never combine two questions.
- Keep every reply under 40 words.
- Be warm and casual — like a knowledgeable friend, not a form.
- Acknowledge each answer briefly before asking the next question (e.g. "Nice! 7 days is perfect for..." → next question).
- Once you have ALL 6 details, output ONLY this (no other text):
  READY:{"destination":"City, Country","days":N,"travelDate":"YYYY-MM-DD or null","travelerType":"Solo|Couple|Family|Group of friends","travelStyle":["Style1","Style2"],"budget":"Budget|Mid-range|Luxury","currency":"USD"}
- Use null for travelDate if they gave a vague time like "next month" or "summer".
- If they ask for recommendations without trip intent, give ONE specific suggestion + one-line reason, then ask "Want me to plan this trip for you?"`;


  // Build conversation for Claude
  // history already includes the current user message (sent from frontend)
  // So we use it directly — no need to append message again
  const messages = history.length > 0
    ? history.slice(-10).map(m => ({ role: m.role, content: m.content }))
    : [{ role: 'user', content: message.trim() }];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let response;
    try {
      response = await anthropic.messages.create(
        { model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: systemPrompt, messages },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }
    const raw = response.content[0]?.text || '';

    // Detect READY: signal — Claude has collected all trip details
    const readyMatch = raw.match(/^READY:(\{[\s\S]*\})\s*$/m);
    if (readyMatch) {
      try {
        const tripData = JSON.parse(readyMatch[1]);
        // Mark this chat session as having led to planning
        if (email) {
          const today = new Date().toISOString().split('T')[0];
          getDB().query(
            `UPDATE chat_sessions SET led_to_plan = TRUE, destination = $3
             WHERE user_id = (SELECT id FROM users WHERE email = $1)
               AND DATE(created_at) = $2::date`,
            [email, today, tripData.destination || null]
          ).catch(() => { /* non-fatal */ });
        }
        return ok({
          reply: `✦ I have everything I need! Here's your trip summary:\n\n📍 ${tripData.destination} · ${tripData.days} days · ${tripData.travelerType} · ${(tripData.travelStyle || []).join(', ')} · ${tripData.budget}\n\nReady to build your full itinerary?`,
          readyToPlan: true,
          tripData,
        }, event);
      } catch { /* fall through to normal reply */ }
    }

    return ok({ reply: raw || 'Sorry, I couldn\'t generate a response. Try again.' }, event);
  } catch (err) {
    log.error('Chat failed', { error: err.message });
    return ok({ reply: 'I\'m having trouble connecting right now. Please try again in a moment.' }, event);
  }
}

async function handleTrending(event) {
  const authHeader = event.headers?.Authorization || event.headers?.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let email = null;
  try {
    if (token && token !== 'demo-token') {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      email = payload.email;
    }
  } catch { /* public fallback */ }

  // Get user country from profile if logged in
  let country = event.queryStringParameters?.country || 'India';
  let interests = event.queryStringParameters?.interests || '';

  if (email) {
    try {
      const profileRow = await getDB().query(
        'SELECT home_city FROM users WHERE email = $1',
        [email]
      );
      const homeCity = profileRow.rows[0]?.home_city;
      if (homeCity) {
        // Extract country from "Sydney, Australia" → "Australia"
        const parts = homeCity.split(',');
        if (parts.length > 1) country = parts[parts.length - 1].trim();
      }
    } catch { /* use default */ }
  }

  const month = new Date().toLocaleString('en-US', { month: 'long' });
  const cacheKey = `trending:${country}:${month}`;

  // Check cache (24 hours)
  try {
    const cached = await getDB().query(
      `SELECT recommendations FROM recommendation_cache
       WHERE email = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [cacheKey]
    );
    if (cached.rows.length > 0) {
      return ok(cached.rows[0].recommendations, event);
    }
  } catch { /* skip cache */ }

  if (!anthropic) {
    return ok({ trending: [] }, event);
  }

  try {
    const interestText = interests ? `Their interests include: ${interests}.` : '';
    const prompt = `You are a slow travel expert. List 6 trending slow-travel destinations popular among travelers from ${country} in ${month}. ${interestText}

Focus on: under-the-radar places gaining popularity, seasonal highlights, and off-the-beaten-path gems.

Return JSON ONLY:
[
  {
    "destination": "City, Country",
    "emoji": "🇯🇵",
    "why": "One sentence — why this is trending now for travelers from ${country}",
    "badge": "🔥 Hot" | "↑ Rising" | "✦ Hidden gem",
    "count": "estimated number like 142"
  }
]`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let message;
    try {
      message = await anthropic.messages.create(
        { model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timer);
    }

    const text = message.content[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    const trending = match ? JSON.parse(match[0]).slice(0, 6) : [];

    const result = { trending, country, month };

    try {
      await getDB().query(
        `INSERT INTO recommendation_cache (email, recommendations) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET recommendations = $2, created_at = NOW()`,
        [cacheKey, JSON.stringify(result)]
      );
    } catch { /* skip cache write */ }

    return ok(result, event);
  } catch (err) {
    log.error('Trending failed', { error: err.message });
    return ok({ trending: [], country, month: '' }, event);
  }
}

async function handlePublicStats(event) {
  try {
    const result = await getDB().query(`
      SELECT
        COUNT(*) as total_trips,
        COALESCE(SUM(days), 0) as total_days,
        COUNT(DISTINCT destination) as unique_destinations,
        array_agg(DISTINCT destination ORDER BY destination) FILTER (WHERE destination IS NOT NULL) as destinations
      FROM submissions
      WHERE status = 'email_sent'
    `);

    const row = result.rows[0];
    return ok({
      totalTrips: parseInt(row.total_trips) || 0,
      totalDays: parseInt(row.total_days) || 0,
      uniqueDestinations: parseInt(row.unique_destinations) || 0,
      destinations: (row.destinations || []).filter(d => d && d.length < 40 && !d.includes('planning to go')).slice(0, 20),
    }, event);
  } catch (err) {
    // Return cached fallback values if DB fails
    return ok({
      totalTrips: 22, totalDays: 75, uniqueDestinations: 14,
      destinations: ['Kyoto, Japan', 'Kerala, India', 'Vietnam', 'Slovenia', 'Kashmir', 'Himachal Pradesh', 'Triund', 'Nagpur', 'Sydney, Australia'],
    }, event);
  }
}

async function handleCategories(event) {
  try {
    log.info('Categories request');

    let categories = [];
    try {
      const categoryRes = await getDB().query(
        'SELECT id, name, label FROM foursquare_categories WHERE parent_id IS NULL ORDER BY name'
      );
      categories = categoryRes.rows.map(row => ({
        id: row.id,
        name: row.name,
        label: row.label || row.name,
      }));
    } catch (dbErr) {
      log.warn('Failed to fetch categories from database', { error: dbErr.message });
      categories = [];
    }

    log.info('Categories success', { count: categories.length });
    return ok({ categories }, event);
  } catch (err) {
    log.error('Categories fetch failed', { error: err.message });
    return ok({ categories: [], error: 'Unable to fetch categories' }, event);
  }
}

function formatCategory(cat) {
  const categoryMap = {
    'restaurant': 'Restaurants',
    'cafe': 'Cafes',
    'park': 'Parks',
    'temple': 'Temples',
    'museum': 'Museums',
    'hiking_trail': 'Hiking Trails',
    'viewpoint': 'Viewpoints',
    'market': 'Markets',
    'bar': 'Bars & Nightlife',
    'accommodation': 'Accommodations',
  };
  return categoryMap[cat] || cat.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function getAllowedOrigin(event) {
  const origin = event?.headers?.Origin || event?.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0] || '*';
}

function ok(data, event) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(event),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };
}

function corsHeaders(statusCode, body, event) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(event),
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body,
  };
}
