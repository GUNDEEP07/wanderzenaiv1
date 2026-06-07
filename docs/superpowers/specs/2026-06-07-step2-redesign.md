# Step 2 Redesign: Streamlined Trip Planning Flow

**Status:** Design Spec  
**Date:** 2026-06-07  
**Scope:** Restructure multi-step form from 6 steps → 5 steps. Move from Step 1 (Venues) → Step 3 (Trip Overview) pattern to consolidated Destination + Activities + Budget + Dates flow.

---

## Problem Statement

Current form has:
- Redundant questions (interests asked twice: Step 1 activity selection + Step 3 interests field)
- Poor information architecture (budget info only visible in Step 1, dates in Step 2, style in Step 3)
- Missing guidance on what budget includes (flights + hotels + activities vs activities-only)
- No validation on date ranges, budget values, or data quality

**Goal:** Streamline to 5 steps, eliminate redundancy, clarify requirements, validate all inputs.

---

## User Flow

### Step 1: Destination & Travel Preferences
**Purpose:** Capture where, how long, budget, and what user wants to do. This is the PRIMARY input for Claude recommendations.

**Fields:**
| Field | Type | Required | Validation | Notes |
|-------|------|----------|-----------|-------|
| Destination | Text/Search | Yes | Autocomplete from supported destinations | Can select multiple |
| Duration (Days) | Number | Yes | 2–30 days | Min 2 nights (at least 1 full day) |
| Budget | Currency Input | Yes | $500–$50,000 range; reject non-sensical values (<$100 or >$100k) | Total trip budget (flights + accommodation + activities) |
| Currency | Dropdown | Yes | 8 currencies (USD, EUR, GBP, INR, AUD, CAD, SGD, JPY) | Persist to localStorage |
| **Interests** | Textarea | Yes | Min 10 characters | "What interests you? (e.g., hiking, food tours, museums, nature, wellness, adventure, culture)" — this drives AI recommendations |
| **Travel Pace** | Radio/Pills | Yes | 3 options: Relaxed / Balanced / Full days | "How do you prefer to travel?" with short descriptions |
| Traveler Type | Dropdown | No | Solo / Couple / Family / Group | Optional; used for personalization |
| **Language** | Dropdown | Yes | Default: English | **Label explicitly says:** "Language for itinerary generation & delivery" — not language spoken, but output language |

**UI Pattern:** Match existing step styling (card layout, Fraunces serif title, #00d4aa accents, dark theme).

**Validation on Next:**
- All required fields filled
- Budget value is within acceptable range (not $1, not $1,000,000)
- Destination is valid
- Interests field has meaningful input (not single word)

---

### Step 2: Travel Dates
**Purpose:** Lock in when the trip happens. Enables budget & flight estimates downstream.

**Fields:**
| Field | Type | Required | Validation | Notes |
|-------|------|----------|-----------|-------|
| Start Date | Date Input | Yes | Cannot be in past; cannot be before today | Format: YYYY-MM-DD |
| End Date | Date Input | Yes | Cannot be in past; must be after start date | Format: YYYY-MM-DD; enforced duration matches Step 1 days |

**UI Pattern:** 2-column grid layout (From | To). Show effective trip length below (e.g., "5 days, 4 nights").

**Validation on Next:**
- Both dates provided
- No dates in past
- End date > start date
- Date range matches stated duration (if Step 1 says "5 days", dates should span 4–5 nights)

---

### Step 3: Trip Overview
**Purpose:** Show AI-generated activity recommendations based on interests + dates. Show estimated flights + hotels. User can refine activities by category. **NO DATA COLLECTION** — read-only preview with collapsible sections.

**Sections (in order):**

#### A. Activities (Expanded by Default)
- **AI-generated list** of activities based on Step 1 interests + destination
- **Display format:** Activity cards with category badges (Hiking, Food, Culture, etc.), brief descriptions
- **Category filter:** "Filter by: All / Hiking / Food / Culture / Nature / Wellness / Adventure / Nightlife"
- **Day assignment:** Show which day each activity is scheduled
- **Edit option:** "Customize activities" button → links to activity editor (future feature)
- **Loading state:** "Generating personalized activities..." spinner while Claude API responds

#### B. Flights (Collapsed by Default)
- **Summary badge:** "✈️ Est. £600–900 return flight"
- **Expanded view:** (when clicked)
  - From: [User's saved home city or auto-detected location from IP]
  - To: [Selected destination]
  - Date: [Start date from Step 2]
  - Price range (low–high in user's currency)
  - "Search on Google Flights →" button (external link)
  - "Search on Skyscanner →" button (external link)
  - Budget tip if available (e.g., "Typically cheaper in March")

#### C. Hotels (Collapsed by Default)
- **Summary badge:** "🏡 Est. £80–150/night"
- **Expanded view:** (when clicked)
  - 4 accommodation cards (Surprise me / Hotels / Airbnbs / Homestays)
  - Photos of sample accommodations
  - Price per night range
  - "Search on Airbnb →" button
  - "Search on Booking.com →" button
  - Budget health indicator: ✅ Comfortable / ⚠️ Tight / ❌ Over budget
  - If tight/over budget: "Travel in [month] for cheaper flights"

#### Budget Clarity (Always Visible)
- **Message box:** "💡 Budget shown includes estimated flights + accommodation + activities. Actual prices vary by provider. Use this as a ballpark, not exact pricing."
- **Total breakdown:** "✈️ $600–900 · 🏡 $250–400/night · 🎯 $150–250/day activities"

**Data Fetch Trigger:**
- When user enters Step 3, fetch `destinationInsights` API with:
  - Destination name
  - Start/end dates (from Step 2)
  - Interests (from Step 1)
  - Budget (from Step 1)
  - Currency (from Step 1)
- Cache results so re-entering Step 3 doesn't re-fetch

**Error Handling:**
- If activities fail to load: "Couldn't generate activities. Try again or skip to review."
- If flights/hotels fail: Show summary only ("Data temporarily unavailable")
- If budget estimates missing: Hide budget health indicator

---

### Step 4: Review
**Purpose:** Final preview of selections before submission. Email is pre-filled from logged-in user but editable.

**Display:**
- Summary box showing:
  - Destinations (comma-separated)
  - Duration (X days)
  - Budget (currency + amount)
  - Traveler type (if selected)
  - Travel pace
  - Interests (brief summary or truncated)
  - Language
  - Selected activities (count)
  - Travel dates (start → end)
  
**Email Field:**
- **Label:** "Where should we send your itinerary?"
- **Pre-filled:** User's logged-in email (from Auth context)
- **Editable:** User can change if needed
- **Validation:** Valid email format required
- **Helper text:** "We only use your email to send the itinerary. No spam."

**UI Pattern:** Match current Step 4 styling.

---

### Step 5: Submit
**Purpose:** Final submission button. Triggers itinerary generation.

**Button:**
- Text: "Generate My Itinerary"
- Disabled state while submitting
- Error message if submission fails

**Flow after submit:**
- Show loading spinner: "Creating your personalized itinerary..."
- On success: Redirect to `/confirmation` with submission ID
- On error: Show error message, allow retry

---

## Data Validation Rules

### Date Validation
```
- Start Date:
  - Not in past (cannot be before today's date)
  - Must be a valid date
  
- End Date:
  - Not in past
  - Must be after start date
  - (Optional) Should match stated duration ±1 day
```

### Budget Validation
```
- Minimum: $500 (trips below this are unrealistic)
- Maximum: $50,000 (reasonable cap; users rarely plan above this)
- Sanity check: Reject values like $1, $10, $1,000,000
- Allow all values between $500–$50,000
```

### Required Fields
```
Step 1:
- Destination: Not empty, valid destination
- Duration: Integer 2–30
- Budget: Number in valid range
- Currency: Valid code
- Interests: Min 10 characters (not just "yes" or "hiking")
- Travel Pace: Selected
- Language: Selected (default English)

Step 2:
- Start Date: Valid date, not in past
- End Date: Valid date, not in past, > start date

Step 4:
- Email: Valid email format (regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
```

---

## Architecture Changes

### Files to Modify
1. **frontend/src/pages/PlanTrip.jsx**
   - Restructure step logic (currently 6 steps → 5 steps)
   - Add date validation
   - Add budget validation
   - Fetch destinationInsights in Step 3 if not already fetched
   - Update STEPS array and progress bar

2. **frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx**
   - Extract budget fetch logic into reusable hook
   - Used by Step 3 to load flights, hotels, activities

3. **frontend/src/api/destinationInsights.js**
   - Ensure API includes: budgetEstimateUSD, accommodation array, activities array
   - Add error handling for missing/incomplete data

### Components to Integrate
1. **FlightsSection** (already exists)
   - Import into Step 3
   - Pass: destination, origin (or auto-detect), travelDate, budgetEstimateUSD, currency

2. **AccommodationSection** (already exists)
   - Import into Step 3
   - Pass: destination, insights (destinationInsights), budget, currency, days, travelStyle

3. **DestinationInsightsPanel** (partially used)
   - Extract activities recommendation into Step 3
   - Show with category filtering

### New Components
1. **BudgetClarificationBox** (simple component)
   - Shows: "Budget shown includes flights + accommodation + activities"
   - Display format: "✈️ $600–900 · 🏡 $250/night · 🎯 $150/day activities"

2. **DateValidator** (utility/hook)
   - Validates start/end dates
   - Checks against past dates
   - Reusable across form steps

3. **BudgetValidator** (utility/hook)
   - Validates budget is in $500–$50,000 range
   - Reusable

---

## User Experience Details

### Speed-First Data Loading
- **Step 1:** Loads instantly (no API calls)
- **Step 2:** Loads instantly (no API calls)
- **Step 3:** Fetches destinationInsights on entry (flights, hotels, activities). Show loading spinner: "Generating recommendations..."
- **Step 4:** Loads instantly (summary display)

### Collapsible Sections in Step 3
- **Activities:** Expanded by default (user's focus)
- **Flights:** Collapsed by default (nice-to-have, cost-conscious users expand)
- **Hotels:** Collapsed by default (nice-to-have)

### Accessibility
- All inputs have proper `<label>` tags
- Required field indicators (*)
- Error messages displayed inline below fields
- Form validation prevents submission with invalid data

---

## Success Criteria

✅ **Form completion rate increases** — Streamlined 5 steps vs cluttered 6  
✅ **No redundant questions** — Interests asked once (Step 1), not twice  
✅ **Data quality improves** — Validations prevent nonsensical inputs (dates in past, $1 budgets)  
✅ **Users understand budget scope** — Clear message that budget includes flights + hotels + activities  
✅ **Fast form entry** — No unnecessary API calls until Step 3  
✅ **Clear step purposes** — Each step has one job, users know what to expect  

---

## Timeline & Dependencies

- **Destination & Travel Preferences step:** Uses existing components (date input, currency dropdown, textarea)
- **Travel Dates step:** Uses native date input + validation
- **Trip Overview step:** Integrates existing FlightsSection + AccommodationSection
- **Review step:** Uses existing summary box component

**Estimated implementation:** 4–6 hours (refactor PlanTrip.jsx, add validations, integrate existing components)

---

## Notes

- Email pre-fill from Auth context: `currentUser.email`
- Language defaults to English but can be changed by user
- Traveler Type is optional (used for future personalization, not required for itinerary generation)
- Budget is **total trip budget**, not per-day or activities-only
- Origin city for flights: Auto-detect from IP or use saved `userLocation` from Step 1
