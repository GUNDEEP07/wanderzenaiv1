import { Anthropic } from '@anthropic-ai/sdk';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export async function handler(event) {
  console.log('Destination Insights request:', JSON.stringify(event));

  const queryParams = event.queryStringParameters || {};
  const destination = queryParams.destination;
  const startDate = queryParams.startDate;
  const endDate = queryParams.endDate;
  const travelStyles = queryParams.travelStyles ? queryParams.travelStyles.split(',').map(s => s.trim()) : [];

  if (!destination || !startDate || !endDate) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Missing required fields: destination, startDate, endDate' }),
    };
  }

  try {
    const cacheKey = { destination, startDate, endDate };
    const cached = await getFromCache(cacheKey, travelStyles);
    if (cached) {
      console.log(`Cache hit for ${destination} [${startDate} to ${endDate}]`);
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ insights: cached, cached: true }),
      };
    }

    console.log(`Cache miss for ${destination} [${startDate} to ${endDate}], calling Claude...`);

    const insights = await generateInsights(destination, travelStyles, startDate, endDate);
    await saveToCache(cacheKey, travelStyles, insights);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ insights, cached: false }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message }),
    };
  }
}

async function getFromCache(cacheKey, travelStyles) {
  const query = `
    SELECT insights FROM destination_insights_cache
    WHERE destination = $1
      AND start_date = $2
      AND end_date = $3
      AND expires_at > NOW()
    LIMIT 1
  `;

  const result = await pool.query(query, [cacheKey.destination, cacheKey.startDate, cacheKey.endDate]);
  return result.rows.length > 0 ? result.rows[0].insights : null;
}

async function saveToCache(cacheKey, travelStyles, insights) {
  const query = `
    INSERT INTO destination_insights_cache
      (destination, start_date, end_date, travel_styles, insights, expires_at)
    VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '30 days')
    ON CONFLICT (destination, start_date, end_date, travel_styles) DO UPDATE SET
      insights = $5,
      expires_at = NOW() + INTERVAL '30 days'
    RETURNING id
  `;

  const result = await pool.query(query, [
    cacheKey.destination,
    cacheKey.startDate,
    cacheKey.endDate,
    JSON.stringify(travelStyles),
    JSON.stringify(insights),
  ]);

  console.log(`Cached insights for ${cacheKey.destination} with ID: ${result.rows[0].id}`);
}

async function generateInsights(destination, travelStyles, startDate, endDate) {
  const stylesText = travelStyles.length > 0 ? travelStyles.join(', ') : 'general travel';

  const prompt = `You are a travel expert providing insights about destinations.
Generate travel insights for ${destination} for travel styles: ${stylesText}.
Travel dates: ${startDate} to ${endDate}.

Return a JSON object with this exact structure:
{
  "bestMonths": ["month1", "month2", ...],
  "whyThisMonth": "Brief explanation of why these months are best",
  "thingsToDo": [
    {
      "name": "Activity name",
      "category": "Category (e.g., Food, Culture, Nature, Adventure)",
      "reason": "Why this is good for these travel styles",
      "emoji": "🏛️"
    }
  ],
  "seasonalHighlights": "What makes this season special in this destination",
  "weather": "Expected weather conditions during travel dates",
  "crowdLevel": "Peak/High/Moderate/Low - estimated crowd level",
  "travelTip": "One specific, actionable tip for this destination and travel style"
}

Be specific to the destination and travel styles. Keep responses concise.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response (Claude might wrap it in markdown code blocks)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not extract JSON from Claude response');
  }

  return JSON.parse(jsonMatch[0]);
}
