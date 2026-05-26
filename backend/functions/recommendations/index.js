'use strict';

const axios = require('axios');
const { log, getDB } = require('/opt/nodejs/index');

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const FOURSQUARE_BASE = 'https://places-api.foursquare.com';
const FOURSQUARE_API_VERSION = '2025-06-17';
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';
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

async function handleVenues(event) {
  const { destination, lat, lng, activity } = event.queryStringParameters || {};

  if (!lat || !lng) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing lat and lng parameters' }),
      headers: { 'Content-Type': 'application/json' },
    };
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

    for (const activity of categoriesToFetch) {
      try {
        const fsqCategoryId = activity.id;

        const res = await axios.get(
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
        );

        if (res.data.results && res.data.results.length > 0) {
          const firstPlace = res.data.results[0];
          log.info('Foursquare response details', {
            photoCount: firstPlace.photos ? firstPlace.photos.length : 0,
            photos: firstPlace.photos ? firstPlace.photos.slice(0, 3).map(p => ({ prefix: p.prefix, suffix: p.suffix })) : [],
            latitude: firstPlace.latitude,
            longitude: firstPlace.longitude,
            location: firstPlace.location,
            social_media: firstPlace.social_media ? Object.keys(firstPlace.social_media) : [],
          });
          const venues = res.data.results.map(place => {
            const photoUrl = place.photos?.[0]?.prefix
              ? `${place.photos[0].prefix}300x300${place.photos[0].suffix}`
              : null;

            const categoryName = place.categories?.[0]?.name || activity.name;

            // Extract Instagram URL from social_media field
            let instagramUrl = null;
            if (place.social_media && typeof place.social_media === 'object') {
              // social_media might be an object with keys like 'instagram'
              if (place.social_media.instagram) {
                instagramUrl = place.social_media.instagram;
              }
            }

            log.info('Venue data', {
              name: place.name,
              photoCount: place.photos ? place.photos.length : 0,
              photoUrl: photoUrl,
              location: {
                lat: place.latitude,
                lng: place.longitude,
                formatted_address: place.location?.formatted_address,
              },
              hasSocialMedia: !!place.social_media,
              socialMediaKeys: place.social_media ? Object.keys(place.social_media) : [],
              instagramUrl: instagramUrl,
            });

            return {
              fsq_id: place.fsq_place_id,
              name: place.name,
              category: categoryName,
              rating: place.rating || 0,
              reviewCount: place.review_count || 0,
              address: place.location?.formatted_address || '',
              lat: place.latitude || null,
              lng: place.longitude || null,
              instagramUrl: instagramUrl,
              photoUrl: photoUrl,
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

          // Sort venues by rating (descending) then by review count (descending)
          venues.sort((a, b) => {
            // Primary sort: rating (highest first)
            if (b.rating !== a.rating) {
              return b.rating - a.rating;
            }
            // Secondary sort: review count (most reviews first)
            return b.reviewCount - a.reviewCount;
          });

          if (venues.length > 0) {
            categories.push({
              category: formatCategory(activity.name),
              venues: venues,
            });
          }
        }
      } catch (catErr) {
        log.warn('Category fetch failed', {
          activity: activity.name,
          error: catErr.message,
          status: catErr.response?.status,
          data: catErr.response?.data,
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
