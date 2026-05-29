# AI Venue Fallback — Design Spec

**Date:** 2026-05-29  
**Status:** Approved

---

## Problem

Foursquare has sparse coverage in smaller cities (Shimla, Bir, hill stations). When a user selects an activity category (e.g. Cafes, Hiking) the venues Lambda returns 0 results, leaving the right panel empty with "No venues found."

---

## Solution

Add a Claude Haiku fallback inside `handleVenues`. If Foursquare returns 0 categories, Claude generates 5 plausible local venues for the requested `activity` + `destination`. Results are returned in the same `{ category, venues[] }` structure as Foursquare, with `source: 'ai'` on each venue so the frontend can badge them.

---

## Architecture

### Backend — `recommendations/index.js`

In `handleVenues`, after the Foursquare loop:

```
if (categories.length === 0 && CLAUDE_API_KEY) {
  const aiVenues = await generateAIVenues(destination, activity, lat, lng);
  if (aiVenues.length > 0) {
    categories.push({ category: activity, venues: aiVenues, source: 'ai' });
  }
}
```

`generateAIVenues(destination, activity, lat, lng)`:
- Calls Claude Haiku (`claude-haiku-4-5-20251001`)
- Prompt asks for 5 real local venues for `activity` in `destination`
- Returns array of venue objects shaped identically to Foursquare output
- Each venue gets `source: 'ai'`, `score: 0` (no rating/review data)
- If Claude call fails → returns `[]` (no crash, graceful degradation)

**Claude prompt structure:**
```
You are a local travel expert. List 5 real, specific places for "{activity}" in {destination}, {country}.

Return JSON array only:
[{
  "name": "Exact place name",
  "address": "Street address or area name",
  "description": "One sentence why a slow traveller would love this",
  "openingHours": "e.g. Daily 8am–9pm",
  "category": "{activity}"
}]

Use real places. Be specific. No generic names.
```

**Response shape** (each venue):
```js
{
  fsq_id: `ai-${index}`,
  name, category, rating: null, reviewCount: 0,
  address, description, openingHours,
  lat: null, lng: null,
  source: 'ai',
  score: 0,
  photoUrl: null, photos: [],
  hours: { open_now: null, display: openingHours },
  website: null, tel: null, instagramUrl: null,
}
```

**Dependencies:**
- Add `@anthropic-ai/sdk` to `backend/functions/recommendations/package.json`
- `CLAUDE_API_KEY` already in Lambda env (SAM template parameter)

---

### Frontend — `foursquare.js`

`fetchVenuesForActivity` maps the returned venue objects. Add `source` to the mapped fields:

```js
source: venue.source || 'foursquare',
description: venue.description || null,
openingHours: venue.openingHours || venue.hours?.display || null,
```

The category matching logic runs the same way — the AI fallback uses the same `category` field so no extra matching needed.

---

### Frontend — `VenuesList.jsx`

When rendering venue cards:
- If `venue.source === 'ai'`: show a small **"AI"** tag (same style as `item-ai-tag` CSS already in place)
- Below the venue grid, if any AI venues exist: show one line — *"✦ AI suggested · verify hours and availability before visiting"*

No new CSS needed — `item-ai-tag` already defined in `venueselection-redesign.css`.

---

## Data Flow

```
User selects "Cafes" in Shimla
  → fetchVenuesForActivity("Cafes", { name: "Shimla", lat, lng })
  → GET /recommendations/venues?activity=Cafes&lat=31.77&lng=77.10
  → handleVenues: Foursquare loop → 0 categories
  → generateAIVenues("Shimla", "Cafes", 31.77, 77.10)
  → Claude Haiku returns 5 cafés
  → { categories: [{ category: "Cafes", venues: [...], source: 'ai' }] }
  → Frontend renders venues with AI badge
  → User sees 5 AI-suggested cafés with disclaimer
```

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Foursquare returns results | AI not called; Foursquare results used normally |
| Claude call fails / times out | Returns empty array; "No venues found" shown |
| `CLAUDE_API_KEY` missing | Skips AI fallback; shows "No venues found" |
| AI returns malformed JSON | Catch block returns `[]`; graceful degradation |
| City not recognised by Claude | Claude still returns plausible data (it knows most cities) |

---

## Files Changed

| File | Change |
|---|---|
| `backend/functions/recommendations/package.json` | Add `@anthropic-ai/sdk` |
| `backend/functions/recommendations/index.js` | Add `generateAIVenues`, call after empty Foursquare loop |
| `frontend/src/utils/foursquare.js` | Map `source`, `description`, `openingHours` fields |
| `frontend/src/components/plantrip/subcomponents/VenuesList.jsx` | AI badge + disclaimer line |

---

## Out of Scope

- Caching AI venue responses (can add later)
- Rating/review data for AI venues (not available; show nothing instead of 0)
- YouTube fallback (separate concern)
