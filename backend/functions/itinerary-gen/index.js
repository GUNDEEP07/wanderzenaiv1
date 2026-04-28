'use strict';

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, generateId, getCurrencySymbol, log, fetchFoursquareTips } = require('/opt/nodejs/index');

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
  "morningActivity": {"time":"string","activity":"string","location":"string","why":"string","cost":number,"isFree":boolean,"insiderTip":"string"},
  "afternoonActivity": {"time":"string","activity":"string","location":"string","why":"string","cost":number,"isFree":boolean,"insiderTip":"string"},
  "eveningActivity": {"time":"string","activity":"string","location":"string","why":"string","cost":number,"isFree":boolean,"insiderTip":"string"},
  "hiddenGem": "string",
  "dailyCost": number,
  "localEats": {"name":"string","dish":"string","cost":number,"vibe":"string"}
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
const callClaude = async (systemPrompt, userPrompt, maxTokens, submissionId, attempt = 1) => {
  log.info('Claude API call', { submissionId, maxTokens, attempt });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.content[0].text;

  log.info('Claude response', {
    submissionId,
    attempt,
    inputTokens: data.usage?.input_tokens,
    outputTokens: data.usage?.output_tokens,
    stopReason: data.stop_reason,
  });

  // If stop_reason is max_tokens, response was cut off — retry with more tokens
  if (data.stop_reason === 'max_tokens' && attempt === 1) {
    log.warn('Response truncated, retrying with higher token limit', { submissionId });
    return callClaude(systemPrompt, userPrompt, Math.min(maxTokens + 2000, 8000), submissionId, 2);
  }

  return { raw, usage: data.usage };
};

// ─── GENERATE META (title, summary, accommodation, tips) ────────────────────
const generateMeta = async (submission, currencySymbol, submissionId, fsTips = null) => {
  const { destination, days, budget, currency, travelerType, travelStyle, travelPace, interests, startTime, userMustDos, userAge, userLocation, language } = submission;
  const styleList = Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle;

  const prompt = `Create the overview section for a ${days}-day slow travel itinerary for ${destination}.

Traveller: ${travelerType}, budget ${currencySymbol}${budget} ${currency}, style: ${styleList || 'balanced'}, pace: ${travelPace}
${interests ? `Interests: ${interests}` : ''}
${startTime && startTime !== '09:00' ? `Day starts: ${startTime} — do not schedule anything before this time` : ''}
${userMustDos ? `Must include: ${userMustDos}` : ''}
${startTime && startTime !== '09:00' ? `Day starts: ${startTime} — schedule nothing before this time` : ''}
${userMustDos ? `Must include: ${userMustDos}` : ''}
${userAge ? `Age: ${userAge}` : ''}
${userLocation ? `From: ${userLocation}` : ''}
Language: Write ENTIRELY in ${language || 'English'}.
${fsTips ? `

Real verified venues in ${destination} — reference these specifically by name and include their map links:
${fsTips}

For each venue mentioned: include the venue name exactly as given, and add the Google Maps link as [View on map](url) after the activity description.` : ''}

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
const generateDaysBatch = async (submission, dayNumbers, currencySymbol, submissionId, fsTips = null) => {
  const { destination, budget, currency, travelerType, travelStyle, travelPace, interests, startTime, userMustDos, userAge, userLocation, language, days: totalDays } = submission;
  const styleList = Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle;
  const dailyBudget = Math.round(budget / totalDays);

  const prompt = `Create days ${dayNumbers.join(', ')} of ${totalDays} for a slow travel itinerary in ${destination}.

Traveller: ${travelerType}, daily budget ~${currencySymbol}${dailyBudget} ${currency}, style: ${styleList || 'balanced'}, pace: ${travelPace}
${interests ? `Interests: ${interests}` : ''}
${startTime && startTime !== '09:00' ? `Day starts: ${startTime} — do not schedule anything before this time` : ''}
${userMustDos ? `Must include: ${userMustDos}` : ''}
${startTime && startTime !== '09:00' ? `Day starts: ${startTime} — schedule nothing before this time` : ''}
${userMustDos ? `Must include: ${userMustDos}` : ''}
${userAge ? `Age: ${userAge}` : ''}
${userLocation ? `From: ${userLocation}` : ''}
Language: Write ENTIRELY in ${language || 'English'}.

Rules:
- Avoid tourist traps — find what locals actually do
- One completely free hidden gem per day
- Specific place names, not generic descriptions
- Costs in ${currency} (${currencySymbol})
${fsTips ? `\n\nReal verified venues — use these specific names:\n${fsTips}\nFor each venue mentioned add: [View on map](https://maps.google.com/?q=VENUE+NAME+DESTINATION)` : ''}

Return ONLY a JSON object with a "days" array containing ${dayNumbers.length} day object(s):
{
  "days": [
    ${DAY_SCHEMA}
  ]
}`;

  // 1800 tokens per day is comfortable for 3 days
  const maxTokens = Math.min(1800 * dayNumbers.length + 400, 6000);
  const { raw, usage } = await callClaude(SYSTEM_PROMPT, prompt, maxTokens, submissionId);

  try {
    const parsed = parseJSON(raw);
    if (!parsed.days || !Array.isArray(parsed.days)) {
      throw new Error('No days array in response');
    }
    return { days: parsed.days, usage };
  } catch (e) {
    log.error('Days batch parse failed', { submissionId, dayNumbers, raw: raw.substring(0, 400) });

    // Retry this batch once with Sonnet for better reliability
    log.info('Retrying batch with Sonnet', { submissionId, dayNumbers });
    try {
      const retryResp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: maxTokens + 1000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const retryData = await retryResp.json();
      const retryRaw = retryData.content[0].text;
      const retryParsed = parseJSON(retryRaw);
      if (retryParsed.days && Array.isArray(retryParsed.days)) {
        return { days: retryParsed.days, usage: retryData.usage };
      }
    } catch (retryErr) {
      log.error('Retry also failed', { submissionId, dayNumbers, error: retryErr.message });
    }

    // Fallback: generate minimal day objects rather than failing
    return {
      days: dayNumbers.map(n => ({
        dayNumber: n,
        theme: `Day ${n} — Local Exploration`,
        morningActivity: { time: '8:00 AM', activity: `Morning walk through local neighbourhood`, location: destination, why: 'The best way to feel the pulse of a place', cost: 0, isFree: true, insiderTip: 'Go before 9am for the quietest experience' },
        afternoonActivity: { time: '1:00 PM', activity: `Visit a local market`, location: `${destination} market`, why: 'Where locals actually shop and eat', cost: Math.round(dailyBudget * 0.3), isFree: false, insiderTip: 'Prices are lower away from the main entrance' },
        eveningActivity: { time: '7:00 PM', activity: `Dinner at a local restaurant`, location: `${destination}`, why: 'Eat where the locals eat', cost: Math.round(dailyBudget * 0.4), isFree: false, insiderTip: 'Ask your guesthouse host for their favourite spot' },
        hiddenGem: `Ask your accommodation host about their favourite local secret — they always know something special`,
        dailyCost: dailyBudget,
        localEats: { name: 'Ask locally', dish: 'The daily special', cost: Math.round(dailyBudget * 0.2), vibe: 'Wherever locals are eating' },
      })),
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }
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

exports.handler = async (event) => {
  const { submissionId, isPaid } = event;
  log.info('Itinerary generation started', { submissionId });

  const db = getDB();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  try {
    // ── Fetch submission ──────────────────────────────────────────────────
    const result = await db.query(`SELECT * FROM submissions WHERE id = $1`, [submissionId]);
    if (!result.rows.length) { log.error('Submission not found', { submissionId }); return; }

    const row = result.rows[0];
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
    };

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

    // ── Generate meta (title, summary, accommodation, tips) ───────────────
    log.info('Generating meta', { submissionId, destination: submission.destination });
    const { data: meta, usage: metaUsage } = await generateMeta(submission, currencySymbol, submissionId, fsTips);
    totalInputTokens += metaUsage?.input_tokens || 0;
    totalOutputTokens += metaUsage?.output_tokens || 0;

    // ── Generate days in batches of 3 ────────────────────────────────────
    const totalDays = submission.days;
    const batchSize = 3;
    const allDays = [];

    for (let i = 1; i <= totalDays; i += batchSize) {
      const batchNums = [];
      for (let j = i; j < i + batchSize && j <= totalDays; j++) batchNums.push(j);

      log.info('Generating batch', { submissionId, days: batchNums });
      const { days: batchDays, usage: batchUsage } = await generateDaysBatch(submission, batchNums, currencySymbol, submissionId, fsTips);

      // Ensure day numbers are correct
      batchDays.forEach((day, idx) => { day.dayNumber = batchNums[idx] || batchNums[0] + idx; });
      allDays.push(...batchDays);

      totalInputTokens += batchUsage?.input_tokens || 0;
      totalOutputTokens += batchUsage?.output_tokens || 0;

      // Small delay between batches to avoid rate limits
      if (i + batchSize <= totalDays) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // ── Merge everything ──────────────────────────────────────────────────
    const itinerary = {
      ...meta,
      days: allDays.sort((a, b) => a.dayNumber - b.dayNumber),
      totalEstimatedCost: meta.totalEstimatedCost || submission.budget,
    };

    log.info('Itinerary assembled', {
      submissionId,
      totalDays: allDays.length,
      totalInputTokens,
      totalOutputTokens,
    });

    // ── Store itinerary ───────────────────────────────────────────────────
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

  } catch (err) {
    log.error('Itinerary generation failed', { submissionId, error: err.message });
    await db.query(
      `UPDATE submissions SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
      [err.message, submissionId]
    ).catch(() => {});
  }
};
