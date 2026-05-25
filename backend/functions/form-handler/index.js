'use strict';

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, ok, badRequest, serverError, validateFormInput, generateId, log } = require('/opt/nodejs/index');

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

exports.handler = async (event) => {
  log.info('Form submission received', { path: event.path });

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.FRONTEND_URL,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: '',
    };
  }

  // ─── POST /preview ─────────────────────────────────────────────────────────
  // Must be checked BEFORE validation — preview does not require submit fields
  if (event.path === '/preview' || event.path?.endsWith('/preview')) {
    let previewBody;
    try {
      previewBody = JSON.parse(event.body || '{}');
    } catch {
      return badRequest('Invalid JSON');
    }

    const {
      destination,
      days,
      travelerType,
      travelStyle = [],
      travelPace = 'balanced',
      startTime = '09:00',
      userMustDos = '',
    } = previewBody;

    if (!destination || !days) return badRequest('destination and days are required');

    const styleList = Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle;

    const previewPrompt = `Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Each item must have exactly: { "day": number, "theme": "short title max 4 words", "vibe": "one evocative line max 10 words" }

Create a ${days}-day slow travel day outline for ${destination}.
Traveller: ${travelerType || 'Couple'} | Style: ${styleList || 'balanced'} | Pace: ${travelPace}
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

  // ─── POST /submit ───────────────────────────────────────────────────────────

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
    travelStyle = [], interests = '', travelDate: rawTravelDate = null,
    travelPace = 'balanced', wantsHotelRecs = true,
    language = 'English',
    userAge = null,
    userLocation = '',
    startTime = '09:00',
    userMustDos = null,
    email,
    selected_venues = {},
  } = body;

  // Normalize travelDate — frontend sends '' when date left blank, null is safe for DB
  const travelDate = rawTravelDate && String(rawTravelDate).trim() !== '' ? rawTravelDate : null;

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

    // Check if test account — bypass free tier limit entirely
    const testResult = await db.query(
      `SELECT 1 FROM test_accounts WHERE email = $1`,
      [email]
    );
    const isTestAccount = testResult.rows.length > 0;

    // Check if paid user
    const paidResult = await db.query(
      `SELECT id, plan, itineraries_remaining FROM users WHERE email = $1`,
      [email]
    );
    const user = paidResult.rows[0];
    const isPaid = user && (user.plan === 'paid_once' || user.plan === 'subscriber');
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
        JSON.stringify(selected_venues || {}),
      ]
    );

    log.info('Submission stored', { submissionId, email, destination, selected_venues_count: Object.keys(selected_venues || {}).length });

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
