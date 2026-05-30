'use strict';
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { log, getDB } = require('/opt/nodejs/index');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-2' });
const PDF_BUCKET = process.env.PDF_BUCKET;

function decodeEmail(event) {
  const auth = event.headers?.Authorization || event.headers?.authorization || '';
  const token = auth.replace('Bearer ', '');
  if (!token || token === 'demo-token') return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return payload.email || null;
  } catch {
    return null;
  }
}

async function getPdfUrl(submissionId) {
  if (!PDF_BUCKET || !submissionId) return null;
  try {
    const cmd = new GetObjectCommand({ Bucket: PDF_BUCKET, Key: `${submissionId}.pdf` });
    return await getSignedUrl(s3, cmd, { expiresIn: 86400 });
  } catch {
    return null;
  }
}

async function getItinerary(event, db, email) {
  const submissionId = event.queryStringParameters?.id;
  if (!submissionId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing id parameter' }) };
  }

  try {
    // Verify the submission belongs to the requesting user
    const ownerCheck = await db.query(
      'SELECT email, destination, days, status, created_at FROM submissions WHERE id = $1',
      [submissionId]
    );

    if (ownerCheck.rows.length === 0) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Not found' }) };
    }

    const submission = ownerCheck.rows[0];

    // Only the owner can view (unless you want to support public sharing later)
    if (submission.email !== email) {
      return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    // Fetch itinerary data
    const itinResult = await db.query(
      'SELECT id, itinerary_data FROM itineraries WHERE submission_id = $1 LIMIT 1',
      [submissionId]
    );

    if (itinResult.rows.length === 0) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: 'Itinerary not generated yet' }) };
    }

    return {
      statusCode: 200, headers: CORS,
      body: JSON.stringify({
        submissionId,
        destination: submission.destination,
        days: submission.days,
        status: submission.status,
        createdAt: submission.created_at,
        itinerary: itinResult.rows[0].itinerary_data,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS' }, body: '' };
  }

  const email = decodeEmail(event);
  if (!email) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const db = getDB();
  const path = event.path || event.resource || '';

  if (path.includes('/itinerary')) {
    return getItinerary(event, db, email);
  }

  // ── GET /profile ───────────────────────────────────────────────────────────
  if (event.httpMethod === 'GET') {
    try {
      // Try full profile query; fall back to base columns if migration not run yet
      let userResult;
      try {
        userResult = await db.query(
          `SELECT email, name, gender, age, whatsapp, home_city, language,
                  onboarding_complete, plan
           FROM users WHERE email = $1`,
          [email]
        );
      } catch {
        userResult = await db.query(
          `SELECT email, plan FROM users WHERE email = $1`,
          [email]
        );
      }
      const [, tripsResult] = await Promise.all([
        Promise.resolve(),
        db.query(
          `SELECT s.id, s.destination, s.days, s.status, s.created_at,
                  i.id AS itinerary_id
           FROM submissions s
           LEFT JOIN itineraries i ON i.submission_id = s.id
           WHERE s.email = $1
           ORDER BY s.created_at DESC LIMIT 20`,
          [email]
        ),
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

      if (userResult.rows.length === 0) {
        return { statusCode: 200, headers: CORS, body: JSON.stringify({ exists: false, pastTrips }) };
      }

      return {
        statusCode: 200, headers: CORS,
        body: JSON.stringify({ exists: true, profile: userResult.rows[0], pastTrips }),
      };
    } catch (err) {
      log.error('Profile GET failed', { error: err.message });
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
  }

  // ── PUT /profile ───────────────────────────────────────────────────────────
  if (event.httpMethod === 'PUT') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { name, gender, age, whatsapp, home_city, language, firebase_uid, onboarding_complete } = body;

      await db.query(
        `INSERT INTO users (email, name, gender, age, whatsapp, home_city, language, firebase_uid, onboarding_complete)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (email) DO UPDATE SET
           name               = COALESCE(EXCLUDED.name, users.name),
           gender             = COALESCE(EXCLUDED.gender, users.gender),
           age                = COALESCE(EXCLUDED.age, users.age),
           whatsapp           = COALESCE(EXCLUDED.whatsapp, users.whatsapp),
           home_city          = COALESCE(EXCLUDED.home_city, users.home_city),
           language           = COALESCE(EXCLUDED.language, users.language),
           firebase_uid       = COALESCE(EXCLUDED.firebase_uid, users.firebase_uid),
           onboarding_complete = COALESCE(EXCLUDED.onboarding_complete, users.onboarding_complete),
           updated_at         = NOW()`,
        [email, name||null, gender||null, age||null, whatsapp||null,
         home_city||null, language||null, firebase_uid||null, onboarding_complete??null]
      );

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      log.error('Profile PUT failed', { error: err.message });
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
