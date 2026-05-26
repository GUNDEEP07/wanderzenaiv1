'use strict';

const axios = require('axios');
const { log } = require('/opt/nodejs/index');

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const FOURSQUARE_BASE = 'https://places-api.foursquare.com';
const FOURSQUARE_API_VERSION = '2025-06-17';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
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
  { fsq_id: 'munich', name: 'Munich', country: 'Germany', lat: 48.1351, lng: 11.5820 },
  { fsq_id: 'new-delhi', name: 'New Delhi', country: 'India', lat: 28.6139, lng: 77.2090 },
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

    // First, filter fallback destinations by query (prioritize exact matches)
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
    const res = await axios.get(`${GOOGLE_PLACES_BASE}/autocomplete/json`, {
      params: {
        input: query,
        key: GOOGLE_PLACES_API_KEY,
        components: 'country:*', // Allow all countries
      },
      timeout: 5000,
    });

    if (!res.data.predictions || res.data.predictions.length === 0) {
      log.info('Autocomplete no results from Google Places');
      return ok({ suggestions: [] }, event);
    }

    // Get place details for each prediction to extract coordinates
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

          return {
            fsq_id: prediction.place_id,
            name: prediction.main_text,
            country: prediction.terms?.[prediction.terms.length - 1]?.value || 'Unknown',
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

    log.info('Autocomplete success (from Google Places)', { count: validSuggestions.length });
    return ok({ suggestions: validSuggestions }, event);
  } catch (err) {
    log.error('Autocomplete failed, returning fallback', {
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
    });
    return ok({ suggestions: FALLBACK_DESTINATIONS }, event);
  }
}

const CATEGORY_TO_GOOGLE_TYPES = {
  'restaurant': ['restaurant', 'food'],
  'cafe': ['cafe', 'bakery', 'coffee_shop'],
  'park': ['park', 'natural_feature'],
  'temple': ['place_of_worship', 'hindu_temple', 'buddhist_temple'],
  'museum': ['museum', 'art_gallery'],
  'hiking_trail': ['hiking_area', 'park', 'natural_feature'],
  'viewpoint': ['scenic_point', 'natural_feature', 'park'],
  'market': ['market', 'shopping_mall', 'tourist_attraction'],
  'bar': ['bar', 'night_club', 'drinking_establishment'],
  'accommodation': ['hotel', 'lodging', 'hostel', 'apartment_hotel']
};

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

    for (const activity of FEATURED_CATEGORIES) {
      try {
        const types = CATEGORY_TO_GOOGLE_TYPES[activity] || [activity];

        const res = await axios.get(`${GOOGLE_PLACES_BASE}/nearbysearch/json`, {
          params: {
            location: `${lat},${lng}`,
            type: types[0],
            radius: 2000,
            key: GOOGLE_PLACES_API_KEY,
          },
          timeout: 5000,
        });

        if (res.data.results && res.data.results.length > 0) {
          const venues = res.data.results.slice(0, 5).map(place => {
            const photoUrl = place.photos?.[0]
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_PLACES_API_KEY}`
              : null;

            return {
              fsq_id: place.place_id,
              name: place.name,
              category: place.types?.find(t => t !== 'point_of_interest' && t !== 'establishment') || activity,
              rating: place.rating || null,
              address: place.vicinity || place.formatted_address || '',
              instagramUrl: null,
              photoUrl: photoUrl,
              attributes: null,
              hours: {
                open_now: place.opening_hours?.open_now || null,
                display: null,
              },
              website: null,
              tel: null,
            };
          });

          if (venues.length > 0) {
            categories.push({
              category: formatCategory(activity),
              venues: venues,
            });
          }
        }
      } catch (catErr) {
        log.warn('Category fetch failed', {
          activity,
          error: catErr.message,
          status: catErr.response?.status,
        });
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
