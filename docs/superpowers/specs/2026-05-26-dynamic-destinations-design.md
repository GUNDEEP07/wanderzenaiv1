# Dynamic Destinations + Venue Selection Design

**Date:** 2026-05-26  
**Author:** Claude (brainstorming with Gundeep)  
**Status:** Approved for implementation

---

## Overview

Replace hardcoded 24-destination list with **dynamic destination search** + **user-controlled venue selection**. Users can search any destination via Foursquare autocomplete, select specific venues they want to visit (up to 5 per category), and Claude generates itineraries incorporating those venues.

**Key Changes:**
- Destination input: free text search (autocomplete) instead of dropdown
- New venue selection step: user picks restaurants, parks, temples, etc.
- Itinerary generation: Claude weaves selected venues into the daily plan
- Cost: ~$150/month Foursquare API (predictable)

---

## User Journey

### Current Flow (22-step form):
1. Destination selected from dropdown (24 hardcoded)
2. Form fields → submit → itinerary generated

### New Flow (destination search + venue selection):
1. **Search destination**: User types "Bir Billing" → Foursquare autocomplete suggests cities
2. **Select destination**: User picks "Bir Billing, Himachal Pradesh"
3. **Browse venues**: System fetches top 10 Foursquare categories (restaurants, parks, temples, adventure, etc.)
4. **Select venues**: User checks up to 5 venues per category (optional)
5. **Fill form**: Days, budget, traveler type, travel style, interests (existing form)
6. **Review**: Preview itinerary with selected venues
7. **Submit**: Triggers itinerary generation with selected venues

---

## Database Changes

**Minimal schema change** — only update `submissions` table:

```sql
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS (
  selected_venues JSONB DEFAULT '{}'
);
```

**Example value:**
```json
{
  "Restaurants": ["fsq_id_123", "fsq_id_456"],
  "Parks": ["fsq_id_789"],
  "Temples": ["fsq_id_321", "fsq_id_654"],
  "Adventure": ["fsq_id_555"]
}
```

**Why no new tables?**
- Foursquare venue data is fetched on-demand, not cached
- Only user's selected venues are stored (small JSON blob)
- No need for long-term venue caching

---

## API Endpoints

### 1. GET `/autocomplete` (NEW)

**Purpose:** Destination search with autocomplete

**Request:**
```
GET /autocomplete?query=bir+billing
```

**Response:**
```json
{
  "suggestions": [
    {
      "fsq_id": "4a1234567890123",
      "name": "Bir Billing",
      "country": "India",
      "lat": 32.2031,
      "lng": 76.7120
    },
    {
      "fsq_id": "4b9876543210987",
      "name": "Billing Point, Himachal Pradesh",
      "country": "India",
      "lat": 32.2050,
      "lng": 76.7100
    }
  ]
}
```

**Notes:**
- Powered by Foursquare Places Autocomplete API
- Limit to 5 suggestions
- Return empty array if query < 2 characters or API fails

---

### 2. GET `/venues` (NEW)

**Purpose:** Fetch top 10 venue categories for a destination

**Request:**
```
GET /venues?destination=Bir+Billing&lat=32.2031&lng=76.7120
```

**Response:**
```json
{
  "destination": "Bir Billing",
  "categories": [
    {
      "category": "Restaurants",
      "venues": [
        {
          "fsq_id": "4a1111111111111",
          "name": "Local Cafe",
          "category": "Cafe",
          "rating": 4.5,
          "address": "Main Bazaar, Bir"
        },
        {
          "fsq_id": "4a2222222222222",
          "name": "Mountain View Restaurant",
          "category": "Restaurant",
          "rating": 4.3,
          "address": "Billing Road"
        },
        // ... up to 5 per category
      ]
    },
    { "category": "Parks", "venues": [...] },
    { "category": "Temples", "venues": [...] },
    { "category": "Hiking Trails", "venues": [...] },
    // ... up to 10 categories total
  ]
}
```

**Featured Categories** (in order):
1. Restaurants
2. Cafes
3. Parks
4. Temples / Religious Sites
5. Museums
6. Hiking Trails
7. Viewpoints
8. Markets
9. Bars / Nightlife
10. Accommodations

**Notes:**
- Powered by Foursquare Places Search API
- Sort by rating (highest first)
- Return all available categories, cap at 10
- If < 5 venues in a category, return what's available
- If API fails, return empty categories array

---

### 3. POST `/submit` (MODIFIED)

**Existing endpoint, now includes `selected_venues`:**

```json
{
  "destination": "Bir Billing",
  "days": 3,
  "budget": 500,
  "currency": "USD",
  "travelerType": "solo",
  "travelStyle": ["adventure", "nature"],
  "travelPace": "balanced",
  "interests": "paragliding, hiking, local food",
  "travelDate": "2026-06-15",
  "selected_venues": {
    "Restaurants": ["fsq_id_123", "fsq_id_456"],
    "Parks": ["fsq_id_789"],
    "Adventure": ["fsq_id_321"]
  }
}
```

**Changes:**
- Accept `selected_venues` as optional JSONB
- Store in `submissions.selected_venues`
- Pass to itinerary-gen Lambda

---

## Lambda Functions

### 1. New `recommendations` Lambda

**Triggers:** API Gateway (`/autocomplete`, `/venues`)

**Implements:**
- GET `/autocomplete` — Foursquare Places Autocomplete API
- GET `/venues` — Foursquare Places Search API (10 categories)

**Key Logic:**
```javascript
// Autocomplete: simple passthrough to Foursquare
// Venue Search: loop through featured categories, fetch top 5 per category

async function handleAutocomplete(query) {
  const res = await axios.get('https://api.foursquare.com/v3/places/autocomplete', {
    params: { query, limit: 5 },
    headers: { Authorization: `Bearer ${FOURSQUARE_API_KEY}` },
  });
  return res.data.results.map(p => ({
    fsq_id: p.fsq_id,
    name: p.name,
    country: p.location.country,
    lat: p.location.latitude,
    lng: p.location.longitude,
  }));
}

async function handleVenues(lat, lng) {
  const categories = [];
  for (const category of FEATURED_CATEGORIES) {
    const res = await axios.get('https://api.foursquare.com/v3/places/search', {
      params: {
        ll: `${lat},${lng}`,
        query: category,
        limit: 5,
        sort: 'rating',
      },
    });
    categories.push({
      category: formatCategory(category),
      venues: res.data.results.map(v => ({...})),
    });
  }
  return categories.slice(0, 10);
}
```

**Environment Variables:**
- `FOURSQUARE_API_KEY` — Foursquare API bearer token
- `FRONTEND_URL` — for CORS headers

**Error Handling:**
- Autocomplete fails → return empty suggestions array
- Venues fetch fails → return empty categories, user can skip venue selection
- Network timeout → 5s timeout, fail gracefully

---

### 2. Modified `itinerary-gen` Lambda

**Existing logic, enhanced:**

**Changes:**
```javascript
// Get selected venues from submission
const selectedVenues = submission.selected_venues || {};

// Format for Claude prompt
const venuesList = Object.entries(selectedVenues)
  .flatMap(([category, fsqIds]) =>
    fsqIds.map(id => `- ${id} (${category})`)
  )
  .join('\n');

// Include in Claude prompt
const claudePrompt = `
Generate a ${submission.days}-day itinerary for ${submission.destination}.

Travel Style: ${submission.travelStyle.join(', ')}
Pace: ${submission.travelPace}

User has selected these specific venues to include in the itinerary:
${venuesList}

Weave these venues naturally into the itinerary at appropriate times and days.
...
`;
```

**Error Handling:**
- If selected_venues is missing → proceed without (fallback)
- If a venue ID is invalid → log warning, skip that venue
- Generate itinerary regardless (user still gets output)

---

## Frontend Components

### 1. New `DestinationSearch.jsx`

**Location:** `src/components/plantrip/DestinationSearch.jsx`

**Props:**
- `onSelect(destination)` — callback when user picks a destination

**Features:**
- Text input with debounced search (300ms)
- Autocomplete dropdown showing suggestions
- Display destination name + country
- Show loading spinner during API call
- Fallback: show hardcoded 24 destinations if Foursquare fails

---

### 2. New `VenueSelection.jsx`

**Location:** `src/components/plantrip/VenueSelection.jsx`

**Props:**
- `destination` — selected destination name
- `lat`, `lng` — coordinates for Foursquare API
- `onSubmit(selectedVenues)` — callback with { category: [fsq_ids] }

**Features:**
- Displays top 10 categories in expandable sections
- Up to 5 venues per category, sortable by rating
- Checkboxes to select venues
- Max 5 per category enforced (checkbox disabled after 5)
- Optional step — user can skip by clicking "Continue without selecting"
- Loading spinner while fetching venues from API
- Error state: show message, allow proceeding without venues

---

### 3. Modified `PlanTrip.jsx`

**Changes to multi-step form:**

```javascript
// New step ordering:
const STEPS = [
  { number: 0, name: 'Destination', component: DestinationSearch },
  { number: 1, name: 'Venues', component: VenueSelection }, // NEW
  { number: 2, name: 'Trip Details', component: StepTripDetails },
  { number: 3, name: 'Interests', component: StepInterests },
  { number: 4, name: 'Review', component: StepReview },
];

// State management
const [formData, setFormData] = useState({
  destination: '',
  destinationLat: null,
  destinationLng: null,
  selected_venues: {}, // NEW
  days: 3,
  budget: 500,
  // ... existing fields
});

// Handle destination selection
const handleDestinationSelect = (destination) => {
  setFormData({
    ...formData,
    destination: destination.name,
    destinationLat: destination.lat,
    destinationLng: destination.lng,
  });
  goToStep(1); // advance to venue selection
};

// Handle venue selection
const handleVenueSelect = (selectedVenues) => {
  setFormData({
    ...formData,
    selected_venues: selectedVenues,
  });
  goToStep(2); // advance to trip details
};
```

---

## Cost Analysis

### Foursquare API Pricing

| Operation | Cost | Frequency | Monthly Cost |
|-----------|------|-----------|--------------|
| Places Autocomplete | $0.01/req | ~5 per user search | $0.05/user |
| Places Search | $0.01/req | ~10 categories × ~1000 users | $0.10/user |
| **Per user** | — | — | **$0.15** |
| **At 1,000 users/month** | — | — | **$150** |

### Claude API (incremental)

- Selected venues add ~50-100 tokens to itinerary prompt
- Cost: ~$0.002 extra per itinerary
- Negligible vs. current Haiku cost (~$0.06/itinerary)

### Total New Cost
- **~$150/month Foursquare + minimal Claude increase**
- Predictable, scales linearly with user count

---

## Error Handling Strategy

### Graceful Degradation

| Failure | Behavior |
|---------|----------|
| Autocomplete API down | Show error; fallback to 24 hardcoded destinations |
| Venues API down | Show error; user can skip venue selection |
| Invalid selected venue ID | Log warning; generate itinerary without it |
| Network timeout | Show error; allow retry or continue |

### Fallback Destinations

If Foursquare Autocomplete fails, display:
```javascript
const FALLBACK_DESTINATIONS = [
  { name: 'Kyoto, Japan', ... },
  { name: 'Oaxaca, Mexico', ... },
  // ... existing 24 destinations
];
```

---

## Data Flow Diagram

```
User Input (Browser)
    ↓
[DestinationSearch Component]
    ↓ (debounced input)
GET /autocomplete?query=...
    ↓
[recommendations Lambda]
    ↓
Foursquare Places Autocomplete API
    ↓
Return suggestions → Display dropdown
    ↓
User selects destination
    ↓
[VenueSelection Component]
    ↓
GET /venues?destination=...&lat=...&lng=...
    ↓
[recommendations Lambda]
    ↓
Foursquare Places Search (10 categories)
    ↓
Return { category: [venues] } → Display checkboxes
    ↓
User selects venues (up to 5 per category)
    ↓
[PlanTrip Form]
    ↓
User fills days, budget, interests (existing form)
    ↓
POST /submit { destination, selected_venues, ... }
    ↓
[form-handler Lambda]
    ↓ Async invoke
[itinerary-gen Lambda]
    ↓ (uses selected_venues in Claude prompt)
Claude generates itinerary with selected venues
    ↓
Store in RDS, async invoke PDF builder
    ↓
User gets PDF + email
```

---

## Implementation Sequence

### Phase 1: API & Backend (Week 1)
1. Create `recommendations` Lambda (autocomplete + venues)
2. Update `itinerary-gen` to handle selected_venues
3. Update `form-handler` to accept selected_venues
4. Update `submissions` table schema
5. Deploy + test

### Phase 2: Frontend (Week 1-2)
1. Create `DestinationSearch.jsx` component
2. Create `VenueSelection.jsx` component
3. Update `PlanTrip.jsx` step ordering
4. Test autocomplete → venue selection flow
5. Deploy frontend

### Phase 3: QA & Optimization (Week 2)
1. E2E testing (search → select venues → generate itinerary)
2. Monitor Foursquare API costs
3. Fallback testing (simulate API failures)
4. Performance optimization if needed

---

## Testing Strategy

### Autocomplete Tests
- Search valid destinations (Bangkok, Bir Billing, Kyoto)
- Search invalid/typos (Bangkkok → should suggest)
- Search 1-char, empty string → no results
- API failure → fallback to hardcoded list

### Venue Selection Tests
- Fetch venues for various destinations
- Select up to 5 per category
- Skip venue selection → proceed to form
- API failure → show error, allow skip

### Itinerary Generation Tests
- Generate itinerary WITH selected venues → verify venues appear
- Generate WITHOUT selected venues → should work normally
- Invalid venue IDs → should skip without crashing

### Cost Monitoring
- Log API call counts daily
- Alert if Foursquare spend exceeds $200/month

---

## Security & Rate Limiting

**Foursquare API Key:**
- Store in AWS Secrets Manager
- Reference in Lambda environment variables
- Rotate quarterly

**Rate Limiting:**
- Frontend: debounce autocomplete (300ms)
- API: implement rate limiting per IP (100 req/min)
- Monitor for abuse patterns

---

## Future Enhancements

- Cache venue lists for popular destinations (24h TTL)
- Add "trending venues" (powered by Foursquare tips)
- Let user add custom venues (not in Foursquare)
- Show venue reviews / photos in selection UI
- Save favorite destinations for returning users

---

## Rollback Plan

If Foursquare integration causes issues:
1. Disable `/autocomplete` + `/venues` endpoints
2. Revert frontend to dropdown (24 hardcoded destinations)
3. Make `selected_venues` optional in submission (default {})
4. Itinerary-gen works with or without selected venues

**Rollback time: ~30 minutes**

---

## Questions & Decisions

**Resolved:**
- ✓ Use Foursquare (not Google Maps) — already integrated, Foursquare access confirmed
- ✓ Fetch on-demand (not batch) — cheaper, faster, dynamic
- ✓ Minimal DB changes — JSONB column only, no new tables
- ✓ Optional venue selection — graceful degradation if API fails

**Open (for implementation phase):**
- Caching strategy for popular venues (if needed based on usage)
- Rate limiting thresholds per IP
- Exact wording/UX for "skip venue selection" flow
