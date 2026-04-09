'use strict';

const { Pool } = require('pg');

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
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    ...extraHeaders,
  },
  body: JSON.stringify(body),
});

const ok          = (data)             => response(200, { success: true, data });
const created     = (data)             => response(201, { success: true, data });
const badRequest  = (msg, errors = []) => response(400, { success: false, message: msg, errors });
const unauthorized= (msg = 'Unauthorized') => response(401, { success: false, message: msg });
const notFound    = (msg = 'Not found')=> response(404, { success: false, message: msg });
const serverError = (msg = 'Internal server error') => response(500, { success: false, message: msg });

// ─── Input validation ────────────────────────────────────────────────────────
const validateFormInput = (body) => {
  const errors = [];
  const required = ['destination', 'days', 'budget', 'currency', 'travelerType', 'email'];
  required.forEach(field => { if (!body[field]) errors.push(`${field} is required`); });
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.push('Invalid email address');
  if (body.days && (isNaN(body.days) || body.days < 1 || body.days > 30)) errors.push('Days must be between 1 and 30');
  if (body.budget && (isNaN(body.budget) || body.budget < 0)) errors.push('Budget must be a positive number');
  return errors;
};

// ─── Utilities ───────────────────────────────────────────────────────────────
const generateId = () => `wz_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
const CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', INR: '₹', AUD: 'A$', CAD: 'C$', SGD: 'S$', JPY: '¥' };
const getCurrencySymbol = (code) => CURRENCY_SYMBOLS[code] || code;

// ─── Logger ───────────────────────────────────────────────────────────────────
const log = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'INFO',  msg, ...meta, ts: new Date().toISOString() })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'WARN',  msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'ERROR', msg, ...meta, ts: new Date().toISOString() })),
};

// ─── Foursquare categories ────────────────────────────────────────────────────
const FS_CATEGORIES = '13032,12061,16032,16020,12096,16009,13065';

// ─── fetchFoursquareTips — used by itinerary-gen (prompt enrichment) ──────────
// Single source of truth — itinerary-gen imports this instead of defining locally
const fetchFoursquareTips = async (destination) => {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return null;
  try {
    const geoRes = await fetch(
      `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(destination)}&limit=1`,
      { headers: { Authorization: key, Accept: 'application/json' } }
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return null;
    const { lat, lng } = geoData.results[0].geocodes.main;

    const spotsRes = await fetch(
      `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&categories=${FS_CATEGORIES}&limit=15&sort=POPULARITY&fields=name,location,tips,categories,description`,
      { headers: { Authorization: key, Accept: 'application/json' } }
    );
    const spotsData = await spotsRes.json();
    if (!spotsData.results?.length) return null;

    const gems = spotsData.results
      .filter(p => p.tips?.length || p.description)
      .slice(0, 10)
      .map(p => ({
        name: p.name,
        cat: p.categories?.[0]?.name || 'Local spot',
        tip: p.tips?.[0]?.text || p.description || '',
        area: p.location?.neighborhood || p.location?.locality || '',
      }))
      .filter(p => p.tip.length > 20);

    if (!gems.length) return null;
    return gems.map(g => `- ${g.name} (${g.cat}${g.area ? `, ${g.area}` : ''}): "${g.tip}"`).join('\n');
  } catch { return null; }
};

// ─── fetchFoursquareVenues — used by weekly-cache Lambda ─────────────────────
// Returns structured array for recommendations_cache population
const fetchFoursquareVenues = async (destination) => {
  const key = process.env.FOURSQUARE_API_KEY;
  if (!key) return [];
  try {
    const geoRes = await fetch(
      `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(destination)}&limit=1`,
      { headers: { Authorization: key, Accept: 'application/json' } }
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return [];
    const { lat, lng } = geoData.results[0].geocodes.main;

    const spotsRes = await fetch(
      `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&categories=${FS_CATEGORIES}&limit=10&sort=POPULARITY&fields=name,location,tips,categories,rating`,
      { headers: { Authorization: key, Accept: 'application/json' } }
    );
    const data = await spotsRes.json();
    return (data.results || []).slice(0, 5).map(p => ({
      name: p.name,
      category: p.categories?.[0]?.name || '',
      tip: p.tips?.[0]?.text || '',
      rating: p.rating || null,
    }));
  } catch { return []; }
};

// ─── Amadeus — quality scoring ────────────────────────────────────────────────
let amadeusToken = null;
let amadeusTokenExpiry = 0;

const getAmadeusToken = async () => {
  if (amadeusToken && Date.now() < amadeusTokenExpiry) return amadeusToken;
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;
  if (!key || !secret) return null;
  try {
    const res = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${key}&client_secret=${secret}`,
    });
    const data = await res.json();
    amadeusToken = data.access_token;
    amadeusTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return amadeusToken;
  } catch { return null; }
};

const fetchAmadeusScore = async (lat, lng) => {
  const token = await getAmadeusToken();
  if (!token) return 50;
  try {
    const res = await fetch(
      `https://test.api.amadeus.com/v1/reference-data/locations/pois?latitude=${lat}&longitude=${lng}&radius=20&page[limit]=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.data?.length) return 50;
    const scores = data.data.filter(p => p.rank).map(p => p.rank);
    if (!scores.length) return 50;
    return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10);
  } catch { return 50; }
};

module.exports = {
  getDB, ok, created, badRequest, unauthorized, notFound, serverError,
  validateFormInput, generateId, getCurrencySymbol, log,
  fetchFoursquareTips,
  fetchFoursquareVenues,
  fetchAmadeusScore,
  getAmadeusToken,
};
