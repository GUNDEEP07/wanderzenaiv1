# AI Venue Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Foursquare returns 0 venues for an activity in a city, call Claude Haiku to generate 5 real local venue suggestions returned in the same structure, with an `source: 'ai'` flag so the frontend can badge them.

**Architecture:** The fallback lives entirely in the `recommendations` Lambda — if `categories.length === 0` after the Foursquare loop, `generateAIVenues` is called. Frontend maps the new `source` field and renders an "AI" badge on AI-generated venues. No new Lambda, no new endpoint — same API contract.

**Tech Stack:** Node 20 Lambda, `@anthropic-ai/sdk`, AWS SAM, React 18

---

## File Map

| File | Action |
|---|---|
| `infra/template.yaml` | Add `CLAUDE_API_KEY` env var + increase timeout to 25s on RecommendationsFunction |
| `backend/functions/recommendations/package.json` | Add `@anthropic-ai/sdk ^0.51.0` |
| `backend/functions/recommendations/index.js` | Import Anthropic, add `generateAIVenues`, call it in `handleVenues` |
| `frontend/src/utils/foursquare.js` | Map `source`, `description`, `openingHours` fields |
| `frontend/src/components/plantrip/subcomponents/VenuesList.jsx` | AI badge on venue cards + disclaimer line |

---

## Task 1: SAM template — add CLAUDE_API_KEY + increase timeout

**Files:**
- Modify: `infra/template.yaml`

- [ ] **Step 1: Add `CLAUDE_API_KEY` to RecommendationsFunction env and raise timeout**

Find the `RecommendationsFunction` Properties block. It currently looks like:

```yaml
  RecommendationsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub wanderzenai-recommendations-${Stage}
      CodeUri: ../backend/functions/recommendations
      Handler: index.handler
      Timeout: 10
      MemorySize: 256
      Description: Provides destination autocomplete and venue discovery via Foursquare API
      Environment:
        Variables:
          FOURSQUARE_API_KEY: !Ref FoursquareApiKey
          FRONTEND_URL: !Ref FrontendUrl
          ALLOWED_ORIGINS: !Ref AllowedOrigins
```

Change `Timeout: 10` to `Timeout: 25` and add `CLAUDE_API_KEY: !Ref ClaudeApiKey` under Variables:

```yaml
  RecommendationsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub wanderzenai-recommendations-${Stage}
      CodeUri: ../backend/functions/recommendations
      Handler: index.handler
      Timeout: 25
      MemorySize: 256
      Description: Provides destination autocomplete and venue discovery via Foursquare API
      Environment:
        Variables:
          FOURSQUARE_API_KEY: !Ref FoursquareApiKey
          FRONTEND_URL: !Ref FrontendUrl
          ALLOWED_ORIGINS: !Ref AllowedOrigins
          CLAUDE_API_KEY: !Ref ClaudeApiKey
```

- [ ] **Step 2: Validate SAM template**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/infra && sam validate --template template.yaml 2>&1 | tail -5
```

Expected: `template.yaml is a valid SAM Template` (or no errors).

- [ ] **Step 3: Commit**

```bash
git add infra/template.yaml
git commit -m "infra: add CLAUDE_API_KEY to recommendations Lambda, increase timeout to 25s"
```

---

## Task 2: Add Anthropic SDK + implement generateAIVenues

**Files:**
- Modify: `backend/functions/recommendations/package.json`
- Modify: `backend/functions/recommendations/index.js`

- [ ] **Step 1: Add @anthropic-ai/sdk to package.json**

Replace the full contents of `backend/functions/recommendations/package.json`:

```json
{
  "name": "recommendations",
  "version": "1.0.0",
  "dependencies": {
    "axios": "^1.6.0",
    "@anthropic-ai/sdk": "^0.51.0"
  }
}
```

- [ ] **Step 2: Install the dependency**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/backend/functions/recommendations && npm install 2>&1 | tail -5
```

Expected: `added N packages` with no errors.

- [ ] **Step 3: Add Anthropic import and CLAUDE_API_KEY constant at top of index.js**

At the top of `backend/functions/recommendations/index.js`, after the existing requires, add:

```js
const Anthropic = require('@anthropic-ai/sdk');
```

And after `const GOOGLE_PLACES_BASE = ...` line, add:

```js
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
```

- [ ] **Step 4: Add generateAIVenues function**

Add this function before the `handleCategories` function (around line 410):

```js
async function generateAIVenues(destination, activity, lat, lng) {
  if (!CLAUDE_API_KEY) return [];

  const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

  const prompt = `You are a local travel expert. List 5 real, specific places for "${activity}" in ${destination}.

Return a JSON array ONLY — no explanation, no markdown:
[
  {
    "name": "Exact name of the place",
    "address": "Street address or neighbourhood name",
    "description": "One sentence on why a slow traveller would love this",
    "openingHours": "e.g. Daily 8am–9pm or Mon–Sat 10am–6pm",
    "category": "${activity}"
  }
]

Rules:
- Use real, verifiable places
- Be specific — no generic names like "Local Cafe"
- If you are not sure of exact hours, give a typical range for that type of place`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const places = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(places)) return [];

    return places.slice(0, 5).map((place, i) => ({
      fsq_id: `ai-${activity}-${i}`,
      name: place.name || 'Unknown',
      category: place.category || activity,
      rating: null,
      reviewCount: 0,
      score: 0,
      address: place.address || '',
      description: place.description || '',
      openingHours: place.openingHours || '',
      lat: parseFloat(lat) || null,
      lng: parseFloat(lng) || null,
      source: 'ai',
      photoUrl: null,
      photos: [],
      instagramUrl: null,
      hours: { open_now: null, display: place.openingHours || null },
      website: null,
      tel: null,
    }));
  } catch (err) {
    log.warn('AI venue fallback failed', { error: err.message, destination, activity });
    return [];
  }
}
```

- [ ] **Step 5: Call generateAIVenues in handleVenues after the Foursquare loop**

In `handleVenues`, find the line:

```js
    log.info('Venues success', { destination, categoryCount: categories.length });
    return ok({
      destination,
      categories: categories.slice(0, 10),
    }, event);
```

Replace it with:

```js
    // If Foursquare returned nothing, fall back to Claude AI
    if (categories.length === 0) {
      log.info('Foursquare returned 0 venues, trying AI fallback', { destination, activity });
      const aiVenues = await generateAIVenues(destination, activity, lat, lng);
      if (aiVenues.length > 0) {
        categories.push({
          category: activity,
          venues: aiVenues,
          source: 'ai',
        });
        log.info('AI fallback success', { destination, activity, count: aiVenues.length });
      }
    }

    log.info('Venues success', { destination, categoryCount: categories.length });
    return ok({
      destination,
      categories: categories.slice(0, 10),
    }, event);
```

- [ ] **Step 6: Verify the Lambda syntax is valid**

```bash
node -e "require('./backend/functions/recommendations/index.js')" 2>&1 | head -5
```

Expected: no output (no syntax errors). If you see an error, fix it before continuing.

- [ ] **Step 7: Commit**

```bash
git add backend/functions/recommendations/package.json \
        backend/functions/recommendations/index.js
git commit -m "feat: Claude Haiku AI venue fallback when Foursquare returns 0 results"
```

---

## Task 3: Frontend — map source + description fields

**Files:**
- Modify: `frontend/src/utils/foursquare.js`

- [ ] **Step 1: Add source and description to the venue mapping in fetchVenuesForActivity**

Find the `return matchingCategory.venues.map(venue => ({` block. It currently ends like:

```js
      website: venue.website || null,
      tel: venue.tel || null,
    }));
```

Add `source`, `description`, `openingHours` fields before `website`:

```js
      source: venue.source || 'foursquare',
      description: venue.description || null,
      openingHours: venue.openingHours || venue.hours?.display || null,
      website: venue.website || null,
      tel: venue.tel || null,
    }));
```

- [ ] **Step 2: Handle the AI fallback category matching**

When the backend uses the AI fallback, it pushes `{ category: activity, venues: [...] }` where `category` is the raw activity string (e.g. `"Cafes"`). The existing matching logic tries to find a matching category by lowercase comparison. The AI category will match because `category === activity`.

Verify the existing logic handles this: find the `matchingCategory` assignment. It already does:
```js
let matchingCategory = data.categories?.find(cat =>
  cat.category.toLowerCase() === activityLower
);
```

Since the AI fallback sets `category: activity` (e.g. `"Cafes"`), `"cafes" === "cafes"` → match. No code change needed here. Just confirm by reading the file.

- [ ] **Step 3: Verify build passes**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npm run build 2>&1 | tail -4
```

Expected: `✓ built in ...ms`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/utils/foursquare.js
git commit -m "feat: map source, description, openingHours fields from venues API"
```

---

## Task 4: Frontend — AI badge on venue cards + disclaimer

**Files:**
- Modify: `frontend/src/components/plantrip/subcomponents/VenuesList.jsx`

- [ ] **Step 1: Add AI badge to venue card header**

In `VenuesList.jsx`, find the venue card header where rating is shown:

```jsx
              <div className="item-card__actions">
                  {assignedDay && <span className="item-day-badge">{assignedDay}</span>}
                  {rating && <span className="item-rating">⭐{rating}</span>}
                  <button
```

Add an AI tag before the rating:

```jsx
              <div className="item-card__actions">
                  {assignedDay && <span className="item-day-badge">{assignedDay}</span>}
                  {venue.source === 'ai' && <span className="item-ai-tag">AI</span>}
                  {rating && <span className="item-rating">⭐{rating}</span>}
                  <button
```

- [ ] **Step 2: Show description and openingHours inside expanded AI venue card**

In the detail body (the section that shows the DayList), before the `day-list-section__label`, add venue details for AI venues:

Find:
```jsx
                  {!isAdded || changingDay.has(venue.fsq_id) ? (
                    <div>
                      <div className="day-list-section__label">Which day will you visit?</div>
```

Replace with:

```jsx
                  {!isAdded || changingDay.has(venue.fsq_id) ? (
                    <div>
                      {venue.description && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 8 }}>
                          {venue.description}
                        </div>
                      )}
                      {venue.openingHours && (
                        <div style={{ display: 'flex', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
                          <span style={{ color: '#00d4aa' }}>🕐</span>
                          <span>{venue.openingHours}</span>
                        </div>
                      )}
                      <div className="day-list-section__label">Which day will you visit?</div>
```

- [ ] **Step 3: Add AI disclaimer below the venue grid when any AI venues present**

Find the `return (` in `VenuesList` that wraps the outer `<div>`. After the closing `</div>` of the `venue-grid`, add a conditional disclaimer:

```jsx
        </div>

        {venues.some(v => v.source === 'ai') && (
          <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontStyle: 'italic' }}>
            ✦ AI suggested · verify hours and availability before visiting
          </div>
        )}
      </div>
```

- [ ] **Step 4: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npm run build 2>&1 | tail -4
```

Expected: `✓ built in ...ms`

- [ ] **Step 5: Commit and push**

```bash
git add frontend/src/components/plantrip/subcomponents/VenuesList.jsx
git commit -m "feat: AI badge and description on AI-generated venue cards"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- Foursquare-zero → Claude fallback: Task 2 ✓
- Same API contract (`categories[]` shape): Task 2 `generateAIVenues` returns same fields ✓
- `source: 'ai'` on each venue: Task 2 ✓
- AI badge in frontend: Task 4 ✓
- Disclaimer line: Task 4 ✓
- `CLAUDE_API_KEY` in Lambda env: Task 1 ✓
- `@anthropic-ai/sdk` dependency: Task 2 ✓
- Graceful degradation (Claude fails → empty): Task 2 catch block returns `[]` ✓
- `description` + `openingHours` mapped on frontend: Task 3 ✓

**Placeholder scan:** None found.

**Type consistency:** `venue.source`, `venue.description`, `venue.openingHours` defined in Task 2 and consumed in Tasks 3 and 4. `fsq_id` format `ai-${activity}-${i}` is a string, consistent with Foursquare's string IDs.
