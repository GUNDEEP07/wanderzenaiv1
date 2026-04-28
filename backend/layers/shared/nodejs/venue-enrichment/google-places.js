'use strict';

/**
 * Google Places API adapter — STUB.
 *
 * Not implemented yet. Activate when paying users justify the cost.
 *
 * What this will provide (free $200/month credit, then pay-per-use):
 * - Venue photos (real venue images, not generic destination shots)
 * - User reviews (text + rating)
 * - Aggregate ratings (1–5)
 * - Price level (1–4)
 * - Opening hours
 * - Place ID (for deep Google Maps links)
 *
 * Estimated cost at WanderZenAI scale:
 * - Place Search: $0.032/call
 * - Place Details (photos + reviews): $0.017/call
 * - At 100 itineraries/day × 10 venues = 1000 calls/day = ~$49/day
 * - Only enable once revenue justifies it
 *
 * Implementation steps when ready:
 * 1. Enable Places API in Google Cloud Console
 * 2. Add GOOGLE_PLACES_API_KEY to GitHub Secrets + template.yaml
 * 3. Implement searchVenues() below using Places API v1 (new)
 * 4. Update itinerary-gen to call googlePlaces.searchVenues() alongside
 *    or instead of foursquare.searchVenues()
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service
 */

// eslint-disable-next-line no-unused-vars
const { buildVenue } = require('./venue-model');

/**
 * FUTURE: Search for venues via Google Places API.
 * Returns canonical Venue objects with photos + reviews populated.
 *
 * @param {String} destination
 * @param {Object} options
 * @returns {Promise<Venue[]>}
 */
const searchVenues = async (destination, options = {}) => { // eslint-disable-line no-unused-vars
  // TODO: implement when Google Places API is enabled
  // const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  // if (!apiKey) return [];
  // ...
  return [];
};

module.exports = { searchVenues };
