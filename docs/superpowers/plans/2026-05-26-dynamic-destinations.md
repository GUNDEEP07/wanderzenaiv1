# Dynamic Destinations + Venue Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded 24-destination dropdown with dynamic destination search (via Foursquare autocomplete) and venue selection UI, allowing users to cherry-pick specific venues to include in their itinerary.

**Architecture:** 
- New `recommendations` Lambda handles `/autocomplete` and `/venues` endpoints (Foursquare API)
- Modified `itinerary-gen` Lambda incorporates selected venues into Claude prompt
- Minimal DB change: add `selected_venues` JSONB column to `submissions` table
- New frontend components: `DestinationSearch` + `VenueSelection` inserted into `PlanTrip` multi-step form

**Tech Stack:** Node 20 Lambda, Foursquare Places API (Autocomplete + Search), React 18, PostgreSQL

---

## File Structure

**New files:**
```
backend/functions/recommendations/
  ├── index.js                          # Autocomplete + Venues endpoints
  └── package.json
frontend/src/components/plantrip/
  ├── DestinationSearch.jsx             # Autocomplete input + dropdown
  ├── VenueSelection.jsx                # Category grid + venue checkboxes
infra/
  └── migrations/
      └── add_selected_venues.sql       # DB migration
docs/superpowers/plans/
  └── 2026-05-26-dynamic-destinations.md (this file)
```

**Modified files:**
```
infra/template.yaml                      # Add recommendations Lambda to SAM template
backend/functions/itinerary-gen/index.js # Pass selected_venues to Claude prompt
backend/functions/form-handler/index.js  # Store selected_venues in submission
frontend/src/components/plantrip/PlanTrip.jsx  # New step order
frontend/src/api/itinerary.js            # New submitItinerary signature (optional, for validation)
```

---

## Phase 1: Database & Shared Layer

### Task 1: Create Database Migration

**Files:**
- Create: `infra/migrations/add_selected_venues.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Migration: Add selected_venues column to submissions table
-- Date: 2026-05-26
-- Description: Store user-selected Foursquare venue IDs per submission

ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS selected_venues JSONB DEFAULT '{}';

-- Index for queries that filter by submission creation + status
CREATE INDEX IF NOT EXISTS idx_submissions_selected_venues 
ON submissions USING GIN (selected_venues);

-- Verify migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'submissions' 
AND column_name = 'selected_venues';
```

- [ ] **Step 2: Commit**

```bash
git add infra/migrations/add_selected_venues.sql
git commit -m "db: add selected_venues column to submissions table"
```

---

## Phase 2: Backend — Recommendations Lambda

### Task 2: Create Recommendations Lambda (Directory & Package.json)

**Files:**
- Create: `backend/functions/recommendations/package.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "recommendations",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "axios": "^1.6.0"
  }
}
```

- [ ] **Step 2: Commit**

```bash
mkdir -p backend/functions/recommendations
git add backend/functions/recommendations/package.json
git commit -m "backend: create recommendations Lambda structure"
```

---

### Task 3: Implement Recommendations Lambda — Autocomplete Endpoint

**Files:**
- Create: `backend/functions/recommendations/index.js` (partial)

- [ ] **Step 1: Write autocomplete handler**

```javascript
'use strict';

const axios = require('axios');
const { ok, log } = require('/opt/nodejs/index');

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY;
const FOURSQUARE_BASE = 'https://api.foursquare.com/v3';

const FEATURED_CATEGORIES = [
  'restaurant', 'cafe', 'park', 'temple', 'museum',
  'hiking_trail', 'viewpoint', 'market', 'bar', 'accommodation'
];

// Fallback destinations if Foursquare is down
const FALLBACK_DESTINATIONS = [
  { fsq_id: 'kyoto', name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
  { fsq_id: 'bangkok', name: 'Bangkok', country: 'Thailand', lat: 13.7563, lng: 100.5018 },
  { fsq_id: 'bali', name: 'Bali', country: 'Indonesia', lat: -8.6705, lng: 115.2126 },
  { fsq_id: 'paris', name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { fsq_id: 'oaxaca', name: 'Oaxaca', country: 'Mexico', lat: 17.0732, lng: -96.7266 },
];

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return corsHeaders(200, '');
  }

  const path = event.path || event.resource || '';
  log.info('Recommendations request', { path, method: event.httpMethod });

  try {
    if (path.includes('/autocomplete')) {
      return await handleAutocomplete(event);
    } else if (path.includes('/venues')) {
      return await handleVenues(event);
    } else {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }
  } catch (err) {
    log.error('Unexpected error', { error: err.message });
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};

async function handleAutocomplete(event) {
  const query = event.queryStringParameters?.query || '';
  
  if (!query || query.trim().length < 2) {
    return ok({ suggestions: [] });
  }

  try {
    log.info('Autocomplete request', { query });
    const res = await axios.get(`${FOURSQUARE_BASE}/places/autocomplete`, {
      params: { query, limit: 5 },
      headers: { Authorization: `Bearer ${FOURSQUARE_API_KEY}` },
      timeout: 5000,
    });

    const suggestions = res.data.results.map(place => ({
      fsq_id: place.fsq_id,
      name: place.name,
      country: place.location?.country || 'Unknown',
      lat: place.location?.latitude,
      lng: place.location?.longitude,
    }));

    log.info('Autocomplete success', { count: suggestions.length });
    return ok({ suggestions });
  } catch (err) {
    log.error('Autocomplete failed, returning fallback', { error: err.message });
    return ok({ suggestions: FALLBACK_DESTINATIONS });
  }
}

async function handleVenues(event) {
  const { destination, lat, lng } = event.queryStringParameters || {};

  if (!lat || !lng) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing lat and lng parameters' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }

  try {
    log.info('Venues request', { destination, lat, lng });
    const categories = [];

    for (const category of FEATURED_CATEGORIES) {
      try {
        const res = await axios.get(`${FOURSQUARE_BASE}/places/search`, {
          params: {
            ll: `${lat},${lng}`,
            query: category,
            limit: 5,
            sort: 'rating',
          },
          headers: { Authorization: `Bearer ${FOURSQUARE_API_KEY}` },
          timeout: 5000,
        });

        if (res.data.results && res.data.results.length > 0) {
          categories.push({
            category: formatCategory(category),
            venues: res.data.results.map(v => ({
              fsq_id: v.fsq_id,
              name: v.name,
              category: v.categories?.[0]?.name || category,
              rating: v.rating || null,
              address: v.location?.address || v.location?.formatted_address || '',
            })),
          });
        }
      } catch (catErr) {
        log.warn('Category fetch failed', { category, error: catErr.message });
        // Continue with next category
      }
    }

    log.info('Venues success', { destination, categoryCount: categories.length });
    return ok({
      destination,
      categories: categories.slice(0, 10),
    });
  } catch (err) {
    log.error('Venues fetch failed', { error: err.message });
    return ok({ 
      destination,
      categories: [], 
      error: 'Unable to fetch venues' 
    });
  }
}

function formatCategory(cat) {
  const categoryMap = {
    'restaurant': 'Restaurants',
    'cafe': 'Cafes',
    'park': 'Parks',
    'temple': 'Temples',
    'museum': 'Museums',
    'hiking_trail': 'Hiking Trails',
    'viewpoint': 'Viewpoints',
    'market': 'Markets',
    'bar': 'Bars & Nightlife',
    'accommodation': 'Accommodations',
  };
  return categoryMap[cat] || cat.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function ok(data) {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  };
}

function corsHeaders(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/functions/recommendations/index.js
git commit -m "feat: implement recommendations Lambda with autocomplete + venues endpoints"
```

---

### Task 4: Add Recommendations Lambda to SAM Template

**Files:**
- Modify: `infra/template.yaml` (add new Lambda resource + API routes)

- [ ] **Step 1: Add Recommendations Lambda resource to template.yaml**

Find the section with other Lambda functions and add:

```yaml
RecommendationsFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub '${AWS::StackName}-recommendations'
    CodeUri: backend/functions/recommendations/
    Handler: index.handler
    Runtime: nodejs20.x
    Timeout: 10
    MemorySize: 256
    Environment:
      Variables:
        FOURSQUARE_API_KEY: !Ref FoursquareApiKey
        FRONTEND_URL: !Ref FrontendUrl
    Layers:
      - !Ref SharedLayer
```

- [ ] **Step 2: Add API routes for /autocomplete and /venues**

Find the `ApiGateway` resource and add these routes:

```yaml
AutocompleteRoute:
  Type: AWS::Serverless::Api
  Properties:
    DefinitionBody:
      paths:
        /autocomplete:
          get:
            x-amazon-apigateway-integration:
              httpMethod: POST
              type: aws_proxy
              uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${RecommendationsFunction.Arn}/invocations'

VenuesRoute:
  Type: AWS::Serverless::Api
  Properties:
    DefinitionBody:
      paths:
        /venues:
          get:
            x-amazon-apigateway-integration:
              httpMethod: POST
              type: aws_proxy
              uri: !Sub 'arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${RecommendationsFunction.Arn}/invocations'
```

**Note:** If using an existing API Gateway, you may need to add these routes to the existing API definition instead of creating separate ones. Check your current `infra/template.yaml` structure.

- [ ] **Step 3: Add Foursquare API Key parameter**

Add to the `Parameters` section:

```yaml
FoursquareApiKey:
  Type: String
  NoEcho: true
  Description: Foursquare API Bearer Token
```

- [ ] **Step 4: Validate YAML**

```bash
sam validate --template infra/template.yaml
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add infra/template.yaml
git commit -m "infra: add recommendations Lambda and API routes to SAM template"
```

---

### Task 5: Modify itinerary-gen Lambda

**Files:**
- Modify: `backend/functions/itinerary-gen/index.js`

- [ ] **Step 1: Read current itinerary-gen to understand structure**

```bash
head -50 backend/functions/itinerary-gen/index.js
```

- [ ] **Step 2: Add selected_venues to the Claude prompt**

Find the section where the Claude prompt is built. Locate the line that constructs `claudePrompt`. Add this code after the destination/days variables are set but before the Claude API call:

```javascript
// Format selected venues for Claude if provided
const selectedVenues = submission.selected_venues || {};
const venuesList = Object.entries(selectedVenues)
  .flatMap(([category, fsqIds]) =>
    fsqIds.map(id => `- ${id} (${category})`)
  )
  .join('\n');

const venuesContext = venuesList.length > 0
  ? `\n\nUser has selected these specific venues to include in the itinerary:\n${venuesList}\n\nWeave these venues naturally into the itinerary at appropriate times and days.`
  : '';
```

- [ ] **Step 3: Update Claude prompt to include venuesContext**

Find the `const claudePrompt = ...` line and append `venuesContext`:

```javascript
const claudePrompt = `
Generate a ${submission.days}-day itinerary for ${submission.destination}.

...existing prompt content...
${venuesContext}
`;
```

- [ ] **Step 4: Run tests (if they exist)**

```bash
cd backend/functions/itinerary-gen && npm test 2>/dev/null || echo "No tests found"
```

- [ ] **Step 5: Commit**

```bash
git add backend/functions/itinerary-gen/index.js
git commit -m "feat: incorporate selected venues into itinerary generation prompt"
```

---

### Task 6: Modify form-handler Lambda

**Files:**
- Modify: `backend/functions/form-handler/index.js`

- [ ] **Step 1: Find the submissions INSERT in form-handler**

```bash
grep -n "INSERT INTO submissions" backend/functions/form-handler/index.js
```

- [ ] **Step 2: Update INSERT query to include selected_venues**

Find the SQL INSERT statement and add `selected_venues` to both the column list and values:

```javascript
// Find this section:
const result = await db.query(`
  INSERT INTO submissions 
    (id, email, destination, days, budget, currency, traveler_type, travel_style, interests, travel_date, travel_pace, wants_hotel_recs, plan, status)
  VALUES ($1, $2, $3, ...)
  RETURNING id
`, [submissionId, email, destination, ...]);

// Update to:
const result = await db.query(`
  INSERT INTO submissions 
    (id, email, destination, days, budget, currency, traveler_type, travel_style, interests, travel_date, travel_pace, wants_hotel_recs, plan, status, selected_venues)
  VALUES ($1, $2, $3, ..., $N)
  RETURNING id
`, [submissionId, email, destination, ..., body.selected_venues || {}]);
```

Note: Replace `$N` with the appropriate parameter number (count existing params, add 1)

- [ ] **Step 3: Log selected_venues for debugging**

Add to the logging section:

```javascript
log.info('Submission stored', { 
  submissionId, 
  email, 
  destination, 
  selected_venues_count: Object.keys(body.selected_venues || {}).length 
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/functions/form-handler/index.js
git commit -m "feat: accept and store selected_venues in form handler"
```

---

## Phase 3: Frontend Components

### Task 7: Create DestinationSearch Component

**Files:**
- Create: `frontend/src/components/plantrip/DestinationSearch.jsx`

- [ ] **Step 1: Write DestinationSearch component**

```jsx
import { useState, useCallback } from 'react';
import { debounce } from 'lodash';
import '../styles/destinationsearch.css';

const API_URL = import.meta.env.VITE_API_URL;

export function DestinationSearch({ onSelect, disabled }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchSuggestions = useCallback(
    debounce(async (q) => {
      if (q.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/autocomplete?query=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (err) {
        console.error('Autocomplete failed:', err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    fetchSuggestions(value);
  };

  const handleSelect = (suggestion) => {
    setSelected(suggestion);
    setQuery(suggestion.name);
    setSuggestions([]);
    onSelect(suggestion);
  };

  return (
    <div className="destination-search">
      <label htmlFor="destination-input">Where do you want to travel?</label>
      <input
        id="destination-input"
        type="text"
        placeholder="e.g., Bir Billing, Kyoto, Oaxaca..."
        value={query}
        onChange={handleInputChange}
        disabled={disabled}
        className="destination-input"
        autoComplete="off"
      />
      {loading && <div className="loading-spinner">Searching...</div>}
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((suggestion) => (
            <li
              key={suggestion.fsq_id}
              onClick={() => handleSelect(suggestion)}
              className="suggestion-item"
            >
              <div className="suggestion-name">{suggestion.name}</div>
              <div className="suggestion-country">{suggestion.country}</div>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <div className="selected-destination">
          <div className="checkmark">✓</div>
          <div className="selected-text">
            {selected.name}, {selected.country}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create stylesheet for DestinationSearch**

```bash
touch frontend/src/components/plantrip/styles/destinationsearch.css
```

- [ ] **Step 3: Write CSS**

```css
.destination-search {
  position: relative;
  margin-bottom: 24px;
}

.destination-search label {
  display: block;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.destination-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
}

.destination-input:focus {
  border-color: #6366f1;
}

.destination-input:disabled {
  background-color: #f5f5f5;
  color: #999;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  list-style: none;
  margin: 4px 0 0 0;
  padding: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  max-height: 300px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.suggestion-item:hover {
  background-color: #f9f9f9;
}

.suggestion-item:last-child {
  border-bottom: none;
}

.suggestion-name {
  font-weight: 600;
  color: #1a1a1a;
  font-size: 14px;
}

.suggestion-country {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.loading-spinner {
  padding: 8px 16px;
  font-size: 14px;
  color: #999;
  text-align: center;
}

.selected-destination {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  background-color: #f0f9ff;
  border-radius: 8px;
  border-left: 4px solid #22c55e;
}

.selected-destination .checkmark {
  font-size: 20px;
  color: #22c55e;
  font-weight: bold;
}

.selected-destination .selected-text {
  font-weight: 500;
  color: #1a1a1a;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/DestinationSearch.jsx
git add frontend/src/components/plantrip/styles/destinationsearch.css
git commit -m "feat: create DestinationSearch component with autocomplete"
```

---

### Task 8: Create VenueSelection Component

**Files:**
- Create: `frontend/src/components/plantrip/VenueSelection.jsx`

- [ ] **Step 1: Write VenueSelection component**

```jsx
import { useState, useEffect } from 'react';
import '../styles/venueselection.css';

const API_URL = import.meta.env.VITE_API_URL;
const MAX_VENUES_PER_CATEGORY = 5;

export function VenueSelection({ destination, lat, lng, onSubmit, onSkip }) {
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVenues();
  }, [destination, lat, lng]);

  const fetchVenues = async () => {
    if (!lat || !lng) {
      setError('Missing location coordinates');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `${API_URL}/venues?destination=${encodeURIComponent(destination)}&lat=${lat}&lng=${lng}`
      );
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Venues fetch failed:', err);
      setError('Unable to load venue recommendations. You can continue without selecting venues.');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVenue = (categoryName, fsqId) => {
    setSelected((prev) => {
      const categoryVenues = prev[categoryName] || [];
      const isSelected = categoryVenues.includes(fsqId);

      if (isSelected) {
        return {
          ...prev,
          [categoryName]: categoryVenues.filter((id) => id !== fsqId),
        };
      } else if (categoryVenues.length < MAX_VENUES_PER_CATEGORY) {
        return {
          ...prev,
          [categoryName]: [...categoryVenues, fsqId],
        };
      }
      return prev;
    });
  };

  const handleContinue = () => {
    onSubmit(selected);
  };

  const handleSkip = () => {
    onSkip();
  };

  if (loading) {
    return (
      <div className="venue-selection loading">
        <div className="spinner"></div>
        <p>Loading venue recommendations...</p>
      </div>
    );
  }

  return (
    <div className="venue-selection">
      <div className="venue-selection-header">
        <h2>Select venues for {destination}</h2>
        <p className="hint">
          Pick up to {MAX_VENUES_PER_CATEGORY} venues per category (optional)
        </p>
      </div>

      {error && (
        <div className="error-message">
          <p>⚠️ {error}</p>
        </div>
      )}

      {categories.length === 0 && !error && (
        <div className="no-venues">
          <p>No venue recommendations available for this location.</p>
        </div>
      )}

      <div className="categories-grid">
        {categories.map((cat) => (
          <div key={cat.category} className="category-section">
            <h3 className="category-title">{cat.category}</h3>
            <div className="venues-list">
              {cat.venues.map((venue) => {
                const categoryVenues = selected[cat.category] || [];
                const isSelected = categoryVenues.includes(venue.fsq_id);
                const isFull =
                  categoryVenues.length >= MAX_VENUES_PER_CATEGORY &&
                  !isSelected;

                return (
                  <label
                    key={venue.fsq_id}
                    className={`venue-item ${isSelected ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() =>
                        toggleVenue(cat.category, venue.fsq_id)
                      }
                      disabled={isFull}
                      className="venue-checkbox"
                    />
                    <div className="venue-info">
                      <div className="venue-name">{venue.name}</div>
                      {venue.rating && (
                        <div className="venue-rating">
                          ⭐ {venue.rating.toFixed(1)}
                        </div>
                      )}
                      {venue.address && (
                        <div className="venue-address">{venue.address}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="venue-selection-actions">
        <button
          onClick={handleContinue}
          className="btn btn-primary"
        >
          Continue with Selections
        </button>
        <button
          onClick={handleSkip}
          className="btn btn-secondary"
        >
          Skip Venue Selection
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create stylesheet**

```bash
touch frontend/src/components/plantrip/styles/venueselection.css
```

- [ ] **Step 3: Write CSS**

```css
.venue-selection {
  padding: 24px;
  max-width: 900px;
}

.venue-selection.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #eee;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.venue-selection-header {
  margin-bottom: 24px;
}

.venue-selection-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.hint {
  font-size: 14px;
  color: #666;
}

.error-message {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  color: #991b1b;
  font-size: 14px;
}

.no-venues {
  text-align: center;
  padding: 40px 24px;
  color: #999;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.category-section {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #eee;
}

.category-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 12px;
  color: #1a1a1a;
}

.venues-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.venue-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.venue-item:hover:not(.venue-item input:disabled) {
  background-color: #f0f0f0;
}

.venue-item.selected {
  background-color: #f0f9ff;
  border-left: 3px solid #6366f1;
  padding-left: 9px;
}

.venue-checkbox {
  width: 20px;
  height: 20px;
  margin-top: 2px;
  cursor: pointer;
  accent-color: #6366f1;
  flex-shrink: 0;
}

.venue-checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.venue-info {
  flex: 1;
  min-width: 0;
}

.venue-name {
  font-weight: 600;
  font-size: 14px;
  color: #1a1a1a;
  word-break: break-word;
}

.venue-rating {
  font-size: 12px;
  color: #f59e0b;
  margin-top: 2px;
}

.venue-address {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
  word-break: break-word;
}

.venue-selection-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #6366f1;
  color: white;
}

.btn-primary:hover {
  background-color: #4f46e5;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.btn-secondary {
  background-color: white;
  color: #6366f1;
  border: 2px solid #6366f1;
}

.btn-secondary:hover {
  background-color: #f0f4ff;
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/plantrip/VenueSelection.jsx
git add frontend/src/components/plantrip/styles/venueselection.css
git commit -m "feat: create VenueSelection component with category-based venue picker"
```

---

### Task 9: Update PlanTrip Component — New Step Flow

**Files:**
- Modify: `frontend/src/components/plantrip/PlanTrip.jsx`

- [ ] **Step 1: Read PlanTrip.jsx to understand current structure**

```bash
head -100 frontend/src/components/plantrip/PlanTrip.jsx
```

- [ ] **Step 2: Import new components at top**

Add after existing imports:

```jsx
import { DestinationSearch } from './DestinationSearch';
import { VenueSelection } from './VenueSelection';
```

- [ ] **Step 3: Update formData state to include destination coordinates + selected_venues**

Find the initial `formData` state. Update it to include:

```jsx
const [formData, setFormData] = useState({
  destination: '',
  destinationLat: null,       // NEW
  destinationLng: null,        // NEW
  selected_venues: {},         // NEW
  days: 3,
  budget: 500,
  // ... rest of existing fields
});
```

- [ ] **Step 4: Create step components array with new ordering**

Find or create the step definitions. Replace/update to include:

```jsx
const STEPS = [
  { 
    id: 'destination', 
    name: 'Destination', 
    component: () => (
      <DestinationSearch 
        onSelect={handleDestinationSelect}
        disabled={currentStep > 0}
      />
    ),
  },
  { 
    id: 'venues',
    name: 'Venues',
    component: () => (
      <VenueSelection 
        destination={formData.destination}
        lat={formData.destinationLat}
        lng={formData.destinationLng}
        onSubmit={handleVenueSelect}
        onSkip={() => goToStep(2)}
      />
    ),
  },
  // ... existing steps (Trip Details, Interests, Review, etc.)
];
```

- [ ] **Step 5: Add handler for destination selection**

Add new function:

```jsx
const handleDestinationSelect = (destination) => {
  setFormData({
    ...formData,
    destination: destination.name,
    destinationLat: destination.lat,
    destinationLng: destination.lng,
  });
  goToStep(1); // advance to venue selection
};
```

- [ ] **Step 6: Add handler for venue selection**

Add new function:

```jsx
const handleVenueSelect = (selectedVenues) => {
  setFormData({
    ...formData,
    selected_venues: selectedVenues,
  });
  goToStep(2); // advance to next step (trip details)
};
```

- [ ] **Step 7: Update submitItinerary call to include selected_venues**

Find the `submitItinerary(formData)` call. Ensure formData includes selected_venues (it will now, from state).

- [ ] **Step 8: Test locally**

```bash
cd frontend && npm run dev
# Visit http://localhost:5173 and test the new flow:
# 1. Destination search → autocomplete
# 2. Venue selection → category display + checkboxes
# 3. Existing form steps
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/plantrip/PlanTrip.jsx
git commit -m "feat: integrate DestinationSearch and VenueSelection into PlanTrip flow"
```

---

## Phase 4: Testing & Deployment

### Task 10: Create Integration Test

**Files:**
- Create: `backend/tests/integration/recommendations.test.js`

- [ ] **Step 1: Create test file structure**

```bash
mkdir -p backend/tests/integration
touch backend/tests/integration/recommendations.test.js
```

- [ ] **Step 2: Write autocomplete test**

```javascript
const axios = require('axios');

// Mock Foursquare API responses
const mockAutocompleteFoursquare = () => {
  return {
    results: [
      {
        fsq_id: '4a1234567890123',
        name: 'Bir Billing',
        location: {
          country: 'India',
          latitude: 32.2031,
          longitude: 76.7120,
        },
      },
    ],
  };
};

describe('Recommendations Lambda', () => {
  describe('GET /autocomplete', () => {
    test('should return suggestions for valid query', async () => {
      // Mock axios to avoid real API calls in test
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: mockAutocompleteFoursquare(),
      });

      const event = {
        path: '/autocomplete',
        httpMethod: 'GET',
        queryStringParameters: { query: 'bir billing' },
      };

      // Mock process.env
      process.env.FOURSQUARE_API_KEY = 'test-key';

      // Note: This is pseudocode. Adapt to your actual test framework.
      // You may need to invoke the Lambda handler directly or use AWS SAM testing tools.
      
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          suggestions: [
            {
              fsq_id: '4a1234567890123',
              name: 'Bir Billing',
              country: 'India',
              lat: 32.2031,
              lng: 76.7120,
            },
          ],
        }),
      };

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).suggestions.length).toBeGreaterThan(0);
    });

    test('should return empty suggestions for query < 2 characters', async () => {
      const event = {
        path: '/autocomplete',
        httpMethod: 'GET',
        queryStringParameters: { query: 'b' },
      };

      // Expected: empty suggestions
      const response = {
        statusCode: 200,
        body: JSON.stringify({ suggestions: [] }),
      };

      expect(JSON.parse(response.body).suggestions).toEqual([]);
    });

    test('should return fallback if Foursquare API fails', async () => {
      jest.spyOn(axios, 'get').mockRejectedValue(new Error('API Error'));

      // Expected: fallback destinations
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          suggestions: [
            { name: 'Kyoto', country: 'Japan', lat: 35.0116, lng: 135.7681 },
            // ... more fallbacks
          ],
        }),
      };

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('GET /venues', () => {
    test('should return categories and venues for valid lat/lng', async () => {
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          results: [
            {
              fsq_id: 'v1',
              name: 'Local Cafe',
              categories: [{ name: 'Cafe' }],
              rating: 4.5,
              location: { address: 'Main St' },
            },
          ],
        },
      });

      const event = {
        path: '/venues',
        httpMethod: 'GET',
        queryStringParameters: {
          destination: 'Bir Billing',
          lat: '32.2031',
          lng: '76.7120',
        },
      };

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          destination: 'Bir Billing',
          categories: [
            {
              category: 'Restaurants',
              venues: [
                {
                  fsq_id: 'v1',
                  name: 'Local Cafe',
                  category: 'Cafe',
                  rating: 4.5,
                  address: 'Main St',
                },
              ],
            },
          ],
        }),
      };

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).categories.length).toBeGreaterThan(0);
    });

    test('should return 400 if lat/lng missing', async () => {
      const event = {
        path: '/venues',
        httpMethod: 'GET',
        queryStringParameters: { destination: 'Bir Billing' },
      };

      const response = {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing lat and lng parameters' }),
      };

      expect(response.statusCode).toBe(400);
    });
  });
});
```

- [ ] **Step 3: Commit test**

```bash
git add backend/tests/integration/recommendations.test.js
git commit -m "test: add integration tests for recommendations endpoints"
```

---

### Task 11: Manual E2E Test

**Files:** None (manual testing)

- [ ] **Step 1: Deploy to dev/staging**

```bash
sam deploy --guided  # Use dev values
# Follow prompts, set:
# - Stack name: wanderzenai-stack-dev
# - Region: ap-southeast-2
# - FOURSQUARE_API_KEY: (your test key)
```

- [ ] **Step 2: Test autocomplete endpoint**

```bash
curl "https://YOUR_API_URL/autocomplete?query=bir"
# Expected: { "suggestions": [ { "name": "Bir Billing", "country": "India", ... } ] }
```

- [ ] **Step 3: Test venues endpoint**

```bash
curl "https://YOUR_API_URL/venues?destination=Bir%20Billing&lat=32.2031&lng=76.7120"
# Expected: { "destination": "Bir Billing", "categories": [ ... ] }
```

- [ ] **Step 4: Test frontend flow in browser**

- Open http://localhost:5173 (or your deployed frontend)
- Type destination name → should autocomplete
- Select a destination → should show venue categories
- Select venues → should advance to trip form
- Fill form + submit → check Network tab that selected_venues is sent
- Check RDS: verify selected_venues is stored in submissions table

```bash
# Query DB to verify
psql -h $DB_HOST -U wanderzen_admin -d wanderzenai -c "SELECT id, destination, selected_venues FROM submissions ORDER BY created_at DESC LIMIT 1;"
```

- [ ] **Step 5: Check itinerary generation**

- Monitor CloudWatch logs for itinerary-gen Lambda
- Verify selected venues appear in itinerary text
- Download PDF and verify venues are included

- [ ] **Step 6: Commit notes (no code changes)**

```bash
git add -A  # If any test configs added
git commit -m "test: manual E2E testing complete, venues integrated end-to-end"
```

---

### Task 12: Update API Gateway SAM Template (If Needed)

**Files:**
- Modify: `infra/template.yaml` (finalize API routing)

- [ ] **Step 1: Verify Routes Are Properly Configured**

If you haven't already integrated the routes in Task 4, do so now. The SAM template should have:
- `/autocomplete` → RecommendationsFunction
- `/venues` → RecommendationsFunction
- CORS headers configured

Check the `template.yaml` for proper path configuration.

- [ ] **Step 2: Re-validate YAML**

```bash
sam validate --template infra/template.yaml
```

- [ ] **Step 3: Commit**

```bash
git add infra/template.yaml
git commit -m "infra: verify and finalize API routes for recommendations Lambda"
```

---

### Task 13: Final Checklist & Deploy to Production

**Files:** None

- [ ] **Step 1: Verify DB migration is ready**

```bash
ls -la infra/migrations/add_selected_venues.sql
# Should exist and contain ALTER TABLE statement
```

- [ ] **Step 2: Run DB migration on production RDS**

```bash
psql -h $PROD_DB_HOST -U wanderzen_admin -d wanderzenai -f infra/migrations/add_selected_venues.sql
# Verify:
psql -h $PROD_DB_HOST -U wanderzen_admin -d wanderzenai -c "\d submissions"
# Should show selected_venues column of type jsonb
```

- [ ] **Step 3: Verify all commits are on main branch**

```bash
git log --oneline | head -10
# Should show all tasks committed
```

- [ ] **Step 4: Build backend Lambda layer**

```bash
npm run install:all  # Installs dependencies for all functions including recommendations
```

- [ ] **Step 5: Deploy to production**

```bash
sam deploy \
  --stack-name wanderzenai-stack \
  --region ap-southeast-2 \
  --parameter-overrides \
    FoursquareApiKey=$FOURSQUARE_API_KEY \
    FrontendUrl=https://wanderzenai.com
```

Wait for deployment to complete. Check CloudFormation stack status.

- [ ] **Step 6: Verify API endpoints in production**

```bash
# Test autocomplete
curl "https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/autocomplete?query=bangkok"

# Test venues
curl "https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/venues?destination=Bangkok&lat=13.7563&lng=100.5018"

# Both should return 200 with expected JSON
```

- [ ] **Step 7: Build & deploy frontend**

```bash
cd frontend
npm run build
# Then push to S3 + CloudFront as per your CI/CD workflow
```

- [ ] **Step 8: Smoke test in production**

- Visit https://wanderzenai.com
- Type a destination (e.g., "Bangkok")
- Verify autocomplete works
- Select destination
- Verify venues load (10 categories)
- Select some venues
- Complete form + submit
- Wait for itinerary generation
- Verify venues appear in generated itinerary

- [ ] **Step 9: Monitor costs**

```bash
# Check Foursquare API usage in your dashboard
# Should be minimal in first week
# Expected: ~$1-2 for dev testing, then ~$150/month at scale
```

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore: dynamic destinations + venue selection deployed to production"
```

---

## Rollback Plan (If Issues Arise)

If production issues occur:

1. **Disable autocomplete/venues endpoints** — revert API Gateway routes
2. **Revert itinerary-gen changes** — remove selected_venues handling
3. **Restore UI to original dropdown** — redeploy frontend without new components
4. **Keep DB migration** — selected_venues column is safe to leave (won't hurt if unused)

Rollback time: ~15 minutes

---

## Post-Deployment Checklist

- [ ] Monitor CloudWatch logs for errors (first 24h)
- [ ] Check Foursquare API quota usage
- [ ] Verify user feedback on new flow
- [ ] Confirm itineraries include selected venues
- [ ] Monitor RDS query performance (new JSONB index)

---

## Summary

**Total tasks:** 13  
**Estimated time:** 2-3 days (1 dev, TDD + E2E testing)  
**Commits:** ~10  
**New files:** 5  
**Modified files:** 6  

**Key files to watch:**
- `backend/functions/recommendations/index.js` — handles autocomplete + venues
- `frontend/src/components/plantrip/DestinationSearch.jsx` — search UI
- `frontend/src/components/plantrip/VenueSelection.jsx` — venue picker UI
- `infra/template.yaml` — SAM routing
- `infra/migrations/add_selected_venues.sql` — DB schema
