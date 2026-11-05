'use strict';

const crypto = require('crypto');
const { Pool } = require('pg');
const { searchVenues } = require('./venue-enrichment/foursquare');
const { formatVenueForPrompt } = require('./venue-enrichment/venue-model');
const auth = require('./auth');
const rateLimit = require('./rate-limit');

// ─── Database connection pool ────────────────────────────────────────────────
let pool;
const getDB = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: 5432,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
};

// ─── Standard API responses ──────────────────────────────────────────────────
const response = (statusCode, body, extraHeaders = {}) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,GET,PUT,DELETE,OPTIONS',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

const ok          = (data)             => response(200, { success: true, data });
const created     = (data)             => response(201, { success: true, data });
const badRequest  = (msg, errors = []) => response(400, { success: false, message: msg, errors });
const unauthorized= (msg = 'Unauthorized') => response(401, { success: false, message: msg });
const forbidden   = (msg = 'Forbidden') => response(403, { success: false, message: msg });
const notFound    = (msg = 'Not found')=> response(404, { success: false, message: msg });
const serverError = (msg = 'Internal server error') => response(500, { success: false, message: msg });

/** 401/403 from an AuthError, in the standard response shape. */
const authFailure = (err) => response(err.statusCode, auth.authErrorBody(err));

/** 429 with Retry-After, in the standard response shape. */
const tooManyRequests = (retryAfterSeconds) =>
  response(429, rateLimit.rateLimitBody(retryAfterSeconds), { 'Retry-After': String(retryAfterSeconds) });

// ─── Input validation ────────────────────────────────────────────────────────
// email is no longer accepted from the request body — it comes from the verified token.
const validateFormInput = (body) => {
  const errors = [];
  const required = ['destination', 'days', 'budget', 'currency', 'travelerType'];
  required.forEach(field => { if (!body[field]) errors.push(`${field} is required`); });
  if (body.days && (isNaN(body.days) || body.days < 1 || body.days > 30)) errors.push('Days must be between 1 and 30');
  if (body.budget && (isNaN(body.budget) || body.budget < 0)) errors.push('Budget must be a positive number');
  if (typeof body.destination === 'string' && body.destination.length > 200) errors.push('Destination is too long');
  if (typeof body.interests === 'string' && body.interests.length > 2000) errors.push('Interests is too long');
  if (typeof body.userMustDos === 'string' && body.userMustDos.length > 2000) errors.push('Must-dos is too long');
  return errors;
};

// ─── Utilities ───────────────────────────────────────────────────────────────
// Submission IDs double as share-link secrets (see profile getItinerary), so the random
// part must come from a CSPRNG. 96 random bits; the timestamp prefix keeps IDs sortable.
const generateId = () => `wz_${Date.now().toString(36)}_${crypto.randomBytes(12).toString('base64url')}`;
const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AUD: 'A$', CAD: 'C$', SGD: 'S$', JPY: '¥' };
const getCurrencySymbol = (code) => CURRENCY_SYMBOLS[code] || code;

// ─── Logger ───────────────────────────────────────────────────────────────────
const log = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'INFO',  msg, ...meta, ts: new Date().toISOString() })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'WARN',  msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'ERROR', msg, ...meta, ts: new Date().toISOString() })),
};

// ─── Foursquare venue enrichment ─────────────────────────────────────────────
// Adapters live in ./venue-enrichment/ — see foursquare.js, venue-model.js
// google-places.js is a stub ready for future activation.

/**
 * Fetch real venue names near a destination for Claude prompt injection.
 * Returns a formatted string of venues or null if unavailable.
 * Used by: itinerary-gen Lambda
 *
 * @param {String} destination — e.g. "Ubud, Bali"
 * @returns {Promise<String|null>}
 */
const fetchFoursquareTips = async (destination) => {
  const venues = await searchVenues(destination, { limit: 15 });
  if (!venues.length) return null;

  const tips = venues.slice(0, 10).map(formatVenueForPrompt).join('\n');

  // Log what's being passed to Claude
  const socialCount = venues.slice(0, 10).filter(v => v.social).length;
  console.log(JSON.stringify({
    level: 'INFO',
    msg: '[FoursquareTips] Formatted for Claude prompt',
    destination,
    venuesCount: venues.slice(0, 10).length,
    venuesWithSocial: socialCount,
    tipsPreview: tips.split('\n').slice(0, 3),
    ts: new Date().toISOString()
  }));

  return tips;
};

/**
 * Fetch structured venue array for recommendations_cache population.
 * Used by: weekly-cache Lambda
 *
 * @param {String} destination — e.g. "Ubud, Bali"
 * @returns {Promise<Venue[]>}
 */
const fetchFoursquareVenues = async (destination) => {
  return searchVenues(destination, { limit: 10 });
};

// ─── OpenTripMap — quality scoring (replaces Amadeus POI API) ────────────────
// Amadeus POI API no longer available to independent developers.
// OpenTripMap: free, 5000 calls/day, equivalent POI scoring.
// Sign up at: opentripmap.io
const fetchAmadeusScore = async (lat, lng) => {
  const key = process.env.OPENTRIPMAP_API_KEY;
  if (!key) return 50;
  try {
    const res = await fetch(
      `https://api.opentripmap.com/0.1/en/places/radius?radius=10000&lon=${lng}&lat=${lat}&kinds=cultural,natural,historic&limit=20&apikey=${key}`
    );
    const data = await res.json();
    if (!data.features?.length) return 50;
    const scores = data.features
      .filter(f => f.properties?.rate)
      .map(f => f.properties.rate);
    if (!scores.length) return 50;
    return Math.min(100, Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 14));
  } catch { return 50; }
};

// Kept for backward compatibility — not used with OpenTripMap
const getAmadeusToken = async () => null;

module.exports = {
  getDB, ok, created, badRequest, unauthorized, forbidden, notFound, serverError,
  authFailure, tooManyRequests,
  validateFormInput, generateId, getCurrencySymbol, log,
  fetchFoursquareTips,
  fetchFoursquareVenues,
  fetchAmadeusScore,
  getAmadeusToken,
  // auth
  AuthError: auth.AuthError,
  requireUser: auth.requireUser,
  optionalUser: auth.optionalUser,
  authErrorBody: auth.authErrorBody,
  // rate limiting
  checkRateLimit: rateLimit.checkRateLimit,
  userSubject: rateLimit.userSubject,
  ipSubject: rateLimit.ipSubject,
  rateLimitBody: rateLimit.rateLimitBody,
};
