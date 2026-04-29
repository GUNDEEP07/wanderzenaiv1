'use strict';

/**
 * Canonical Venue object used across all enrichment sources.
 *
 * Fields marked FUTURE are null today.
 * When a paid source is added (Google Places, Foursquare Premium),
 * populate them in the adapter — no changes needed to consumers.
 *
 * Consumers (itinerary-gen, weekly-cache, PDF builder) must null-check
 * FUTURE fields before rendering.
 */

/**
 * Build a canonical Venue from raw adapter data.
 * @param {Object} params
 * @returns {Venue}
 */
const buildVenue = ({ name, category, address, area, country, tastes = [] }) => ({
  // ── Core — always populated ────────────────────────────────────────────────
  name:     name || 'Unknown venue',
  category: category || 'Local spot',
  address:  address || '',
  area:     area || '',
  country:  country || '',
  mapsUrl:  buildMapsUrl(name, area, country),
  tastes:   [], // Foursquare Premium field — not available on free Pro tier

  // ── Verified identifiers ──────────────────────────────────────────────────────
  fsqPlaceId:    null,   // Foursquare Place ID — permanent identifier
  foursquareUrl: null,   // https://foursquare.com/placemakers/review-place/{id}
  tel:           null,   // Phone number
  website:       null,   // Official website
  social:        null,   // { instagram, facebook_id, twitter }

  // ── FUTURE — null until paid source added ──────────────────────────────────
  // Populate in the relevant adapter (google-places.js, foursquare-premium.js)
  // when the data source is available. Consumers check for null before rendering.
  photos:     null,   // [String] — array of image URLs
  reviews:    null,   // [{ text: String, rating: Number, source: String }]
  rating:     null,   // Number 1–5 — aggregate rating
  priceLevel: null,   // Number 1–4 ($ to $$$$)
});

/**
 * Construct a Google Maps search URL from venue name + location.
 * Works without a Place ID — sufficient for MVP.
 * FUTURE: replace with Place ID deep link when Google Places is added.
 */
const buildMapsUrl = (name, area, country) => {
  const q = encodeURIComponent(
    [name, area, country].filter(Boolean).join(', ')
  );
  return `https://maps.google.com/?q=${q}`;
};

/**
 * Format a venue for Claude prompt injection.
 * Includes FUTURE fields when populated — no change to prompt builder needed.
 * @param {Venue} venue
 * @returns {String}
 */
const formatVenueForPrompt = (venue) => {
  const parts = [`- ${venue.name} (${venue.category}`];
  if (venue.area) parts[0] += `, ${venue.area}`;
  parts[0] += `)`;
  if (venue.mapsUrl) parts.push(`→ ${venue.mapsUrl}`);
  if (venue.tastes.length) parts.push(`[${venue.tastes.slice(0, 2).join(', ')}]`);
  if (venue.rating) parts.push(`${venue.rating}★`);
  // FUTURE: add photo URL and top review snippet here
  return parts.join(' ');
};

module.exports = { buildVenue, buildMapsUrl, formatVenueForPrompt };
