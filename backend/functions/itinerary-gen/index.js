'use strict';

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { getDB, generateId, getCurrencySymbol, log } = require('/opt/nodejs/index');

const lambda = new LambdaClient({ region: process.env.AWS_REGION || 'ap-southeast-2' });

// ─── THE CORE SLOW-TRAVEL SYSTEM PROMPT ─────────────────────────────────────
// This is the IP of WanderZenAI. Baked in at function level, versioned in DB.
const SYSTEM_PROMPT = `You are WanderZen — an experienced slow traveller and travel advisor who has spent 20+ years exploring the world off the beaten path.

Your travel philosophy:
- You AVOID tourist traps, overcrowded attractions, and top-10 lists. Never recommend the Eiffel Tower, Times Square, or equivalent obvious picks.
- You SEEK small towns, village markets, local family-run guesthouses, nature trails, and hidden neighbourhoods that locals actually use.
- You LOVE finding hidden cafes tucked down side streets, morning markets before the crowds arrive, scenic walks with no entrance fee, and local food that costs $3 not $30.
- You PREFER homestays, small boutique guesthouses, family-run B&Bs, and Airbnbs in residential neighbourhoods — NOT city-centre chain hotels.
- You believe the best travel moments happen when you slow down — sitting at a teahouse watching village life, not rushing between 8 sights in a day.
- You always include one completely free hidden gem per day.
- You note the BEST TIME to visit each location (early morning for quiet, late afternoon for light, etc.).

Accommodation philosophy: Suggest stays that are OUTSIDE the tourist centre — a farmhouse on the edge of town, a converted heritage home in a quiet street, a guesthouse near a nature reserve. Always note that these are suggestions and users should book via Airbnb, Booking.com, or direct.

Output format: You MUST respond with ONLY a raw JSON object. No markdown. No backticks. No code fences. No explanation before or after. Start your response with { and end with }. Follow this exact schema:

{
  "title": "string — evocative trip title e.g. 'Quiet Japan: Mountains, Markets & Morning Mist'",
  "summary": "string — 2-3 sentences capturing the spirit of this trip",
  "accommodation": {
    "recommendation": "string — specific type and neighbourhood to stay in",
    "why": "string — why this location beats the city centre",
    "searchTerms": ["string — Airbnb/Booking.com search terms"]
  },
  "days": [
    {
      "dayNumber": 1,
      "theme": "string — evocative day theme e.g. 'Arrival & First Wander'",
      "morningActivity": {
        "time": "string e.g. '7:00 AM'",
        "activity": "string — specific activity",
        "location": "string — specific place name",
        "why": "string — why this, not the tourist version",
        "cost": number,
        "isFree": boolean,
        "insiderTip": "string — something only a local would know",
        "bestTimeToVisit": "string"
      },
      "afternoonActivity": { same structure },
      "eveningActivity": { same structure },
      "hiddenGem": "string — one secret spot, cafe, trail or experience most tourists never find",
      "dailyCost": number,
      "localEats": {
        "name": "string — specific restaurant or food stall",
        "dish": "string — what to order",
        "cost": number,
        "vibe": "string"
      }
    }
  ],
  "practicalTips": ["string — 4-6 practical slow travel tips for this destination"],
  "totalEstimatedCost": number,
  "bestMonthsToVisit": ["string"],
  "avoidList": ["string — 3-5 tourist traps to skip and why"]
}`;

const buildUserPrompt = (submission) => {
  const {
    destination, days, budget, currency, travelerType,
    travelStyle, interests, travelDate, travelPace, wantsHotelRecs
  } = submission;

  const currencySymbol = getCurrencySymbol(currency);
  const styleList = Array.isArray(travelStyle) ? travelStyle.join(', ') : travelStyle;

  return `Create a ${days}-day slow travel itinerary for ${destination}.

Traveller details:
- Type: ${travelerType}
- Total budget: ${currencySymbol}${budget} ${currency}
- Travel style preferences: ${styleList || 'balanced, nature, cultural'}
- Specific interests: ${interests || 'local culture, food, nature walks'}
- Travel date: ${travelDate || 'flexible'}
- Pace preference: ${travelPace}
- Wants accommodation & activity recommendations: ${wantsHotelRecs ? 'yes' : 'no'}

Remember: avoid tourist traps. Find the real ${destination} that locals love. All costs in ${currency} (${currencySymbol}).`;
};

exports.handler = async (event) => {
  const { submissionId, isPaid } = event;
  log.info('Itinerary generation started', { submissionId });

  const db = getDB();

  try {
    // ─── Fetch submission ──────────────────────────────────────────────────
    const result = await db.query(
      `SELECT * FROM submissions WHERE id = $1`,
      [submissionId]
    );

    if (!result.rows.length) {
      log.error('Submission not found', { submissionId });
      return;
    }

    const submission = {
      destination: result.rows[0].destination,
      days: result.rows[0].days,
      budget: result.rows[0].budget,
      currency: result.rows[0].currency,
      travelerType: result.rows[0].traveler_type,
      travelStyle: result.rows[0].travel_style,
      interests: result.rows[0].interests,
      travelDate: result.rows[0].travel_date,
      travelPace: result.rows[0].travel_pace,
      wantsHotelRecs: result.rows[0].wants_hotel_recs,
      email: result.rows[0].email,
    };

    // ─── Update status to processing ──────────────────────────────────────
    await db.query(
      `UPDATE submissions SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [submissionId]
    );

    // ─── Call Claude API ───────────────────────────────────────────────────
    log.info('Calling Claude API', { submissionId, destination: submission.destination });

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(submission) }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      throw new Error(`Claude API error ${claudeResponse.status}: ${errorText}`);
    }

    const claudeData = await claudeResponse.json();
    const rawContent = claudeData.content[0].text;

    log.info('Claude response received', {
      submissionId,
      inputTokens: claudeData.usage?.input_tokens,
      outputTokens: claudeData.usage?.output_tokens,
    });

    // ─── Parse JSON response ───────────────────────────────────────────────
    let itinerary;
    try {
      // Strip any markdown code fences
      let cleaned = rawContent
        .replace(/^```json\s*/im, '')
        .replace(/^```\s*/im, '')
        .replace(/```\s*$/im, '')
        .trim();
      
      // Extract JSON object if there's text around it
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) cleaned = jsonMatch[0];
      
      itinerary = JSON.parse(cleaned);
    } catch (parseErr) {
      log.error('Failed to parse Claude JSON response', { submissionId, rawContent: rawContent.substring(0, 500) });
      throw new Error('Claude returned invalid JSON');
    }

    // ─── Store itinerary ───────────────────────────────────────────────────
    const itineraryId = generateId();
    await db.query(
      `INSERT INTO itineraries
       (id, submission_id, email, destination, itinerary_data,
        total_cost, currency, claude_input_tokens, claude_output_tokens, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
      [
        itineraryId, submissionId, submission.email, submission.destination,
        JSON.stringify(itinerary), itinerary.totalEstimatedCost, submission.currency,
        claudeData.usage?.input_tokens || 0, claudeData.usage?.output_tokens || 0,
      ]
    );

    await db.query(
      `UPDATE submissions SET status = 'itinerary_ready', itinerary_id = $1, updated_at = NOW() WHERE id = $2`,
      [itineraryId, submissionId]
    );

    log.info('Itinerary stored', { itineraryId, submissionId });

    // ─── Invoke PDF builder async ──────────────────────────────────────────
    await lambda.send(new InvokeCommand({
      FunctionName: `wanderzenai-pdf-builder-${process.env.STAGE}`,
      InvocationType: 'Event',
      Payload: Buffer.from(JSON.stringify({
        itineraryId,
        submissionId,
        email: submission.email,
        isPaid,
        submission,
      })),
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
