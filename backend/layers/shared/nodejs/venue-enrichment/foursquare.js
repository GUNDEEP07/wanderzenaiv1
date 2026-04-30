'use strict';

const { buildVenue } = require('./venue-model');

/**
 * Foursquare Places API adapter.
 * Endpoint: https://places-api.foursquare.com/places/search
 * Auth: Bearer token via Authorization header + X-Places-Api-Version header
 *
 * Free Pro fields: name, location, categories, tel, website, social_media, link, fsq_place_id
 * Premium fields (NOT free — do not add): photos, tips, ratings, tastes
 *
 * Category IDs sourced from official Foursquare taxonomy CSV
 */

const FSQ_BASE_URL = 'https://places-api.foursquare.com';
const FSQ_API_VERSION = '2025-06-17';

// Category IDs — from official Foursquare taxonomy CSV (personalization-apis-movement-sdk-categories.csv)
const FSQ_CATEGORY_IDS = [
  '63be6904847c3692a84b9bb6', // Cafe, Coffee, and Tea House
  '4bf58dd8d48988d1e0931735', // Coffee Shop
  '4bf58dd8d48988d181941735', // Museum
  '4d4b7104d754a06370d81259', // Arts and Entertainment (parent)
  '4bf58dd8d48988d159941735', // Hiking Trail
  '4bf58dd8d48988d163941735', // Park
  '4d4b7105d754a06377d81259', // Landmarks and Outdoors (parent)
  '4deefb944765f83613cdba6e', // Historic and Protected Site
  '4bf58dd8d48988d13a941735', // Temple
  '4bf58dd8d48988d165941735', // Scenic Lookout
  '4bf58dd8d48988d15a941735', // Garden
  '53e510b7498ebcb1801b55d4', // Night Market
].join(',');

/**
 * Build request headers for Foursquare Places API.
 * Bearer prefix required for places-api.foursquare.com.
 */
const buildHeaders = (apiKey) => ({
  'Authorization': `Bearer ${apiKey}`,
  'X-Places-Api-Version': FSQ_API_VERSION,
  'Accept': 'application/json',
});

/**
 * Map a raw Foursquare place result to a canonical Venue object.
 * social_media is a plain object with instagram, twitter, facebook_id fields.
 */
const toVenue = (fsqPlace) => {
  const base = buildVenue({
    name:     fsqPlace.name,
    category: fsqPlace.categories?.[0]?.name || '',
    address:  fsqPlace.location?.formatted_address || fsqPlace.location?.address || '',
    area:     fsqPlace.location?.locality || fsqPlace.location?.region || '',
    country:  fsqPlace.location?.country || '',
    tastes:   [], // Premium field — not available on free Pro tier
  });

  return {
    ...base,
    // Verified Foursquare identifiers
    fsqPlaceId:    fsqPlace.fsq_place_id || null,
    foursquareUrl: fsqPlace.link ? `https://foursquare.com${fsqPlace.link}` : null,
    tel:           fsqPlace.tel || null,
    website:       fsqPlace.website || null,
    social:        fsqPlace.social_media || null,
  };
};

/**
 * Search for venues near a destination.
 * Uses `near` param for geocoding — no separate geo lookup needed.
 * Falls back to empty array on any error — never blocks itinerary generation.
 *
 * @param {string} destination — e.g. "Sydney, Australia" or "Kyoto, Japan"
 * @param {object} options
 * @param {number} options.limit — max results, 1-50 (default 15)
 * @returns {Promise<object[]>} array of canonical Venue objects
 */
const searchVenues = async (destination, { limit = 15 } = {}) => {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    console.warn('[Foursquare] FOURSQUARE_API_KEY not set — skipping venue enrichment');
    return [];
  }

  try {
    const params = new URLSearchParams({
      near:            destination,
      limit:           String(Math.min(limit, 50)),
      sort:            'POPULARITY',
      fields:          'name,location,categories,tel,website,social_media,link,fsq_place_id',
      fsq_category_ids: FSQ_CATEGORY_IDS,
    });

    const res = await fetch(
      `${FSQ_BASE_URL}/places/search?${params}`,
      { headers: buildHeaders(apiKey) }
    );

    if (!res.ok) {
      console.warn(`[Foursquare] Search failed: HTTP ${res.status} for "${destination}"`);
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
