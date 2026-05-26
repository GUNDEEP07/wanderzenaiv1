'use strict';

const axios = require('axios');
const { log } = require('/opt/nodejs/index');

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const FOURSQUARE_BASE = 'https://api.foursquare.com/v3';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());

const FEATURED_CATEGORIES = [
  'restaurant', 'cafe', 'park', 'temple', 'museum',
  'hiking_trail', 'viewpoint', 'market', 'bar', 'accommodation'
];

// Fallback destinations if Foursquare is down
const FALLBACK_DESTINATIONS = [
  { fsq_id: 'kyoto', name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
  { fsq_id: 'bangkok', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
  { fsq_id: 'bali', name: 'Bali', country: 'Indonesia', lat: -8.6705, lng: 115.2126 },
  { fsq_id: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { fsq_id: 'oaxaca', name: 'Oaxaca', country: 'Mexico', lat: 17.0732, lng: -96.7266 },
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

  if (!query || query.trim().length < 2) {
    return ok({ suggestions: [] }, event);
  }

  try {
    log.info('Autocomplete request', { query });
    const res = await axios.get(`${FOURSQUARE_BASE}/places/autocomplete`, {
      params: { query, limit: 5 },
      headers: { Authorization: `Bearer ${FOURSQUARE_API_KEY}` },
      timeout: 5000,
    });

    const suggestions = res.data.results.map(place => ({
      fsq_id: place.fsq_id,
      name: place.name,
      country: place.location?.country || 'Unknown',
      lat: place.location?.latitude,
      lng: place.location?.longitude,
    }));

    log.info('Autocomplete success', { count: suggestions.length });
    return ok({ suggestions }, event);
  } catch (err) {
    log.error('Autocomplete failed, returning fallback', {
      error: err.message,
      status: err.response?.status,
      data: err.response?.data,
      apiKey: FOURSQUARE_API_KEY ? 'set' : 'not-set'
    });
    return ok({ suggestions: FALLBACK_DESTINATIONS }, event);
  }
}

async function handleVenues(event) {
  const { destination, lat, lng } = event.queryStringParameters || {};

  if (!lat || !lng) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing lat and lng parameters' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    log.info('Venues request', { destination, lat, lng });
    const categories = [];

    for (const category of FEATURED_CATEGORIES) {
      try {
        const res = await axios.get(`${FOURSQUARE_BASE}/places/search`, {
          params: {
            ll: `${lat},${lng}`,
            query: category,
            limit: 5,
            sort: 'rating',
          },
          headers: { Authorization: `Bearer ${FOURSQUARE_API_KEY}` },
          timeout: 5000,
        });

        if (res.data.results && res.data.results.length > 0) {
          categories.push({
            category: formatCategory(category),
            venues: res.data.results.map(v => ({
              fsq_id: v.fsq_id,
              name: v.name,
              category: v.categories?.[0]?.name || category,
              rating: v.rating || null,
              address: v.location?.address || v.location?.formatted_address || '',
            })),
          });
        }
      } catch (catErr) {
        log.warn('Category fetch failed', {
          category,
          error: catErr.message,
          status: catErr.response?.status,
          data: catErr.response?.data
        });
        // Continue with next category
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
