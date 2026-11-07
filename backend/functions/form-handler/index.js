'use strict';

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const {
  getDB, ok, badRequest, notFound, serverError, validateFormInput, generateId, log,
  requireUser, optionalUser, AuthError, authFailure, checkRateLimit, userSubject, ipSubject, tooManyRequests,
} = require('/opt/nodejs/index');
const { sanitizeSelectedVenues } = require('/opt/nodejs/selected-venues');
const {
  sanitizeRoute, sanitizePrefs, describePrefs, buildRouteOptionsPrompt, parseRouteOptions, routeAngles, dedupeRoutes, settleEnough,
  travelerTypeFromPrefs, dayPlan,
} = require('/opt/nodejs/route-plan');
const { curatedOptions } = require('/opt/nodejs/curated-routes');
const { readProgress } = require('/opt/nodejs/progress');
const { MODELS, createMessage, firstText, withEffort, maxTokensFor } = require('/opt/nodejs/claude');
const { SUBSCRIPTION_MONTHLY_ITINERARIES, withMonthlyColumn } = require('./subscription');

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

/**
 * The caller for the planning steps (/route-plan, /preview): signed in, or a guest.
 * Guests can plan a whole trip before creating an account (Nov 8 2026); only /submit and
 * progress need sign-in. A present-but-invalid token counts as a guest.
 * @returns {Promise<{ user: object|null, response?: object }>}
 */
async function plannerCaller(event) {
  try {
    return { user: await optionalUser(event) };
  } catch (err) {
    log.error('Auth misconfigured', { error: err.message });
    return { user: null, response: serverError('Authentication is temporarily unavailable') };
  }
}

/**
 * Returns a 429 response if the caller is over the limit, else null.
 * Signed-in callers use `bucket` keyed by account. Guests use `guest<Bucket>` keyed by
 * hashed IP, plus one shared daily cap on all guest Claude calls (`guestAi`), so a spread
 * of IPs still can't run up the bill.
 */
async function rateLimited(db, bucket, user, event) {
  const checks = user
    ? [[bucket, userSubject(user)]]
    : [[`guest${bucket[0].toUpperCase()}${bucket.slice(1)}`, ipSubject(event)], ['guestAi', 'all']];
  for (const [b, subject] of checks) {
    const blocked = await checkRateLimit(db, b, subject);
    if (blocked) {
      log.warn('Rate limited', { bucket: b, uid: user?.uid || 'guest' });
      return tooManyRequests(blocked.retryAfterSeconds);
    }
  }
  return null;
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

// ─── POST /route-plan ────────────────────────────────────────────────────────
/**
 * 200 with the route options. `route` (the first option) keeps browser tabs that still run
 * the pre-option-B frontend working until they reload — they read `data.route`.
 */
const routeOptionsOk = (source, country, options) => ok({ source, country, options, route: options[0] || null });

/** How long /route-plan waits for its parallel Claude calls (API Gateway cuts off at 29 s). */
// Measured Nov 7: the three calls finish within ~4 s of each other (6–12 s each).
const ROUTE_WAIT = { enough: 2, graceMs: 5000, deadlineMs: 23000 };


// Route first (Q2): propose the bases for the trip before Step 3. See route-plan.js.
// Route ideas from Claude are cached per trip shape (7 days), for guests and users alike:
// the same "Peru, 10 days, two adults" asked again costs nothing and returns instantly.
const ROUTE_CACHE_TTL = '7 days';
const ROUTE_CACHE_DDL = `
  CREATE TABLE IF NOT EXISTS route_plan_cache (
    cache_key  CHAR(64)    PRIMARY KEY,
    result     JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`;
let routeCacheReady = null;
const ensureRouteCache = (db) => {
  if (!routeCacheReady) routeCacheReady = db.query(ROUTE_CACHE_DDL).catch((err) => { routeCacheReady = null; throw err; });
  return routeCacheReady;
};

/** Everything that changes which routes Claude suggests; nothing about who is asking. */
function routeCacheKey(input) {
  const shape = {
    v: 1,
    destination: input.destination.trim().toLowerCase(),
    days: input.days,
    styles: [...(input.travelStyle || [])].map(s => String(s).toLowerCase()).sort(),
    pace: input.travelPace || '',
    interests: (input.interests || '').trim().toLowerCase(),
    month: (input.travelDate || '').slice(0, 7),
    prefs: input.prefs || null,
  };
  return require('crypto').createHash('sha256').update(JSON.stringify(shape)).digest('hex');
}

/** Cached result or null. Never fails the request. */
async function readRouteCache(db, key) {
  try {
    await ensureRouteCache(db);
    const { rows } = await db.query(
      `SELECT result FROM route_plan_cache WHERE cache_key = $1 AND created_at > NOW() - INTERVAL '${ROUTE_CACHE_TTL}'`,
      [key]
    );
    const r = rows[0]?.result;
    return r && Array.isArray(r.options) && r.options.length ? r : null;
  } catch (err) {
    log.warn('Route cache read failed', { error: err.message });
    return null;
  }
}

async function writeRouteCache(db, key, result) {
  try {
    await ensureRouteCache(db);
    await db.query(
      `INSERT INTO route_plan_cache (cache_key, result, created_at) VALUES ($1, $2, NOW())
       ON CONFLICT (cache_key) DO UPDATE SET result = EXCLUDED.result, created_at = NOW()`,
      [key, JSON.stringify(result)]
    );
  } catch (err) {
    log.warn('Route cache write failed', { error: err.message });
  }
}

async function handleRoutePlan(event, db, user) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }

  const { errors, values } = validatePreviewInput(body);
  if (errors.length) return badRequest('destination and days are required', errors);

  const input = {
    destination: values.destination,
    days: values.days,
    travelStyle: values.styles,
    travelPace: values.pace,
    interests: typeof body.interests === 'string' ? body.interests.slice(0, 300) : '',
    travelDate: typeof body.travelDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.travelDate) ? body.travelDate : '',
    userLocation: typeof body.userLocation === 'string' ? body.userLocation.slice(0, 100) : '',
    prefs: sanitizePrefs(body.prefs),
    // "Show other options": route names already shown, so Claude suggests new ones.
    avoid: (Array.isArray(body.avoid) ? body.avoid : []).filter(a => typeof a === 'string').map(a => a.slice(0, 60)).slice(0, 8),
  };
  const wantMore = body.more === true;

  // 1. Hand-curated routes for the launch countries (option B) — instant, no Claude call.
  const curated = wantMore ? null : curatedOptions(input);
  const fitting = curated ? curated.options.filter(o => o.fitsConstraints) : [];
  if (fitting.length) {
    log.info('Route options (curated)', { uid: user?.uid || 'guest', country: curated.country, days: input.days, options: curated.options.map(o => o.id), fitting: fitting.length });
    return routeOptionsOk('curated', curated.country, curated.options.slice(0, 3));
  }

  // 2. Claude: any other country, "show other options", or when no curated route fits
  //    (e.g. young kids and short transfers only).
  // Same trip asked before (any user): reuse those routes — no Claude call, no wait.
  const cacheKey = wantMore || input.avoid.length ? null : routeCacheKey(input);
  const hit = cacheKey ? await readRouteCache(db, cacheKey) : null;
  if (hit) {
    log.info('Route options (cache)', { uid: user?.uid || 'guest', destination: input.destination, days: input.days });
    return routeOptionsOk(hit.source, hit.country, hit.options);
  }

  const limited = await rateLimited(db, 'route', user, event);
  if (limited) return limited;
  try {
    // Interactive and behind API Gateway's 29 s limit: the fast model, one route per call,
    // calls in parallel (one call for three routes took >24 s). Whatever arrives in time is used.
    const avoid = [...input.avoid, ...(curated ? curated.options.map(o => o.name) : [])];
    const angles = routeAngles({ more: wantMore, curated: !!curated });
    const settled = await settleEnough(angles.map(angle => createMessage(withEffort({
      model: MODELS.fast,
      max_tokens: maxTokensFor(MODELS.fast, 2500, { thinkingHeadroom: 2500 }), // prod: up to ~3.3k incl. thinking
      messages: [{ role: 'user', content: buildRouteOptionsPrompt({ ...input, avoid, angle }) }],
    }, 'low'), { timeoutMs: 22000, maxAttempts: 1 })
      .then(data => parseRouteOptions(firstText(data), input.days, `ai-${angle}`))), ROUTE_WAIT);
    const failed = settled.filter(s => s.status !== 'fulfilled').map((s, i) => `${angles[i]}: ${s.reason?.message || s.status}`);
    if (failed.length) log.warn('Route angles failed or late', { failed, of: angles.length });
    // Near-duplicates (same main stops) of each other or of curated routes on screen are dropped.
    const aiOptions = dedupeRoutes(
      settled.flatMap(s => (s.status === 'fulfilled' ? s.value : [])),
      curated ? curated.options : [],
    );
    if (!aiOptions.length) throw new Error(`No route came back (${failed.join('; ')})`);
    // Curated routes that didn't fit stay visible below, with their heads-up.
    const options = [...aiOptions, ...(curated ? curated.options : [])].slice(0, 4);
    if (cacheKey) await writeRouteCache(db, cacheKey, { source: curated ? 'mixed' : 'ai', country: curated?.country || null, options });
    log.info('Route options (claude)', { uid: user?.uid || 'guest', destination: input.destination, days: input.days, more: wantMore, options: options.map(o => `${o.name}:${o.bases.map(b => b.name).join('>')}`) });
    return routeOptionsOk(curated ? 'mixed' : 'ai', curated?.country || null, options);
  } catch (err) {
    log.error('Route planning failed', { error: err.message });
    if (curated) return routeOptionsOk('curated', curated.country, curated.options.slice(0, 3));
    return serverError('Could not plan a route right now. Please try again.');
  }
}

async function handlePreview(event, db, user) {
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return badRequest('Invalid JSON'); }

  const { errors, values } = validatePreviewInput(body);
  if (errors.length) return badRequest('destination and days are required', errors);

  const limited = await rateLimited(db, 'preview', user, event);
  if (limited) return limited;

  const { destination, days, styles, pace, startTime, travelerType, userMustDos } = values;
  // The outline follows the route the traveller confirmed, when there is one.
  const route = sanitizeRoute(body.route || body.selected_venues?.route, days);
  // Day by day, travel days included — "Hoi An 3 days" alone let the outline put a Hoi An
  // farewell on the day the traveller actually moves on to Hue (seen live, Nov 7 2026).
  const routeLine = (route
    ? `Route (follow it exactly — each day happens around that day's base):\n${dayPlan(route).map((d, i, all) => (d.travelDay
      ? `Day ${d.day}: travel ${all[i - 1].base.name} → ${d.base.name}, then settle in`
      : `Day ${d.day}: ${d.base.name}`)).join('\n')}`
    : '') + (body.prefs ? `\nTravelling: ${describePrefs(sanitizePrefs(body.prefs))}.` : '');
  const previewPrompt = `Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Each item must have exactly: { "day": number, "theme": "short title max 4 words", "vibe": "one evocative line max 10 words" }

Create a ${days}-day slow travel day outline for ${destination}.
Traveller: ${travelerType || 'Couple'} | Style: ${styles.join(', ') || 'balanced'} | Pace: ${pace}
${routeLine}
${startTime !== '09:00' ? `Day starts around ${startTime}.` : ''}
${userMustDos ? `User must-dos to weave in: ${userMustDos}` : ''}
No activity detail. Titles and atmosphere only. Exactly ${days} items.`;

  try {
    // The user is waiting on this one: short timeout, one retry.
    const claudeData = await createMessage(withEffort({
      model: MODELS.fast,
      max_tokens: maxTokensFor(MODELS.fast, 1024, { thinkingHeadroom: 1500 }),
      messages: [{ role: 'user', content: previewPrompt }],
    }, 'low'), {
      timeoutMs: 15000,
      maxAttempts: 2,
      onRetry: (info) => log.warn('Preview Claude call retrying', info),
    });
    let raw = firstText(claudeData).trim();

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

  // Traveler Type is optional on Step 1 (Nov 7 2026: skipping it made every submit fail with
  // "Validation failed"): fill it from who's travelling.
  if (!body.travelerType || typeof body.travelerType !== 'string') {
    body.travelerType = travelerTypeFromPrefs(body.selected_venues?.tripPrefs);
  }
  body.travelerType = body.travelerType.slice(0, 40);

  const errors = validateFormInput(body);
  if (errors.length) return badRequest(`Please check: ${errors.join('; ')}`, errors);

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

  let entitlement;
  try {
    entitlement = await decideEntitlement(db, email);
  } catch (err) {
    log.error('Entitlement check failed', { error: err.message, submissionId });
    return serverError('Failed to process submission. Please try again.');
  }

  try {
    const isPaid = entitlement.isPaid;

    if (!entitlement.allowed) {
      return {
        statusCode: 402,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': process.env.FRONTEND_URL,
        },
        body: JSON.stringify(limitReachedBody(entitlement.reason)),
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
      entitlement: entitlement.reason,
      ...(entitlement.consumedCredit ? { creditsLeft: entitlement.creditsLeft } : {}),
      selected_venues_version: selected_venues?.version || 1,
      picks_count: Array.isArray(selected_venues?.picks) ? selected_venues.picks.length : 0,
    });

    // ─── Invoke itinerary generator async (no wait) ──────────────────────────
    await lambda.send(new InvokeCommand({
      FunctionName: `wanderzenai-itinerary-gen-${process.env.STAGE}`,
      InvocationType: 'Event', // async — fire and forget
      // creditSource tells the generator what to give back if generation fails.
      Payload: Buffer.from(JSON.stringify({ submissionId, isPaid, creditSource: entitlement.source || null })),
    }));

    log.info('Itinerary generation triggered', { submissionId });

    return ok({
      submissionId,
      message: 'Your itinerary is being crafted. Check your email in about 5 minutes.',
      estimatedTime: 'about 5 minutes',
    });
  } catch (err) {
    log.error('Form handler error', { error: err.message, submissionId });
    if (entitlement?.consumedCredit) await refundCredit(db, email, submissionId, entitlement.source);
    return serverError('Failed to process submission. Please try again.');
  }
}

// ─── Entitlement ─────────────────────────────────────────────────────────────
// Order of precedence for who may generate an itinerary:
//   1. test account                 → allowed, recorded as paid
//   2. Wanderer monthly allowance   → 5 per billing month (see subscription.js), spent
//                                     first because unused ones expire at renewal
//   3. a purchased/referral credit  → never expires (Single Plan = 1; referral = +1)
//   4. the monthly free itinerary   → free-plan users only, recorded as free
// Each paid source is decremented atomically (UPDATE … WHERE … > 0 RETURNING), so
// parallel submits can never spend more than the user has.
async function decideEntitlement(db, email) {
  const testResult = await db.query(`SELECT 1 FROM test_accounts WHERE email = $1`, [email]);
  if (testResult.rows.length) return { allowed: true, isPaid: true, reason: 'test_account', consumedCredit: false };

  const monthly = await withMonthlyColumn(db, (d) => d.query(
    `UPDATE users SET monthly_remaining = monthly_remaining - 1, updated_at = NOW()
     WHERE email = $1 AND plan = 'subscriber' AND monthly_remaining > 0
     RETURNING monthly_remaining`,
    [email]
  ));
  if (monthly.rows.length) {
    return { allowed: true, isPaid: true, reason: 'subscriber_monthly', consumedCredit: true, source: 'monthly', creditsLeft: monthly.rows[0].monthly_remaining };
  }

  const credit = await db.query(
    `UPDATE users SET itineraries_remaining = itineraries_remaining - 1, updated_at = NOW()
     WHERE email = $1 AND itineraries_remaining > 0
     RETURNING itineraries_remaining`,
    [email]
  );
  if (credit.rows.length) {
    return { allowed: true, isPaid: true, reason: 'credit', consumedCredit: true, source: 'credit', creditsLeft: credit.rows[0].itineraries_remaining };
  }

  const userResult = await db.query(`SELECT plan FROM users WHERE email = $1`, [email]);
  if (userResult.rows[0]?.plan === 'subscriber') {
    // The 5 already include the free one, so subscribers don't also get the free tier.
    return { allowed: false, isPaid: false, reason: 'monthly_limit', consumedCredit: false };
  }

  const usageResult = await db.query(
    `SELECT COUNT(*) as count FROM submissions
     WHERE email = $1 AND created_at > NOW() - INTERVAL '30 days' AND plan = 'free'
       AND status <> 'failed'`, // a failed generation doesn't use up the free itinerary
    [email]
  );
  if (parseInt(usageResult.rows[0].count, 10) < 1) return { allowed: true, isPaid: false, reason: 'free_monthly', consumedCredit: false };

  return { allowed: false, isPaid: false, reason: 'exhausted', consumedCredit: false };
}

/**
 * What the next submission would use — read-only twin of decideEntitlement (same order),
 * shown on the Review step so nobody fills in six steps only to meet the paywall.
 * @returns {Promise<{ allowed: boolean, source: 'test'|'monthly'|'credit'|'free'|null, remaining: number|null, code?: string }>}
 */
async function peekEntitlement(db, email) {
  const test = await db.query(`SELECT 1 FROM test_accounts WHERE email = $1`, [email]);
  if (test.rows.length) return { allowed: true, source: 'test', remaining: null };

  const userRow = await withMonthlyColumn(db, (d) => d.query(
    `SELECT plan, COALESCE(itineraries_remaining, 0) AS credits, COALESCE(monthly_remaining, 0) AS monthly
     FROM users WHERE email = $1`,
    [email]
  ));
  const u = userRow.rows[0] || { plan: 'free', credits: 0, monthly: 0 };
  if (u.plan === 'subscriber' && Number(u.monthly) > 0) return { allowed: true, source: 'monthly', remaining: Number(u.monthly) };
  if (Number(u.credits) > 0) return { allowed: true, source: 'credit', remaining: Number(u.credits) };
  if (u.plan === 'subscriber') return { allowed: false, source: null, remaining: 0, code: 'MONTHLY_LIMIT_REACHED' };

  const usage = await db.query(
    `SELECT COUNT(*) AS count FROM submissions
     WHERE email = $1 AND created_at > NOW() - INTERVAL '30 days' AND plan = 'free' AND status <> 'failed'`,
    [email]
  );
  return parseInt(usage.rows[0].count, 10) < 1
    ? { allowed: true, source: 'free', remaining: 1 }
    : { allowed: false, source: null, remaining: 0, code: 'FREE_TIER_EXHAUSTED' };
}

/** GET /entitlement */
async function handleEntitlement(db, user) {
  try {
    return ok(await peekEntitlement(db, user.email));
  } catch (err) {
    log.error('Entitlement check failed', { error: err.message });
    return serverError('Could not check your plan');
  }
}

/** Give back what was taken for a submission that was never stored. Best effort. */
async function refundCredit(db, email, submissionId, source = 'credit') {
  const column = source === 'monthly' ? 'monthly_remaining' : 'itineraries_remaining';
  try {
    await db.query(
      `UPDATE users SET ${column} = ${column} + 1, updated_at = NOW() WHERE email = $1`,
      [email]
    );
    log.info('Credit refunded after failed submission', { submissionId, source });
  } catch (err) {
    log.error('Credit refund failed', { submissionId, source, error: err.message });
  }
}

/** 402 body: which limit was hit decides what the frontend offers next. */
function limitReachedBody(reason) {
  if (reason === 'monthly_limit') {
    return {
      success: false,
      message: `You've used your ${SUBSCRIPTION_MONTHLY_ITINERARIES} itineraries this month. They reset on your next billing date.`,
      upgradeUrl: `${process.env.FRONTEND_URL}/pricing`,
      code: 'MONTHLY_LIMIT_REACHED',
    };
  }
  return {
    success: false,
    message: 'Free tier limit reached',
    upgradeUrl: `${process.env.FRONTEND_URL}/pricing`,
    code: 'FREE_TIER_EXHAUSTED',
  };
}

// ─── GET /itinerary/{id}/progress ────────────────────────────────────────────
// Live progress for the confirmation page. Owner only: another user's id (or an unknown
// one) is a plain 404 so ids can't be probed. Polled every few seconds; no Claude call.
const SUBMISSION_ID = /^wz_[a-z0-9]{6,12}_[A-Za-z0-9_-]{16}$/;

function progressIdOf(event) {
  const id = event.pathParameters?.id || (event.path || '').match(/\/itinerary\/([^/]+)\/progress$/)?.[1];
  return id && /\/progress$/.test(event.path || '') && SUBMISSION_ID.test(id) ? id : null;
}

async function handleProgress(db, submissionId, user) {
  try {
    const data = await readProgress(db, submissionId, user);
    if (!data) return notFound('Trip not found');
    return ok(data);
  } catch (err) {
    log.error('Progress read failed', { submissionId, error: err.message });
    return serverError('Could not load progress');
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
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      },
      body: '',
    };
  }

  if (isPath(event, '/feedback')) return handleFeedback(event);

  // Planning steps are open to guests (rate limited by IP); see plannerCaller.
  if (event.httpMethod === 'POST' && (isPath(event, '/preview') || isPath(event, '/route-plan'))) {
    const { user, response } = await plannerCaller(event);
    if (response) return response;
    const db = getDB();
    return isPath(event, '/preview') ? handlePreview(event, db, user) : handleRoutePlan(event, db, user);
  }

  // /submit, progress and entitlement need a signed-in, verified user.
  const { user, response } = await authenticate(event);
  if (response) return response;

  const db = getDB();
  if (event.httpMethod === 'GET') {
    if (isPath(event, '/entitlement')) return handleEntitlement(db, user);
    const id = progressIdOf(event);
    return id ? handleProgress(db, id, user) : notFound();
  }
  if (isPath(event, '/submit')) return handleSubmit(event, db, user);
  return notFound();
};

// Exported for unit tests.
exports._internal = {
  validatePreviewInput, decideEntitlement, peekEntitlement, refundCredit, limitReachedBody, ROUTE_WAIT, progressIdOf,
  routeCacheKey, rateLimited,
};
