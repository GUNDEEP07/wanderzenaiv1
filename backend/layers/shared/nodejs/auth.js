'use strict';

/**
 * Firebase ID token verification — the ONLY place the backend decides who a caller is.
 *
 * Implements the checks Firebase documents for verifying ID tokens with a third-party
 * JWT library (https://firebase.google.com/docs/auth/admin/verify-id-tokens):
 *   - header.alg === 'RS256' and header.kid matches a current Google signing cert
 *   - RS256 signature valid against that cert
 *   - exp in the future, iat and auth_time in the past
 *   - aud === Firebase project ID, iss === https://securetoken.google.com/<projectId>
 *   - sub is a non-empty string (the Firebase uid)
 *
 * On top of that we require email_verified === true by default. Without it, anyone can
 * register an email/password account using someone else's address and receive a validly
 * signed token carrying that email — which is the key we use to look up profiles, trips,
 * PDFs and Stripe customers.
 *
 * Uses only Node built-ins (crypto + global fetch), so the layer gains no dependencies.
 */

const crypto = require('crypto');

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const CLOCK_SKEW_SECONDS = 30;
const DEFAULT_CERT_TTL_MS = 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 4096;

class AuthError extends Error {
  /**
   * @param {number} statusCode 401 (identity unknown) or 403 (identity known, not allowed)
   * @param {string} code machine-readable reason, safe to return to clients
   * @param {string} message human-readable message, safe to return to clients
   */
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

// ─── Google signing certs (cached per Lambda container) ──────────────────────
let certCache = { certs: null, expiresAt: 0 };

async function fetchGoogleCerts() {
  const res = await fetch(GOOGLE_CERTS_URL, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(`Google certs fetch failed: ${res.status}`);
  const certs = await res.json();
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  const ttlMs = maxAge ? Number(maxAge[1]) * 1000 : DEFAULT_CERT_TTL_MS;
  return { certs, ttlMs };
}

async function getSigningCerts(forceRefresh = false) {
  if (!forceRefresh && certCache.certs && Date.now() < certCache.expiresAt) return certCache.certs;
  const { certs, ttlMs } = await fetchGoogleCerts();
  certCache = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

/** Test hook: replace the cert source. Never used in production code paths. */
function __setCertsForTesting(certs, ttlMs = DEFAULT_CERT_TTL_MS) {
  certCache = { certs, expiresAt: certs ? Date.now() + ttlMs : 0 };
}

// ─── Token parsing ───────────────────────────────────────────────────────────
function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

function extractBearerToken(event) {
  const headers = event?.headers || {};
  const raw = headers.Authorization || headers.authorization || '';
  const match = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return match ? match[1] : null;
}

/**
 * Verify a Firebase ID token.
 * @param {string} token
 * @param {{ projectId: string, requireEmailVerified?: boolean, nowSeconds?: number }} opts
 * @returns {Promise<{ uid: string, email: string|null, emailVerified: boolean, signInProvider: string|null }>}
 * @throws {AuthError}
 */
async function verifyIdToken(token, opts) {
  const { projectId, requireEmailVerified = true } = opts || {};
  if (!projectId) {
    // Fail closed: without a project ID we cannot check aud/iss, and a token from ANY
    // Firebase project would otherwise pass.
    throw new Error('FIREBASE_PROJECT_ID is not configured');
  }
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) {
    throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');
  }

  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');

  let header;
  let payload;
  try {
    header = decodeSegment(parts[0]);
    payload = decodeSegment(parts[1]);
  } catch {
    throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');
  }

  let certs = await getSigningCerts();
  if (!certs[header.kid]) {
    // Google rotates keys; a new kid can appear before our cache expires.
    certs = await getSigningCerts(true);
  }
  const cert = certs[header.kid];
  if (!cert) throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');

  let signatureValid = false;
  try {
    signatureValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      crypto.createPublicKey(cert),
      Buffer.from(parts[2], 'base64url')
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');

  // Claims are only trusted after the signature check above.
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_SECONDS <= now) {
    throw new AuthError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
  }
  if (typeof payload.iat !== 'number' || payload.iat - CLOCK_SKEW_SECONDS > now) {
    throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');
  }
  if (payload.auth_time !== undefined &&
      (typeof payload.auth_time !== 'number' || payload.auth_time - CLOCK_SKEW_SECONDS > now)) {
    throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');
  }
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new AuthError(401, 'TOKEN_INVALID', 'Invalid authentication token');
  }

  const email = typeof payload.email === 'string' ? payload.email : null;
  const emailVerified = payload.email_verified === true;

  if (requireEmailVerified && (!email || !emailVerified)) {
    throw new AuthError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email address first. Check your inbox for the verification link.'
    );
  }

  return {
    uid: payload.sub,
    email,
    emailVerified,
    signInProvider: payload.firebase?.sign_in_provider || null,
  };
}

function authConfigFromEnv(overrides = {}) {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    requireEmailVerified: process.env.REQUIRE_EMAIL_VERIFIED !== 'false',
    ...overrides,
  };
}

/**
 * Resolve the caller or throw. Use on every endpoint that reads or writes user data.
 * @param {object} event API Gateway proxy event
 * @param {{ requireEmailVerified?: boolean }} [overrides]
 */
async function requireUser(event, overrides) {
  const token = extractBearerToken(event);
  if (!token) throw new AuthError(401, 'AUTH_REQUIRED', 'Please sign in to continue.');
  return verifyIdToken(token, authConfigFromEnv(overrides));
}

/**
 * Resolve the caller if a valid token is present, else null. For public endpoints that
 * personalise when signed in. A present-but-invalid token is treated as anonymous.
 */
async function optionalUser(event, overrides) {
  const token = extractBearerToken(event);
  if (!token) return null;
  try {
    return await verifyIdToken(token, authConfigFromEnv(overrides));
  } catch (err) {
    if (err instanceof AuthError) return null;
    throw err;
  }
}

/** Client-safe JSON body for an AuthError. */
function authErrorBody(err) {
  return { success: false, code: err.code, message: err.message, error: err.message };
}

module.exports = {
  AuthError,
  verifyIdToken,
  requireUser,
  optionalUser,
  extractBearerToken,
  authErrorBody,
  __setCertsForTesting,
};
