'use strict';

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, ok, badRequest, serverError, validateFormInput, generateId, log } = require('/opt/nodejs/index');

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

exports.handler = async (event) => {
  log.info('Form submission received', { path: event.path });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': process.env.FRONTEND_URL, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST,OPTIONS' }, body: '' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }

  // ─── Validate input ────────────────────────────────────────────────────────
  const errors = validateFormInput(body);
  if (errors.length) return badRequest('Validation failed', errors);

  const {
    destination, days, budget, currency, travelerType,
    travelStyle = [], interests = '', travelDate = null,
    travelPace = 'balanced', wantsHotelRecs = true, email,
  } = body;

  const db = getDB();
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

    // Check if paid user
    const paidResult = await db.query(
      `SELECT id, plan, itineraries_remaining FROM users WHERE email = $1`,
      [email]
    );
    const user = paidResult.rows[0];
    const isPaid = user && (user.plan === 'paid_once' || user.plan === 'subscriber');
    const hasFreeSlot = freeTierUsage < 1;

    if (!isPaid && !hasFreeSlot) {
      return {
        statusCode: 402,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': process.env.FRONTEND_URL },
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
        travel_style, interests, travel_date, travel_pace, wants_hotel_recs, plan, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')`,
      [
        submissionId, email, destination, parseInt(days, 10),
        parseFloat(budget), currency, travelerType,
        JSON.stringify(travelStyle), interests, travelDate,
        travelPace, wantsHotelRecs, isPaid ? 'paid' : 'free',
      ]
    );

    log.info('Submission stored', { submissionId, email, destination });

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
};
