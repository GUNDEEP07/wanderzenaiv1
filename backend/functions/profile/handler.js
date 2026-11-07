'use strict';
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { log, getDB, requireUser, AuthError, authErrorBody } = require('/opt/nodejs/index');
const Stripe = require('stripe');

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const PDF_BUCKET = process.env.PDF_BUCKET;

const json = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

async function getPdfUrl(submissionId) {
  if (!PDF_BUCKET || !submissionId) return null;
  try {
    const cmd = new GetObjectCommand({ Bucket: PDF_BUCKET, Key: `${submissionId}.pdf` });
    return await getSignedUrl(s3, cmd, { expiresIn: 86400 });
  } catch {
    return null;
  }
}

// ─── GET /itinerary?id= — public by design ───────────────────────────────────
// Share links must work without sign-in. The submission ID is the share secret, so new IDs
// are generated with a CSPRNG (shared layer generateId). No caller identity is read here.
async function getItinerary(event, db) {
  const submissionId = event.queryStringParameters?.id;
  if (!submissionId || submissionId.length > 64) {
    return json(400, { error: 'Missing id parameter' });
  }

  try {
    const submissionResult = await db.query(
      'SELECT destination, days, status, created_at FROM submissions WHERE id = $1',
      [submissionId]
    );
    if (submissionResult.rows.length === 0) return json(404, { error: 'Not found' });

    const itinResult = await db.query(
      'SELECT itinerary_data FROM itineraries WHERE submission_id = $1 LIMIT 1',
      [submissionId]
    );
    if (itinResult.rows.length === 0) return json(404, { error: 'Itinerary not generated yet' });

    const submission = submissionResult.rows[0];
    return json(200, {
      submissionId,
      destination: submission.destination,
      days: submission.days,
      status: submission.status,
      createdAt: submission.created_at,
      itinerary: itinResult.rows[0].itinerary_data,
    });
  } catch (err) {
    log.error('Get itinerary failed', { error: err.message });
    return json(500, { error: 'Failed to load itinerary' });
  }
}

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'WZ';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/**
 * Only allow Stripe to send the user back to our own site. An attacker-supplied return_url
 * would turn the billing portal into a redirect to a phishing page.
 */
function safeReturnUrl(requested) {
  const fallback = `${process.env.FRONTEND_URL || ''}/settings`;
  if (!requested || !process.env.FRONTEND_URL) return fallback;
  try {
    const target = new URL(requested);
    const allowed = new URL(process.env.FRONTEND_URL);
    return target.origin === allowed.origin ? target.toString() : fallback;
  } catch {
    return fallback;
  }
}

async function handleCustomerPortal(event, db, email) {
  if (!stripe) return json(503, { error: 'Billing not configured' });
  try {
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

    const userRow = await db.query('SELECT stripe_customer_id FROM users WHERE email = $1', [email]);
    const customerId = userRow.rows[0]?.stripe_customer_id;
    if (!customerId) return json(400, { error: 'No active subscription found' });

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: safeReturnUrl(body.returnUrl),
    });
    return json(200, { url: session.url });
  } catch (err) {
    log.error('Customer portal failed', { error: err.message });
    return json(500, { error: 'Could not open billing portal' });
  }
}

const PROFILE_SELECT = `
  SELECT email, name, gender, age, whatsapp, home_city, language,
         onboarding_complete, plan, referral_code, itineraries_remaining,
         (SELECT COUNT(*) FROM users WHERE referred_by = users.referral_code) as referral_count
  FROM users WHERE email = $1`;

async function handleGetProfile(db, user) {
  const { email } = user;
  try {
    let userResult;
    try {
      userResult = await db.query(PROFILE_SELECT, [email]);

      // First dashboard visit after sign-in: create the row.
      if (userResult.rows.length === 0) {
        try {
          await db.query(
            `INSERT INTO users (email, firebase_uid) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
            [email, user.uid]
          );
          userResult = await db.query(PROFILE_SELECT, [email]);
        } catch { /* graceful */ }
      }

      // No name saved yet (Google sign-in, or onboarding skipped): take it from the sign-in.
      // Only fills an empty name — a name changed in Settings is never overwritten.
      if (userResult.rows.length > 0 && !userResult.rows[0].name?.trim() && user.name) {
        try {
          const { rowCount } = await db.query(
            `UPDATE users SET name = $2 WHERE email = $1 AND (name IS NULL OR btrim(name) = '')`,
            [email, user.name]
          );
          if (rowCount) userResult.rows[0].name = user.name;
        } catch { /* best-effort */ }
      }

      if (userResult.rows.length > 0 && !userResult.rows[0].referral_code) {
        const code = generateReferralCode();
        try {
          await db.query('UPDATE users SET referral_code = $1 WHERE email = $2', [code, email]);
          userResult.rows[0].referral_code = code;
        } catch { /* collision — will try next time */ }
      }
    } catch {
      // Fall back to base columns if the profile migration has not run.
      userResult = await db.query(`SELECT email, plan FROM users WHERE email = $1`, [email]);
    }

    const [tripsResult, rolesResult] = await Promise.all([
      db.query(
        `SELECT s.id, s.destination, s.days, s.status, s.created_at,
                i.id AS itinerary_id
         FROM submissions s
         LEFT JOIN itineraries i ON i.submission_id = s.id
         WHERE s.email = $1
         ORDER BY s.created_at DESC LIMIT 20`,
        [email]
      ),
      db.query(
        `SELECT r.name FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         JOIN users u ON u.id = ur.user_id
         WHERE u.email = $1`,
        [email]
      ).catch(() => ({ rows: [] })),
    ]);

    const pastTrips = await Promise.all(
      tripsResult.rows.map(async row => ({
        id:           row.id,
        destination:  row.destination,
        days:         row.days,
        status:       row.status,
        createdAt:    row.created_at,
        hasItinerary: !!row.itinerary_id,
        pdfUrl:       row.status === 'email_sent' ? await getPdfUrl(row.id) : null,
      }))
    );

    if (userResult.rows.length === 0) return json(200, { exists: false, pastTrips });

    return json(200, {
      exists: true,
      profile: userResult.rows[0],
      pastTrips,
      roles: rolesResult.rows.map(r => r.name),
    });
  } catch (err) {
    log.error('Profile GET failed', { error: err.message });
    return json(500, { error: 'Failed to load profile' });
  }
}

// ─── PUT /profile input validation ───────────────────────────────────────────
const GENDERS = new Set(['Male', 'Female', 'Other', 'male', 'female', 'other']);

function cleanString(value, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined; // signals invalid
  const trimmed = value.trim();
  if (trimmed.length > max) return undefined;
  return trimmed === '' ? null : trimmed;
}

function validateProfileInput(body) {
  const errors = [];
  const out = {};

  const strings = { name: 120, home_city: 120, language: 50, whatsapp: 30, referred_by: 20 };
  for (const [field, max] of Object.entries(strings)) {
    const v = cleanString(body[field], max);
    if (v === undefined) errors.push(`${field} must be text of at most ${max} characters`);
    else out[field] = v;
  }

  if (body.gender === undefined || body.gender === null || body.gender === '') out.gender = null;
  else if (GENDERS.has(body.gender)) out.gender = body.gender;
  else errors.push('gender is invalid');

  if (body.age === undefined || body.age === null || body.age === '') out.age = null;
  else {
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 1 || age > 120) errors.push('age must be a whole number between 1 and 120');
    else out.age = age;
  }

  if (body.onboarding_complete === undefined || body.onboarding_complete === null) out.onboarding_complete = null;
  else if (typeof body.onboarding_complete === 'boolean') out.onboarding_complete = body.onboarding_complete;
  else errors.push('onboarding_complete must be true or false');

  return { errors, values: out };
}

async function handlePutProfile(event, db, user) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  const { errors, values } = validateProfileInput(body);
  if (errors.length) return json(400, { error: 'Validation failed', errors });

  try {
    // email and firebase_uid come from the verified token — never from the body.
    await db.query(
      `INSERT INTO users (email, name, gender, age, whatsapp, home_city, language, firebase_uid, onboarding_complete, referred_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (email) DO UPDATE SET
         name                = COALESCE(EXCLUDED.name, users.name),
         gender              = COALESCE(EXCLUDED.gender, users.gender),
         age                 = COALESCE(EXCLUDED.age, users.age),
         whatsapp            = COALESCE(EXCLUDED.whatsapp, users.whatsapp),
         home_city           = COALESCE(EXCLUDED.home_city, users.home_city),
         language            = COALESCE(EXCLUDED.language, users.language),
         firebase_uid        = COALESCE(EXCLUDED.firebase_uid, users.firebase_uid),
         onboarding_complete = COALESCE(EXCLUDED.onboarding_complete, users.onboarding_complete),
         referred_by         = COALESCE(users.referred_by, EXCLUDED.referred_by),
         updated_at          = NOW()`,
      [user.email, values.name, values.gender, values.age, values.whatsapp,
       values.home_city, values.language, user.uid, values.onboarding_complete, values.referred_by]
    );
    return json(200, { ok: true });
  } catch (err) {
    log.error('Profile PUT failed', { error: err.message });
    return json(500, { error: 'Failed to save profile' });
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS' }, body: '' };
  }

  const db = getDB();
  const path = event.path || event.resource || '';

  // /itinerary is public — shareable links work without auth
  if (path.includes('/itinerary')) return getItinerary(event, db);

  let user;
  try {
    user = await requireUser(event);
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Profile auth rejected', { code: err.code, path });
      return json(err.statusCode, authErrorBody(err));
    }
    log.error('Profile auth misconfigured', { error: err.message });
    return json(500, { error: 'Authentication is temporarily unavailable' });
  }

  if (path.includes('/customer-portal') && event.httpMethod === 'POST') {
    return handleCustomerPortal(event, db, user.email);
  }
  if (event.httpMethod === 'GET') return handleGetProfile(db, user);
  if (event.httpMethod === 'PUT') return handlePutProfile(event, db, user);

  return json(405, { error: 'Method not allowed' });
};

// Exported for unit tests.
exports._internal = { validateProfileInput, safeReturnUrl };
