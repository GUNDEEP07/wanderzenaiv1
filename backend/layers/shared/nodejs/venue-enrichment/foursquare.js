'use strict';

const { buildVenue } = require('./venue-model');

/**
 * Foursquare Places API adapter.
 * Base URL: https://places-api.foursquare.com
 * Auth: Bearer token via Authorization header
 * Version: X-Places-Api-Version: 2025-06-17
 *
 * Free tier (after June 1 2026): 500 Pro calls/month
 * Pro fields (free): name, location, categories, tastes
 * Premium fields (NOT free — do not use): photos, tips, ratings, hours
 *
 * Docs: https://docs.foursquare.com/developer/reference/places-api-overview
 */

const FSQ_BASE_URL = 'https://places-api.foursquare.com';
const FSQ_API_VERSION = '2025-06-17';

// Category IDs for slow travel use cases
// Full taxonomy: https://docs.foursquare.com/data-products/docs/categories
const FSQ_CATEGORY_IDS = [
  '13000', // Food & Dining — cafes, restaurants, local markets
  '16000', // Outdoors & Recreation — trails, parks, nature
  '10000', // Arts & Entertainment — temples, museums, galleries
  '19000', // Travel & Landmarks — historical sites, viewpoints
].join(',');

/**
 * Build Foursquare request headers.
 * @param {String} apiKey
 * @returns {Object}
 */
const buildHeaders = (apiKey) => ({
  'Authorization': `Bearer ${apiKey}`,
  'X-Places-Api-Version': FSQ_API_VERSION,
  'Accept': 'application/json',
});

/**
 * Convert a raw Foursquare place result to a canonical Venue.
 * @param {Object} fsqPlace — raw result from Foursquare API
 * @returns {Venue}
 */
const toVenue = (fsqPlace) => buildVenue({
  name:     fsqPlace.name,
  category: fsqPlace.categories?.[0]?.name || '',
  address:  fsqPlace.location?.formatted_address || fsqPlace.location?.address || '',
  area:     fsqPlace.location?.locality || fsqPlace.location?.region || '',
  country:  fsqPlace.location?.country || '',
  tastes:   fsqPlace.tastes || [],
  // FUTURE: map fsqPlace.photos, fsqPlace.tips, fsqPlace.rating
  // when Foursquare Premium tier is enabled
});

/**
 * Search for venues near a destination — used by itinerary-gen prompt enrichment.
 * Returns up to 10 canonical Venue objects.
 * Falls back to empty array on any error — never blocks itinerary generation.
 *
 * @param {String} destination — e.g. "Ubud, Bali" or "Kyoto, Japan"
 * @param {Object} options
 * @param {Number} options.limit — max results (default 10, max 50)
 * @returns {Promise<Venue[]>}
 */
const searchVenues = async (destination, { limit = 10 } = {}) => {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      near:            destination,
      limit:           String(Math.min(limit, 50)),
      sort:            'POPULARITY',
      // Pro fields only — no Premium fields (photos, tips, rating)
      fields:          'name,location,categories,tastes',
      fsq_category_ids: FSQ_CATEGORY_IDS,
    });

    const res = await fetch(
      `${FSQ_BASE_URL}/places/search?${params}`,
      { headers: buildHeaders(apiKey) }
    );

    if (!res.ok) {
      // Log but do not throw — venue enrichment is best-effort
      console.warn(`[Foursquare] Search failed: ${res.status} for "${destination}"`);
      return [];
    }

    const data = await res.json();
    return (data.results || []).map(toVenue);
  } catch (err) {
    console.warn(`[Foursquare] searchVenues error: ${err.message}`);
    return [];
  }
};

module.exports = { searchVenues };
