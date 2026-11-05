'use strict';

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const {
  getDB, ok, badRequest, serverError, validateFormInput, generateId, log,
  requireUser, AuthError, authFailure, checkRateLimit, userSubject, tooManyRequests,
} = require('/opt/nodejs/index');
const { sanitizeSelectedVenues } = require('/opt/nodejs/selected-venues');

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

const isPath = (event, suffix) => event.path === suffix || event.path?.endsWith(suffix);

/**
 * Resolve the verified caller, or return the response to send instead.
 * @returns {Promise<{ user?: object, response?: object }>}
 */
async function authenticate(event) {
  try {
    return { user: await requireUser(event) };
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Auth rejected', { code: err.code, path: event.path });
      return { response: authFailure(err) };
    }
    log.error('Auth misconfigured', { error: err.message });
    return { response: serverError('Authentication is temporarily unavailable') };
  }
}

/** Returns a 429 response if the caller is over the bucket's limit, else null. */
async function rateLimited(db, bucket, user) {
  const blocked = await checkRateLimit(db, bucket, userSubject(user));
  if (!blocked) return null;
  log.warn('Rate limited', { bucket, uid: user.uid });
  return tooManyRequests(blocked.retryAfterSeconds);
}

// ─── POST /preview ───────────────────────────────────────────────────────────
const PACES = new Set(['relaxed', 'balanced', 'packed', 'full']);

function validatePreviewInput(body) {
  const errors = [];
  const destination = typeof body.destination === 'string' ? body.destination.trim() : '';
  const days = Number(body.days);
  if (!destination) errors.push('destination is required');
  if (destination.length > 200) errors.push('destination is too long');
  if (!Number.isInteger(days) || days < 1 || days > 30) errors.push('days must be a whole number between 1 and 30');

  const styles = Array.isArray(body.travelStyle) ? body.travelStyle : (body.travelStyle ? [body.travelStyle] : []);
  if (styles.length > 12 || styles.some(s => typeof s !== 'string' || s.length > 40)) errors.push('travelStyle is invalid');

  const pace = typeof body.travelPace === 'string' && PACES.has(body.travelPace.toLowerCase())
    ? body.travelPace.toLowerCase() : 'balanced';
  const startTime = typeof body.startTime === 'string' && /^\d{1,2}:\d{2}$/.test(body.startTime) ? body.startTime : '09:00';
  const travelerType = typeof body.travelerType === 'string' ? body.travelerType.slice(0, 40) : '';
  const userMustDos = typeof body.userMustDos === 'string' ? body.userMustDos.slice(0, 500) : '';

  return { errors, values: { destination, days, styles, pace, startTime, travelerType, userMustDos } };
}

async function handlePreview(event, db, user) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }

  const { errors, values } = validatePreviewInput(body);
  if (errors.length) return badRequest('destination and days are required', errors);

  const limited = await rateLimited(db, 'preview', user);
  if (limited) return limited;

  const { destination, days, styles, pace, startTime, travelerType, userMustDos } = values;
  const previewPrompt = `Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Each item must have exactly: { "day": number, "theme": "short title max 4 words", "vibe": "one evocative line max 10 words" }

Create a ${days}-day slow travel day outline for ${destination}.
Traveller: ${travelerType || 'Couple'} | Style: ${styles.join(', ') || 'balanced'} | Pace: ${pace}
${startTime !== '09:00' ? `Day starts around ${startTime}.` : ''}
${userMustDos ? `User must-dos to weave in: ${userMustDos}` : ''}
No activity detail. Titles and atmosphere only. Exactly ${days} items.`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: previewPrompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}`);
    const claudeData = await claudeRes.json();
    let raw = claudeData.content[0].text.trim();

    // Strip any accidental markdown fences
    raw = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

    const daysPreview = JSON.parse(raw);
    return ok({ days: daysPreview });
  } catch (err) {
    log.error('Preview generation failed', { error: err.message });
    return serverError('Preview failed');
  }
}

// ─── POST /feedback ──────────────────────────────────────────────────────────
// Not currently routed in infra/template.yaml; kept for when it is. Public by design.
async function handleFeedback(event) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }
  const { submission_id, rating, comment, destination, source = 'post_delivery', email: fbEmail } = body;
  if (!rating || +rating < 1 || +rating > 5) return badRequest('rating must be 1-5');
  const db = getDB();
  try {
    await db.query(
      `INSERT INTO feedback (submission_id, email, rating, comment, destination, source)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        typeof submission_id === 'string' ? submission_id.slice(0, 50) : null,
        typeof fbEmail === 'string' ? fbEmail.slice(0, 255) : null,
        +rating,
        typeof comment === 'string' ? comment.slice(0, 2000) : null,
        typeof destination === 'string' ? destination.slice(0, 255) : null,
        typeof source === 'string' ? source.slice(0, 50) : 'post_delivery',
      ]
    );
    return ok({ saved: true });
  } catch (err) {
    log.error('Feedback save failed', { error: err.message });
    return serverError('Failed to save feedback');
  }
}

// ─── POST /submit ────────────────────────────────────────────────────────────
async function handleSubmit(event, db, user) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON body'); }

  const errors = validateFormInput(body);
  if (errors.length) return badRequest('Validation failed', errors);

  const limited = await rateLimited(db, 'submit', user);
  if (limited) return limited;

  const {
    destination, days, budget, currency, travelerType,
    travelStyle = [], interests = '', travelDate: rawTravelDate = null,
    travelPace = 'balanced', wantsHotelRecs = true,
    language = 'English',
    userAge = null,
    userLocation = '',
    startTime = '09:00',
    userMustDos = null,
    selected_venues = {},
  } = body;

  // Identity, quota and delivery address all come from the verified token. Any `email`
  // in the request body is ignored — trusting it let callers spend other users' quota
  // or claim test-account status.
  const email = user.email;

  // Normalize travelDate — frontend sends '' when date left blank, null is safe for DB
  const travelDate = rawTravelDate && String(rawTravelDate).trim() !== '' ? rawTravelDate : null;

  const submissionId = generateId();

  try {
    // ─── Check free tier usage ───────────────────────────────────────────────
    const usageResult = await db.query(
      `SELECT COUNT(*) as count FROM submissions
       WHERE email = $1
       AND created_at > NOW() - INTERVAL '30 days'
       AND plan = 'free'`,
      [email]
    );
    const freeTierUsage = parseInt(usageResult.rows[0].count, 10);

    const testResult = await db.query(`SELECT 1 FROM test_accounts WHERE email = $1`, [email]);
    const isTestAccount = testResult.rows.length > 0;

    const paidResult = await db.query(
      `SELECT id, plan, itineraries_remaining FROM users WHERE email = $1`,
      [email]
    );
    const dbUser = paidResult.rows[0];
    const isPaid = dbUser && (dbUser.plan === 'paid_once' || dbUser.plan === 'subscriber');
    const hasFreeSlot = freeTierUsage < 1;

    if (!isTestAccount && !isPaid && !hasFreeSlot) {
      return {
        statusCode: 402,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.FRONTEND_URL,
        },
        body: JSON.stringify({
          success: false,
          message: 'Free tier limit reached',
          upgradeUrl: `${process.env.FRONTEND_URL}/pricing`,
          code: 'FREE_TIER_EXHAUSTED',
        }),
      };
    }

    // ─── Store submission ────────────────────────────────────────────────────
    await db.query(
      `INSERT INTO submissions
       (id, email, destination, days, budget, currency, traveler_type,
        travel_style, interests, travel_date, travel_pace, wants_hotel_recs,
        language, user_age, user_location, start_time, user_must_dos, plan, status, selected_venues)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending',$19)`,
      [
        submissionId, email, destination, parseInt(days, 10),
        parseFloat(budget), currency, travelerType,
        JSON.stringify(travelStyle), interests, travelDate,
        travelPace, wantsHotelRecs,
        language || 'English',
        userAge ? parseInt(userAge, 10) : null,
        userLocation || null,
        startTime || '09:00',
        userMustDos && userMustDos.trim() !== '' ? userMustDos.trim() : null,
        isPaid ? 'paid' : 'free',
        JSON.stringify(sanitizeSelectedVenues(selected_venues, parseInt(days, 10))),
      ]
    );

    log.info('Submission stored', {
      submissionId, uid: user.uid, destination,
      selected_venues_version: selected_venues?.version || 1,
      picks_count: Array.isArray(selected_venues?.picks) ? selected_venues.picks.length : 0,
    });

    // ─── Invoke itinerary generator async (no wait) ──────────────────────────
    await lambda.send(new InvokeCommand({
      FunctionName: `wanderzenai-itinerary-gen-${process.env.STAGE}`,
      InvocationType: 'Event', // async — fire and forget
      Payload: Buffer.from(JSON.stringify({ submissionId, isPaid })),
    }));

    log.info('Itinerary generation triggered', { submissionId });

    return ok({
      submissionId,
      message: 'Your itinerary is being crafted. Check your email in 2–3 minutes.',
      estimatedTime: '2-3 minutes',
    });
  } catch (err) {
    log.error('Form handler error', { error: err.message, submissionId });
    return serverError('Failed to process submission. Please try again.');
  }
}

exports.handler = async (event) => {
  log.info('Form submission received', { path: event.path });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.FRONTEND_URL,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: '',
    };
  }

  if (isPath(event, '/feedback')) return handleFeedback(event);

  // /preview and /submit both spend Claude tokens and require a signed-in, verified user.
  const { user, response } = await authenticate(event);
  if (response) return response;

  const db = getDB();
  if (isPath(event, '/preview')) return handlePreview(event, db, user);
  return handleSubmit(event, db, user);
};

// Exported for unit tests.
exports._internal = { validatePreviewInput };
