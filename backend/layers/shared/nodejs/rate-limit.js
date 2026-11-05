'use strict';

/**
 * Fixed-window rate limiter backed by Postgres (table: rate_limits, migration 002).
 *
 * Why Postgres: every limited Lambda already holds a pool to RDS, so this adds no new
 * infrastructure. One atomic upsert per rule per request; the row count stays tiny because
 * expired windows are pruned opportunistically.
 *
 * This is the per-identity layer. API Gateway stage throttling and the WAF per-IP rule in
 * infra/template.yaml are the coarse backstops in front of it.
 */

const crypto = require('crypto');

/**
 * Limits per bucket. Each bucket may have several windows; all must pass.
 * Override any bucket at deploy time with RATE_LIMITS_JSON, e.g.
 *   {"submit":[{"limit":5,"windowSeconds":3600}]}
 */
const DEFAULT_LIMITS = Object.freeze({
  // Signed-in, Claude-backed
  preview:      [{ limit: 30, windowSeconds: 3600 }, { limit: 100, windowSeconds: 86400 }],
  submit:       [{ limit: 10, windowSeconds: 3600 }, { limit: 30, windowSeconds: 86400 }],
  chat:         [{ limit: 60, windowSeconds: 3600 }, { limit: 300, windowSeconds: 86400 }],
  personalised: [{ limit: 30, windowSeconds: 3600 }],
  welcome:      [{ limit: 2, windowSeconds: 86400 }],
  // Public, Claude-backed — keyed by hashed client IP
  trending:     [{ limit: 30, windowSeconds: 3600 }],
  insights:     [{ limit: 60, windowSeconds: 3600 }],
  aiVenues:     [{ limit: 60, windowSeconds: 3600 }],
});

const PRUNE_PROBABILITY = 0.01;
const PRUNE_AFTER = '2 days';

function loadLimits() {
  const raw = process.env.RATE_LIMITS_JSON;
  if (!raw) return DEFAULT_LIMITS;
  try {
    return { ...DEFAULT_LIMITS, ...JSON.parse(raw) };
  } catch {
    console.error(JSON.stringify({ level: 'ERROR', msg: 'RATE_LIMITS_JSON is not valid JSON; using defaults' }));
    return DEFAULT_LIMITS;
  }
}

const LIMITS = loadLimits();

/** Subject key for a verified user. */
function userSubject(user) {
  return `u:${user.uid}`;
}

/**
 * Subject key for an anonymous caller. The IP is hashed so raw addresses are never stored.
 * API Gateway sets requestContext.identity.sourceIp from the TCP connection, so it cannot
 * be spoofed via X-Forwarded-For.
 */
function ipSubject(event) {
  const ip = event?.requestContext?.identity?.sourceIp || 'unknown';
  return `ip:${crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
}

/**
 * Count this request against every window of `bucket` for `subject`.
 * @param {import('pg').Pool} db
 * @param {string} bucket key of LIMITS
 * @param {string} subject from userSubject() or ipSubject()
 * @param {{ nowMs?: number }} [opts]
 * @returns {Promise<{ allowed: boolean, retryAfterSeconds: number }>}
 */
async function consume(db, bucket, subject, opts = {}) {
  const rules = LIMITS[bucket];
  if (!rules) throw new Error(`Unknown rate-limit bucket: ${bucket}`);

  const nowMs = opts.nowMs ?? Date.now();
  let retryAfterSeconds = 0;

  for (const { limit, windowSeconds } of rules) {
    const windowStartSec = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
    const key = `${bucket}:${windowSeconds}:${subject}`;
    const { rows } = await db.query(
      `INSERT INTO rate_limits (bucket_key, window_start, count)
       VALUES ($1, to_timestamp($2::double precision), 1)
       ON CONFLICT (bucket_key, window_start)
       DO UPDATE SET count = rate_limits.count + 1
       RETURNING count`,
      [key, windowStartSec]
    );
    if (rows[0].count > limit) {
      const resetSec = windowStartSec + windowSeconds - Math.floor(nowMs / 1000);
      retryAfterSeconds = Math.max(retryAfterSeconds, resetSec);
    }
  }

  if (Math.random() < PRUNE_PROBABILITY) {
    db.query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '${PRUNE_AFTER}'`)
      .catch(() => { /* best effort */ });
  }

  return { allowed: retryAfterSeconds === 0, retryAfterSeconds };
}

/**
 * Convenience wrapper: returns null when allowed, or { retryAfterSeconds } when blocked.
 * Fails OPEN on database errors (logged at ERROR) — the API Gateway and WAF limits still
 * apply, and an outage of this table must not take the product down.
 */
async function checkRateLimit(db, bucket, subject, opts) {
  try {
    const result = await consume(db, bucket, subject, opts);
    return result.allowed ? null : { retryAfterSeconds: result.retryAfterSeconds };
  } catch (err) {
    console.error(JSON.stringify({
      level: 'ERROR', msg: 'Rate limiter unavailable — failing open', bucket, error: err.message,
      ts: new Date().toISOString(),
    }));
    return null;
  }
}

/** Standard 429 body. Callers add their own CORS headers. */
function rateLimitBody(retryAfterSeconds) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const message = `You're doing that a lot. Please try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`;
  return { success: false, code: 'RATE_LIMITED', message, error: message, retryAfterSeconds };
}

module.exports = {
  DEFAULT_LIMITS,
  LIMITS,
  userSubject,
  ipSubject,
  consume,
  checkRateLimit,
  rateLimitBody,
};
