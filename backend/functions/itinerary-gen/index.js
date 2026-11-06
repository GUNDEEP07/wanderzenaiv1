'use strict';

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, generateId, getCurrencySymbol, log, fetchFoursquareTips } = require('/opt/nodejs/index');
const { searchVenues } = require('/opt/nodejs/venue-enrichment/foursquare');
const { MODELS, createMessage, firstText, withEffort, maxTokensFor } = require('/opt/nodejs/claude');
const { findDuplicateVenues, planRepairs, repairRules } = require('./validate');
const { GenerationFailed, handleGenerationFailure } = require('./failure');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: 'ap-southeast-2' });
const sendEmail = ({ to, subject, text, html }) => ses.send(new SendEmailCommand({
  Source: `WanderZenAI <${process.env.FROM_EMAIL}>`,
  Destination: { ToAddresses: [to] },
  Message: {
    Subject: { Data: subject, Charset: 'UTF-8' },
    Body: { Html: { Data: html, Charset: 'UTF-8' }, Text: { Data: text, Charset: 'UTF-8' } },
  },
}));
// Stop this long before the Lambda timeout so a failure is handled (refund + email)
// instead of the function being killed mid-way with the submission stuck in 'processing'.
const DEADLINE_MARGIN_MS = 60000;
const {
  planPicks, formatPicksForDays, formatPicksOverview, findMissingPicks,
} = require('/opt/nodejs/selected-venues');

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });


const FOURSQUARE_KEY = process.env.FOURSQUARE_API_KEY;
const FS_CATEGORIES = '13032,12061,16032,16020,12096,16009,13065';

// fetchFoursquareTips imported from shared layer

// ─── SYSTEM PROMPT ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are WanderZen — a slow travel expert with 20+ years off the beaten path.

Philosophy:
- AVOID tourist traps, top-10 lists, overcrowded attractions
- SEEK village markets, hidden cafes, local guesthouses, nature trails
- PREFER homestays, boutique guesthouses, Airbnbs in residential neighbourhoods
- One free hidden gem per day, always
- Best times to visit each spot (early morning, late afternoon, etc.)

CRITICAL OUTPUT RULES:
- Respond with ONLY a raw JSON object
- No markdown, no backticks, no code fences, no explanation
- Start with { and end with }
- Never truncate — complete every field fully`;

// ─── SLIM DAY SCHEMA (minimises tokens per call) ─────────────────────────────
const DAY_SCHEMA = `{
  "dayNumber": number,
  "theme": "string",
  "morningActivity": {"time":"string","activity":"string","location":"string","venueName":"string or null","why":"string","cost":number,"isFree":boolean,"insiderTip":"string"},
  "afternoonActivity": {"time":"string","activity":"string","location":"string","venueName":"string or null","why":"string","cost":number,"isFree":boolean,"insiderTip":"string"},
  "eveningActivity": {"time":"string","activity":"string","location":"string","venueName":"string or null","why":"string","cost":number,"isFree":boolean,"insiderTip":"string"},
  "hiddenGem": "string",
  "dailyCost": number,
  "localEats": {"name":"string","dish":"string","cost":number,"venueName":"string or null","vibe":"string"}
}`;

// ─── META SCHEMA (cover + tips, one call) ────────────────────────────────────
const META_SCHEMA = `{
  "title": "string",
  "summary": "string",
  "accommodation": {"recommendation":"string","why":"string","searchTerms":["string"]},
  "practicalTips": ["string"],
  "totalEstimatedCost": number,
  "avoidList": ["string"]
}`;

// ─── PARSE JSON ROBUSTLY ─────────────────────────────────────────────────────
const parseJSON = (raw) => {
  // Strip fences
  let cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/^[\s\S]*?(\{)/, '$1') // strip anything before first {
    .trim();

  // Extract outermost JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  cleaned = cleaned.slice(start, end + 1);

  // Fix trailing commas
  cleaned = cleaned
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/([^\\])"(\s*):(\s*)"([^"]*$)/gm, '$1"$2":"$4"'); // fix unclosed strings at end

  return JSON.parse(cleaned);
};

// ─── CALL CLAUDE WITH RETRY ──────────────────────────────────────────────────
// The itinerary is written by MODELS.strong (Opus by default). ITINERARY_EFFORT tunes
// how much it thinks: higher = better plans, slower and more output tokens.
const ITINERARY_EFFORT = process.env.CLAUDE_ITINERARY_EFFORT || 'medium';
// Day batches run in parallel, this many at a time (Opus is slower than Haiku; a
// 30-day trip run one batch at a time would not finish inside the Lambda timeout).
const BATCH_CONCURRENCY = 4;

/**
 * @param {number} textTokens visible output needed; max_tokens adds thinking headroom
 * @param {object} [opts] { effort, attempt }
 */
const callClaude = async (systemPrompt, userPrompt, textTokens, submissionId, { effort = ITINERARY_EFFORT, attempt = 1 } = {}) => {
  const model = MODELS.strong;
  const maxTokens = maxTokensFor(model, textTokens);
  log.info('Claude API call', { submissionId, model, effort, maxTokens, attempt });

  // Timeout + retry on 429/5xx/529/network errors (shared claude.js).
  const data = await createMessage(withEffort({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }, effort), {
    timeoutMs: 240000,
    onRetry: (info) => log.warn('Claude call retrying', { submissionId, ...info }),
  });
  const raw = firstText(data);

  log.info('Claude response', {
    submissionId,
    attempt,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
    stopReason: data.stop_reason,
  });

  // Cut off (thinking + text hit max_tokens): retry once with double the room.
  if (data.stop_reason === 'max_tokens' && attempt === 1) {
    log.warn('Response truncated, retrying with higher token limit', { submissionId, maxTokens });
    return callClaude(systemPrompt, userPrompt, textTokens * 2, submissionId, { effort, attempt: 2 });
  }

  return { raw, usage: data.usage };
};

/** Run async tasks with at most `limit` in flight; results keep input order. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ─── GENERATE META (title, summary, accommodation, tips) ────────────────────
// Step 3 picks arrive as submission.picksPlan (see shared selected-venues.js).
const generateMeta = async (submission, currencySymbol, submissionId, fsTips = null) => {
  const { destination, days, budget, currency, travelerType, travelStyle, travelPace, interests, startTime, userMustDos, userAge, userLocation, language, picksPlan } = submission;
  const styleList = Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle;
  const venuesContext = formatPicksOverview(picksPlan || { picks: [], interests: [] });

  const prompt = `Create the overview section for a ${days}-day slow travel itinerary for ${destination}.

Traveller: ${travelerType}, budget ${currencySymbol}${budget} ${currency}, style: ${styleList || 'balanced'}, pace: ${travelPace}
${interests ? `Interests: ${interests}` : ''}
${startTime && startTime !== '09:00' ? `Day starts: ${startTime} — do not schedule anything before this time` : ''}
${userMustDos ? `Must include: ${userMustDos}` : ''}
${userAge ? `Age: ${userAge}` : ''}
${userLocation ? `From: ${userLocation}` : ''}
Language: Write ENTIRELY in ${language || 'English'}.
${fsTips ? `

Real verified venues in ${destination} — reference these specifically by name and include their map links:
${fsTips}

For each venue mentioned: include the venue name exactly as given, and add the Google Maps link as [View on map](url) after the activity description.` : ''}${venuesContext}

Return ONLY this JSON (no extra text):
${META_SCHEMA}`;

  const { raw, usage } = await callClaude(SYSTEM_PROMPT, prompt, 1500, submissionId);

  try {
    return { data: parseJSON(raw), usage };
  } catch (e) {
    log.error('Meta parse failed', { submissionId, raw: raw.substring(0, 300) });
    // Return minimal fallback meta rather than failing entire generation
    return {
      data: {
        title: `${destination}: A Slow Travel Guide`,
        summary: `A carefully curated ${days}-day slow travel experience in ${destination}, designed to take you off the tourist trail and into the real local life.`,
        accommodation: { recommendation: `Guesthouse or homestay outside the city centre`, why: 'Quieter, cheaper, more authentic than tourist areas', searchTerms: [`${destination} guesthouse`, `${destination} homestay`, `${destination} local neighbourhood`] },
        practicalTips: ['Rise early to see places before the crowds', 'Eat where locals eat — follow the lunch queues', 'Walk instead of taking taxis when under 2km', 'Ask your host for their personal recommendations'],
        totalEstimatedCost: budget,
        avoidList: ['Tourist-trap restaurants near main attractions', 'Overpriced guided tours — self-guide instead', 'Chain hotels in the city centre'],
      },
      usage,
    };
  }
};

// ─── GENERATE A BATCH OF DAYS ────────────────────────────────────────────────
// extraRules: appended verbatim — used by the Q3 validation pass when rewriting a day.
const generateDaysBatch = async (submission, dayNumbers, currencySymbol, submissionId, fsTips = null, extraRules = '') => {
  const { destination, budget, currency, travelerType, travelStyle, travelPace, interests, startTime, userMustDos, userAge, userLocation, language, days: totalDays, picksPlan } = submission;
  const styleList = Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle;
  const dailyBudget = Math.round(budget / totalDays);
  const venuesContext = formatPicksForDays(picksPlan || { picks: [], interests: [] }, dayNumbers);

  const prompt = `Create days ${dayNumbers.join(', ')} of ${totalDays} for a slow travel itinerary in ${destination}.

Traveller: ${travelerType}, daily budget ~${currencySymbol}${dailyBudget} ${currency}, style: ${styleList || 'balanced'}, pace: ${travelPace}
${interests ? `Interests: ${interests}` : ''}
${startTime && startTime !== '09:00' ? `Day starts: ${startTime} — do not schedule anything before this time` : ''}
${userMustDos ? `Must include: ${userMustDos}` : ''}
${userAge ? `Age: ${userAge}` : ''}
${userLocation ? `From: ${userLocation}` : ''}
Language: Write ENTIRELY in ${language || 'English'}.

Rules:
- Avoid tourist traps — find what locals actually do
- One completely free hidden gem per day
- Specific place names, not generic descriptions
- Costs in ${currency} (${currencySymbol})
${fsTips ? `\n\nReal verified venues — when you reference any of these venues, set venueName to the EXACT name from this list:\n${fsTips}\n\nFor EVERY activity that references a verified venue above, set venueName to the exact venue name (e.g. "venueName":"Kiyomizu-dera Temple (清水寺)"). If the activity doesn't reference one of these venues, set venueName to null.` : ''}${venuesContext}${extraRules}

Return ONLY a JSON object with a "days" array containing ${dayNumbers.length} day object(s):
{
  "days": [
    ${DAY_SCHEMA}
  ]
}`;

  // ~1800 visible tokens per day; callClaude adds thinking headroom on 5.x models.
  const textTokens = 1800 * dayNumbers.length + 400;
  const { raw, usage } = await callClaude(SYSTEM_PROMPT, prompt, textTokens, submissionId);

  try {
    const parsed = parseJSON(raw);
    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error('No days array in response');
    }
    return { days: parsed.days, usage };
  } catch (e) {
    log.error('Days batch parse failed', { submissionId, dayNumbers, raw: raw.substring(0, 400) });

    // Retry up to twice, thinking harder, with more room and a reminder about the format.
    // No generic filler days are ever shipped: if these fail too, the whole itinerary
    // fails (refund + email — see failure.js).
    const strictPrompt = `${prompt}\n\nIMPORTANT: your previous answer could not be parsed. Reply with the JSON object only — start with { and end with }.`;
    for (let attempt = 2; attempt <= 3; attempt++) {
      log.info('Retrying batch after parse failure', { submissionId, dayNumbers, attempt });
      try {
        const { raw: retryRaw, usage: retryUsage } = await callClaude(
          SYSTEM_PROMPT, strictPrompt, textTokens + 1000 * attempt, submissionId, { effort: 'high', attempt }
        );
        const retryParsed = parseJSON(retryRaw);
        if (Array.isArray(retryParsed.days) && retryParsed.days.length) {
          return { days: retryParsed.days, usage: retryUsage };
        }
      } catch (retryErr) {
        log.error('Batch retry failed', { submissionId, dayNumbers, attempt, error: retryErr.message });
      }
    }
    throw new GenerationFailed(`Days ${dayNumbers.join(', ')} could not be generated`, { reason: 'batch_unparseable' });
  }
};

// ─── VENUE LOOKUP & ATTACHMENT ───────────────────────────────────────────────
// Match venue names from Claude to actual Foursquare venue objects
const attachVenuesToItinerary = (itinerary, allVenues) => {
  if (!allVenues?.length) return itinerary;

  // Build a map for fast lookup: exact name → venue object
  const venueMap = new Map();
  allVenues.forEach(v => {
    if (v.name) venueMap.set(v.name, v);
  });

  // Attach venue objects to activities
  (itinerary.days || []).forEach(day => {
    ['morningActivity', 'afternoonActivity', 'eveningActivity'].forEach(period => {
      const act = day[period];
      if (act && act.venueName && venueMap.has(act.venueName)) {
        act.venue = venueMap.get(act.venueName);
      }
    });
    if (day.localEats && day.localEats.venueName && venueMap.has(day.localEats.venueName)) {
      day.localEats.venue = venueMap.get(day.localEats.venueName);
    }
  });

  return itinerary;
};

// ─── MAIN HANDLER ────────────────────────────────────────────────────────────
// Safe day label — travelDate is optional, empty string or null both handled
function buildDayLabel(travelDate, dayIndex) {
  if (!travelDate || travelDate.trim() === '') return `Day ${dayIndex + 1}`;
  const d = new Date(travelDate);
  if (isNaN(d.getTime())) return `Day ${dayIndex + 1}`;
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

exports.handler = async (event, context) => {
  const { submissionId, creditSource = null } = event;
  log.info('Itinerary generation started', { submissionId });
  const db = getDB();

  // Generation races an internal deadline; on failure or deadline the submission is
  // failed, refunded and the user emailed (failure.js). ctl.aborted stops a generation
  // that is still running in the background from storing anything afterwards.
  const ctl = { aborted: false };
  const remaining = typeof context?.getRemainingTimeInMillis === 'function' ? context.getRemainingTimeInMillis() : null;
  let timer;
  const deadline = remaining
    ? new Promise((_, reject) => {
      timer = setTimeout(() => reject(new GenerationFailed('Generation took too long', { reason: 'deadline' })),
        Math.max(remaining - DEADLINE_MARGIN_MS, 1000));
    })
    : null;

  try {
    const work = generate(event, db, ctl);
    await (deadline ? Promise.race([work, deadline]) : work);
  } catch (err) {
    ctl.aborted = true;
    log.error('Itinerary generation failed', { submissionId, reason: err.reason || 'error', error: err.message });
    try {
      const outcome = await handleGenerationFailure({
        db, sendEmail, submissionId, creditSource, errorMessage: err.message,
        frontendUrl: process.env.FRONTEND_URL, log,
      });
      log.info('Generation failure handled', { submissionId, ...outcome });
    } catch (handlingErr) {
      log.error('Handling the generation failure failed', { submissionId, error: handlingErr.message });
    }
  } finally {
    clearTimeout(timer);
  }
};

async function generate(event, db, ctl) {
  const { submissionId, isPaid } = event;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  {
    // ── Fetch submission ──────────────────────────────────────────────────
    const result = await db.query(`SELECT * FROM submissions WHERE id = $1`, [submissionId]);
    if (!result.rows.length) { log.error('Submission not found', { submissionId }); return; }

    const row = result.rows[0];
    // A repeated invocation (Lambda async retry) must not redo or undo finished work.
    if (['failed', 'itinerary_ready', 'pdf_ready', 'email_sent'].includes(row.status)) {
      log.warn('Submission already finished — skipping', { submissionId, status: row.status });
      return;
    }
    const submission = {
      destination: row.destination,
      days: row.days,
      budget: row.budget,
      currency: row.currency,
      travelerType: row.traveler_type,
      travelStyle: row.travel_style,
      interests: row.interests,
      travelDate: row.travel_date || null,
      startTime: row.start_time || '09:00',
      userMustDos: row.user_must_dos || null,
      travelPace: row.travel_pace,
      wantsHotelRecs: row.wants_hotel_recs,
      language: row.language || 'English',
      userAge: row.user_age || null,
      userLocation: row.user_location || '',
      email: row.email,
      selectedVenues: row.selected_venues || {},
    };
    // Step 3 picks with a day each (pinned by the user, or spread across the trip).
    submission.picksPlan = planPicks(submission.selectedVenues, submission.days);
    log.info('Step 3 picks planned', {
      submissionId,
      picks: submission.picksPlan.picks.length,
      pinned: submission.picksPlan.picks.filter(p => p.pinned).length,
      interests: submission.picksPlan.interests.length,
    });

    const currencySymbol = getCurrencySymbol(submission.currency);

    await db.query(`UPDATE submissions SET status = 'processing', updated_at = NOW() WHERE id = $1`, [submissionId]);

    // ── Fetch Foursquare tips once upfront ───────────────────────────────
    log.info('Fetching Foursquare tips', { submissionId, destination: submission.destination });
    const fsTips = await fetchFoursquareTips(submission.destination);
    if (fsTips) {
      log.info('Foursquare tips fetched', { submissionId, tipCount: fsTips.split('\n').length });
    } else {
      log.info('Foursquare tips unavailable', { submissionId });
    }

    // ── Overview + days in batches of 3, in parallel ─────────────────────
    // The overview and each batch are independent calls, so they run concurrently
    // (BATCH_CONCURRENCY batches at a time) — needed for Opus to finish long trips in time.
    const totalDays = submission.days;
    const batchSize = 3;
    const batches = [];
    for (let i = 1; i <= totalDays; i += batchSize) {
      const batchNums = [];
      for (let j = i; j < i + batchSize && j <= totalDays; j++) batchNums.push(j);
      batches.push(batchNums);
    }

    log.info('Generating overview and day batches', { submissionId, destination: submission.destination, batches: batches.length });
    const [metaResult, batchResults] = await Promise.all([
      generateMeta(submission, currencySymbol, submissionId, fsTips),
      mapLimit(batches, BATCH_CONCURRENCY, (batchNums) => {
        log.info('Generating batch', { submissionId, days: batchNums });
        return generateDaysBatch(submission, batchNums, currencySymbol, submissionId, fsTips);
      }),
    ]);

    const { data: meta, usage: metaUsage } = metaResult;
    totalInputTokens += metaUsage?.input_tokens || 0;
    totalOutputTokens += metaUsage?.output_tokens || 0;

    const allDays = [];
    batchResults.forEach(({ days: batchDays, usage: batchUsage }, b) => {
      const batchNums = batches[b];
      // Ensure day numbers are correct
      batchDays.forEach((day, idx) => { day.dayNumber = batchNums[idx] || batchNums[0] + idx; });
      allDays.push(...batchDays);
      totalInputTokens += batchUsage?.input_tokens || 0;
      totalOutputTokens += batchUsage?.output_tokens || 0;
    });

    // ── Merge everything ──────────────────────────────────────────────────
    let itinerary = {
      ...meta,
      days: allDays.sort((a, b) => a.dayNumber - b.dayNumber),
      totalEstimatedCost: meta.totalEstimatedCost || submission.budget,
    };

    // ── Q3 validation pass: duplicates + Step 3 picks, repaired once ──────
    const coverageOf = (days) => (submission.picksPlan.picks.length
      ? findMissingPicks(days, submission.picksPlan)
      : { missing: [], wrongDay: [] });
    const summarise = (days, cov) => ({
      duplicates: findDuplicateVenues(days).map(d => ({ name: d.name, days: [d.firstDay, ...d.repeatDays] })),
      missingPicks: cov.missing.map(p => ({ name: p.name, day: p.day })),
      wrongDayPicks: cov.wrongDay.map(p => ({ name: p.name, day: p.day })),
    });

    const coverageBefore = coverageOf(itinerary.days);
    const before = summarise(itinerary.days, coverageBefore);
    const repairs = planRepairs({ days: itinerary.days, coverage: coverageBefore });
    const repaired = [];

    // Repairs are independent single days (≤ MAX_REPAIR_DAYS) — run them together.
    const repairResults = await Promise.all([...repairs].map(async ([dayNumber, repair]) => {
      try {
        const { days: fixed, usage } = await generateDaysBatch(
          submission, [dayNumber], currencySymbol, submissionId, fsTips, repairRules(repair)
        );
        return { dayNumber, repair, fixed, usage };
      } catch (err) {
        log.warn('Validation repair failed — keeping original day', { submissionId, dayNumber, error: err.message });
        return null;
      }
    }));
    for (const r of repairResults) {
      if (!r) continue;
      totalInputTokens += r.usage?.input_tokens || 0;
      totalOutputTokens += r.usage?.output_tokens || 0;
      const replacement = r.fixed?.[0];
      if (!replacement) continue; // keep the original day
      replacement.dayNumber = r.dayNumber;
      const idx = itinerary.days.findIndex(d => d.dayNumber === r.dayNumber);
      if (idx >= 0) { itinerary.days[idx] = replacement; repaired.push({ day: r.dayNumber, reasons: r.repair.reasons }); }
    }
    repaired.sort((a, b) => a.day - b.day);

    const coverageAfter = repaired.length ? coverageOf(itinerary.days) : coverageBefore;
    const after = repaired.length ? summarise(itinerary.days, coverageAfter) : before;
    itinerary.validation = { before, repaired, after };
    if (submission.picksPlan.picks.length) {
      itinerary.pickCoverage = {
        picked: submission.picksPlan.picks.length,
        included: submission.picksPlan.picks.length - coverageAfter.missing.length,
        missing: after.missingPicks,
        wrongDay: after.wrongDayPicks,
      };
    }
    const clean = !after.duplicates.length && !after.missingPicks.length && !after.wrongDayPicks.length;
    (clean ? log.info : log.warn)('Itinerary validation', {
      submissionId,
      issuesBefore: before.duplicates.length + before.missingPicks.length + before.wrongDayPicks.length,
      repairedDays: repaired.map(r => r.day),
      after,
    });

    // Attach full venue objects to activities by matching venueName
    const allFoursquareVenues = await searchVenues(submission.destination, { limit: 50 });
    itinerary = attachVenuesToItinerary(itinerary, allFoursquareVenues);
    log.info('Venues attached to itinerary', { submissionId, foursquareVenuesFetched: allFoursquareVenues.length });

    // Audit venues in assembled itinerary
    const venuesWithSocial = [];
    allDays.forEach(day => {
      ['morningActivity', 'afternoonActivity', 'eveningActivity'].forEach(period => {
        const act = day[period];
        if (act && act.venue && act.venue.social) {
          venuesWithSocial.push({
            name: act.venue.name,
            social: Object.keys(act.venue.social).filter(k => act.venue.social[k]),
            fsqPlaceId: act.venue.fsqPlaceId
          });
        }
      });
      if (day.localEats && day.localEats.venue && day.localEats.venue.social) {
        venuesWithSocial.push({
          name: day.localEats.venue.name,
          social: Object.keys(day.localEats.venue.social).filter(k => day.localEats.venue.social[k]),
          fsqPlaceId: day.localEats.venue.fsqPlaceId
        });
      }
    });

    log.info('Itinerary assembled', {
      submissionId,
      totalDays: allDays.length,
      totalInputTokens,
      totalOutputTokens,
      venuesWithSocial: venuesWithSocial.length,
      socialVenues: venuesWithSocial,
    });

    // ── Store itinerary ───────────────────────────────────────────────────
    // Deadline already hit and the user told it failed (and refunded): store nothing.
    if (ctl.aborted) { log.warn('Generation finished after the deadline — discarded', { submissionId }); return; }
    const itineraryId = generateId();
    await db.query(
      `INSERT INTO itineraries
       (id, submission_id, email, destination, itinerary_data,
        total_cost, currency, claude_input_tokens, claude_output_tokens, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [
        itineraryId, submissionId, submission.email, submission.destination,
        JSON.stringify(itinerary), itinerary.totalEstimatedCost, submission.currency,
        totalInputTokens, totalOutputTokens,
      ]
    );

    await db.query(
      `UPDATE submissions SET status = 'itinerary_ready', itinerary_id = $1, updated_at = NOW() WHERE id = $2`,
      [itineraryId, submissionId]
    );

    log.info('Itinerary stored', { itineraryId, submissionId });

    // ── Trigger PDF builder ───────────────────────────────────────────────
    await lambda.send(new InvokeCommand({
      FunctionName: `wanderzenai-pdf-builder-${process.env.STAGE}`,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({ itineraryId, submissionId, email: submission.email, isPaid, submission })),
    }));

    log.info('PDF builder triggered', { itineraryId });
  }
}
