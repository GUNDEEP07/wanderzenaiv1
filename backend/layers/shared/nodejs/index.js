'use strict';

const { Pool } = require('pg');

// ─── Database connection pool (reused across warm Lambda invocations) ────────
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

// ─── Standard API response builder ──────────────────────────────────────────
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

const ok = (data) => response(200, { success: true, data });
const created = (data) => response(201, { success: true, data });
const badRequest = (message, errors = []) => response(400, { success: false, message, errors });
const unauthorized = (message = 'Unauthorized') => response(401, { success: false, message });
const notFound = (message = 'Not found') => response(404, { success: false, message });
const serverError = (message = 'Internal server error') => response(500, { success: false, message });

// ─── Input validation ────────────────────────────────────────────────────────
const validateFormInput = (body) => {
  const errors = [];
  const required = ['destination', 'days', 'budget', 'currency', 'travelerType', 'email'];

  required.forEach(field => {
    if (!body[field]) errors.push(`${field} is required`);
  });

  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Invalid email address');
  }

  if (body.days && (isNaN(body.days) || body.days < 1 || body.days > 30)) {
    errors.push('Days must be between 1 and 30');
  }

  if (body.budget && (isNaN(body.budget) || body.budget < 0)) {
    errors.push('Budget must be a positive number');
  }

  return errors;
};

// ─── ID generator ───────────────────────────────────────────────────────────
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `wz_${timestamp}_${random}`;
};

// ─── Currency symbol map ─────────────────────────────────────────────────────
const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', JPY: '¥',
};

const getCurrencySymbol = (code) => CURRENCY_SYMBOLS[code] || code;

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
  info: (msg, meta = {}) => console.log(JSON.stringify({ level: 'INFO', msg, ...meta, ts: new Date().toISOString() })),
  warn: (msg, meta = {}) => console.warn(JSON.stringify({ level: 'WARN', msg, ...meta, ts: new Date().toISOString() })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'ERROR', msg, ...meta, ts: new Date().toISOString() })),
};

module.exports = { getDB, ok, created, badRequest, unauthorized, notFound, serverError, validateFormInput, generateId, getCurrencySymbol, log };
