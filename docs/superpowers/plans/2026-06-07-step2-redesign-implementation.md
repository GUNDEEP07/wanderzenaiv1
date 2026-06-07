# Step 2 Redesign: Form Restructuring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure PlanTrip.jsx from 6 steps → 5 steps, integrate flights/hotels recommendations into Step 3, add comprehensive date/budget validation, eliminate redundant questions.

**Architecture:** Refactor PlanTrip.jsx to consolidate Destination + Preferences into Step 1, keep Travel Dates as Step 2, create new Trip Overview (Step 3) with collapsible flights/hotels and AI-generated activities, simplify Review (Step 4) and Submit (Step 5). Create reusable validators (DateValidator, BudgetValidator) and new BudgetClarificationBox component. Integrate existing FlightsSection + AccommodationSection components with minimal changes.

**Tech Stack:** React 18, React Router, Vite, existing component library (FlightsSection, AccommodationSection, DestinationInsightsPanel).

---

## File Structure

### New Files (Create)
- `frontend/src/utils/validators/dateValidator.js` — Date validation utilities
- `frontend/src/utils/validators/budgetValidator.js` — Budget validation utilities
- `frontend/src/components/plantrip/subcomponents/BudgetClarificationBox.jsx` — Budget scope clarification UI

### Modified Files
- `frontend/src/pages/PlanTrip.jsx` — Main refactor (6 steps → 5 steps)
- `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx` — Minor: ensure budgetEstimateUSD is populated

### Integrated Existing Files (No changes needed)
- `frontend/src/components/plantrip/subcomponents/FlightsSection.jsx`
- `frontend/src/components/plantrip/subcomponents/AccommodationSection.jsx`

---

## Task 1: Create DateValidator Utility

**Files:**
- Create: `frontend/src/utils/validators/dateValidator.js`

- [ ] **Step 1: Write the utility with validation functions**

```javascript
// frontend/src/utils/validators/dateValidator.js

/**
 * Check if a date string is in the past (before today)
 * @param {string} dateStr - ISO date string (YYYY-MM-DD)
 * @returns {boolean} true if date is in the past
 */
export function isDateInPast(dateStr) {
  if (!dateStr) return false;
  const inputDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return inputDate < today;
}

/**
 * Check if endDate is after startDate
 * @param {string} startDateStr - ISO date string (YYYY-MM-DD)
 * @param {string} endDateStr - ISO date string (YYYY-MM-DD)
 * @returns {boolean} true if endDate > startDate
 */
export function isEndDateAfterStartDate(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return false;
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  return endDate > startDate;
}

/**
 * Validate date range (both dates valid, not in past, end after start)
 * @param {string} startDateStr - ISO date string (YYYY-MM-DD)
 * @param {string} endDateStr - ISO date string (YYYY-MM-DD)
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateDateRange(startDateStr, endDateStr) {
  const errors = [];

  if (!startDateStr) {
    errors.push('Start date is required');
  } else if (isDateInPast(startDateStr)) {
    errors.push('Start date cannot be in the past');
  }

  if (!endDateStr) {
    errors.push('End date is required');
  } else if (isDateInPast(endDateStr)) {
    errors.push('End date cannot be in the past');
  }

  if (startDateStr && endDateStr && !isEndDateAfterStartDate(startDateStr, endDateStr)) {
    errors.push('End date must be after start date');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate trip duration in days
 * @param {string} startDateStr - ISO date string (YYYY-MM-DD)
 * @param {string} endDateStr - ISO date string (YYYY-MM-DD)
 * @returns {number} number of days (inclusive)
 */
export function calculateTripDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to make inclusive
  return diffDays;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/validators/dateValidator.js
git commit -m "feat: add date validation utilities"
```

---

## Task 2: Create BudgetValidator Utility

**Files:**
- Create: `frontend/src/utils/validators/budgetValidator.js`

- [ ] **Step 1: Write the utility with validation functions**

```javascript
// frontend/src/utils/validators/budgetValidator.js

const MIN_BUDGET = 500;
const MAX_BUDGET = 50000;

/**
 * Check if budget is within acceptable range
 * @param {number} budget - Budget amount
 * @returns {object} { valid: boolean, error: string | null }
 */
export function validateBudget(budget) {
  const numBudget = Number(budget);

  if (isNaN(numBudget) || numBudget <= 0) {
    return {
      valid: false,
      error: 'Budget must be a valid number greater than 0',
    };
  }

  if (numBudget < MIN_BUDGET) {
    return {
      valid: false,
      error: `Budget must be at least $${MIN_BUDGET}`,
    };
  }

  if (numBudget > MAX_BUDGET) {
    return {
      valid: false,
      error: `Budget cannot exceed $${MAX_BUDGET}`,
    };
  }

  return {
    valid: true,
    error: null,
  };
}

/**
 * Check if budget value is suspiciously low (e.g., $1, $10)
 * @param {number} budget - Budget amount
 * @returns {boolean} true if value seems like a typo
 */
export function isBudgetSuspiciouslyLow(budget) {
  const numBudget = Number(budget);
  return numBudget > 0 && numBudget < 100;
}

/**
 * Check if budget value is suspiciously high (e.g., $1,000,000)
 * @param {number} budget - Budget amount
 * @returns {boolean} true if value seems unrealistic
 */
export function isBudgetSuspiciouslyHigh(budget) {
  const numBudget = Number(budget);
  return numBudget > 100000;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/utils/validators/budgetValidator.js
git commit -m "feat: add budget validation utilities"
```

---

## Task 3: Create BudgetClarificationBox Component

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/BudgetClarificationBox.jsx`

- [ ] **Step 1: Write the component**

```javascript
// frontend/src/components/plantrip/subcomponents/BudgetClarificationBox.jsx

import React from 'react';

const SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  JPY: '¥',
};

const USD_RATES = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.28,
  INR: 0.012,
  AUD: 0.65,
  CAD: 0.72,
  SGD: 0.74,
  JPY: 0.0065,
};

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}

function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

export function BudgetClarificationBox({
  budgetEstimateUSD,
  currency = 'USD',
}) {
  if (!budgetEstimateUSD) return null;

  const flightsLow = toUserCurrency(budgetEstimateUSD.flightsLow, currency);
  const flightsHigh = toUserCurrency(budgetEstimateUSD.flightsHigh, currency);
  const stayLow = toUserCurrency(budgetEstimateUSD.accommodationPerNightLow, currency);
  const stayHigh = toUserCurrency(budgetEstimateUSD.accommodationPerNightHigh, currency);
  const activitiesLow = toUserCurrency(budgetEstimateUSD.activitiesPerDayLow, currency);
  const activitiesHigh = toUserCurrency(budgetEstimateUSD.activitiesPerDayHigh, currency);

  return (
    <div style={{
      background: 'rgba(0,212,170,0.06)',
      border: '1px solid rgba(0,212,170,0.2)',
      borderRadius: 12,
      padding: '12px 14px',
      marginTop: 16,
      marginBottom: 16,
    }}>
      <div style={{
        fontSize: '11px',
        color: '#00d4aa',
        fontWeight: 700,
        marginBottom: 8,
      }}>
        💡 Budget Breakdown
      </div>
      <div style={{
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)',
        lineHeight: 1.6,
        marginBottom: 8,
      }}>
        Budget shown includes estimated flights + accommodation + activities. Actual prices vary by provider. Use this as a ballpark.
      </div>
      <div style={{
        fontSize: '11px',
        color: 'rgba(255,255,255,0.6)',
        fontWeight: 600,
      }}>
        ✈️ {fmt(flightsLow, currency)}–{fmt(flightsHigh, currency)} · 🏡 {fmt(stayLow, currency)}–{fmt(stayHigh, currency)}/night · 🎯 {fmt(activitiesLow, currency)}–{fmt(activitiesHigh, currency)}/day
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/plantrip/subcomponents/BudgetClarificationBox.jsx
git commit -m "feat: add budget clarification box component"
```

---

## Task 4: Refactor PlanTrip.jsx - Step 0 (Destination & Preferences)

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx` (Step 0 rendering)

- [ ] **Step 1: Import new validators and components at top of file**

Add these imports after existing imports:

```javascript
import { validateDateRange, calculateTripDays } from '../utils/validators/dateValidator';
import { validateBudget } from '../utils/validators/budgetValidator';
import { BudgetClarificationBox } from '../components/plantrip/subcomponents/BudgetClarificationBox';
```

- [ ] **Step 2: Update STEPS array to reflect 5 steps instead of 6**

Find this line:
```javascript
const STEPS = ['Destination', 'Venues', 'Travel dates', 'Travel style', 'Your details', 'Review'];
```

Replace with:
```javascript
const STEPS = ['Destination & Preferences', 'Travel dates', 'Trip Overview', 'Review', 'Submit'];
```

- [ ] **Step 3: Add new form fields to INITIAL_FORM state**

Find INITIAL_FORM object. Add/modify these fields:

```javascript
const INITIAL_FORM = {
  destinations: [],
  days: 5,
  budget: '',
  currency: (typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency')) || 'USD',
  travelerType: '', // Keep, but make optional
  interests: '', // Add this — moved from Step 3, now in Step 1
  travelStyle: [], // Keep for now, used in Step 3
  travelDate: '', // Start date
  travelDateEnd: '', // Add this — end date (new)
  travelPace: 'balanced', // Moved to Step 1
  wantsHotelRecs: true,
  startTime: '09:00',
  userMustDos: '',
  language: 'English', // Moved to Step 1
  userAge: '', // Keep optional
  userLocation: '',
  email: '',
  selected_venues: {},
  day_assignments: {},
};
```

- [ ] **Step 4: Find the current Step 0 rendering (Destination step) and replace it**

Find the section with:
```javascript
if (step === 0 && form.destinations.length === 0) { ...
```

Replace the entire Step 0 conditional block with:

```javascript
{step === 0 && (
  <div>
    <div style={s.stepLabel}>Step 1 of 5</div>
    <h2 style={s.stepTitle}>Where & When</h2>
    <p style={s.stepSub}>Tell us your destination, how long you'll stay, and what interests you.</p>

    {/* Destination */}
    <div style={s.fieldWrap}>
      <label style={s.label}>Destination *</label>
      <input
        style={{ ...s.input, ...(errors.destination ? s.inputError : {}) }}
        type="text"
        placeholder="Search destination (e.g., Paris, Tokyo, Barcelona)"
        value={form.destinations[0]?.name || ''}
        onChange={e => {
          const destName = e.target.value;
          if (destName) {
            handleDestinationSelect({ name: destName, lat: 0, lng: 0 });
          } else {
            handleDestinationSelect([]);
          }
        }}
      />
      {errors.destination && <div style={s.error}>{errors.destination}</div>}
    </div>

    {/* Days */}
    <div style={s.fieldWrap}>
      <label style={s.label}>Duration (Days) *</label>
      <div style={s.daysRow}>
        <button
          type="button"
          style={s.daysBtn}
          onClick={() => set('days', Math.max(2, form.days - 1))}
        >
          −
        </button>
        <div style={s.daysNum}>{form.days}</div>
        <button
          type="button"
          style={s.daysBtn}
          onClick={() => set('days', Math.min(30, form.days + 1))}
        >
          +
        </button>
      </div>
    </div>

    {/* Budget */}
    <div style={s.fieldWrap}>
      <label style={s.label}>Total Budget *</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
        <input
          style={{ ...s.input, ...(errors.budget ? s.inputError : {}) }}
          type="number"
          placeholder="e.g., 2500"
          value={form.budget}
          onChange={e => set('budget', e.target.value)}
        />
        <select style={s.select} value={form.currency} onChange={e => setCurrency(e.target.value)}>
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>
      {errors.budget && <div style={s.error}>{errors.budget}</div>}
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem', fontStyle: 'italic' }}>
        For flights + accommodation + activities
      </div>
    </div>

    {/* Interests */}
    <div style={s.fieldWrap}>
      <label style={s.label}>What interests you? *</label>
      <textarea
        style={{ ...s.textarea, ...(errors.interests ? s.inputError : {}) }}
        rows={3}
        placeholder="e.g., hiking, food tours, museums, nature, wellness, adventure, culture"
        value={form.interests}
        onChange={e => set('interests', e.target.value)}
      />
      {errors.interests && <div style={s.error}>{errors.interests}</div>}
    </div>

    {/* Travel Pace */}
    <div style={s.fieldWrap}>
      <label style={s.label}>How do you travel? *</label>
      <div style={s.grid3}>
        {PACE_OPTIONS.map(p => (
          <button
            type="button"
            key={p.val}
            style={s.choiceBtn(form.travelPace === p.val)}
            onClick={() => set('travelPace', p.val)}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 400 }}>{p.sub}</div>
          </button>
        ))}
      </div>
    </div>

    {/* Traveler Type (Optional) */}
    <div style={s.fieldWrap}>
      <label style={s.label}>Traveler Type (Optional)</label>
      <div style={s.grid4}>
        {TRAVELER_TYPES.map(type => (
          <button
            type="button"
            key={type}
            style={s.choiceBtn(form.travelerType === type)}
            onClick={() => set('travelerType', type)}
          >
            {type}
          </button>
        ))}
      </div>
    </div>

    {/* Language */}
    <div style={s.fieldWrap}>
      <label style={s.label}>Language for itinerary generation *</label>
      <select style={s.select} value={form.language} onChange={e => set('language', e.target.value)}>
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>{l.label}</option>
        ))}
      </select>
      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem', fontStyle: 'italic' }}>
        The language in which your itinerary will be delivered
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Update the validate() function to check Step 0 fields**

Find the validate function. Update it to:

```javascript
const validate = () => {
  const errs = {};
  if (step === 0) {
    if (form.destinations.length === 0) errs.destination = 'Select a destination';
    if (form.days < 2 || form.days > 30) errs.days = 'Duration must be 2–30 days';
    
    const budgetValidation = validateBudget(form.budget);
    if (!budgetValidation.valid) errs.budget = budgetValidation.error;
    
    if (!form.interests || form.interests.trim().length < 10) {
      errs.interests = 'Tell us what interests you (at least 10 characters)';
    }
    if (!form.travelPace) errs.travelPace = 'Select a travel pace';
    if (!form.language) errs.language = 'Select a language';
  }
  if (step === 3) { // Review step (was Step 4)
    if (!form.email.trim()) errs.email = 'We need your email to send the itinerary';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
  }
  setErrors(errs);
  return Object.keys(errs).length === 0;
};
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "refactor: update step 0 (destination & preferences) with consolidated fields"
```

---

## Task 5: Refactor PlanTrip.jsx - Step 1 (Travel Dates)

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx` (Step 1 rendering)

- [ ] **Step 1: Find and replace the current Step 2 (Travel dates) rendering**

Find:
```javascript
{step === 2 && (
  <div>
    <div style={s.stepLabel}>Step 3 of 6</div>
    <h2 style={s.stepTitle}>Travel dates</h2>
    ...
```

Replace with:

```javascript
{step === 1 && (
  <div>
    <div style={s.stepLabel}>Step 2 of 5</div>
    <h2 style={s.stepTitle}>Travel dates</h2>
    <p style={s.stepSub}>When are you heading off?</p>

    <div style={s.fieldWrap}>
      <label style={s.label}>Start date *</label>
      <input
        style={{ ...s.input, ...(errors.startDate ? s.inputError : {}) }}
        type="date"
        value={form.travelDate}
        onChange={e => set('travelDate', e.target.value)}
      />
      {errors.startDate && <div style={s.error}>{errors.startDate}</div>}
    </div>

    <div style={s.fieldWrap}>
      <label style={s.label}>End date *</label>
      <input
        style={{ ...s.input, ...(errors.endDate ? s.inputError : {}) }}
        type="date"
        value={form.travelDateEnd}
        onChange={e => set('travelDateEnd', e.target.value)}
      />
      {errors.endDate && <div style={s.error}>{errors.endDate}</div>}
    </div>

    {form.travelDate && form.travelDateEnd && (
      <div style={{ ...s.summaryBox, background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}>
        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
          📅 {calculateTripDays(form.travelDate, form.travelDateEnd)} days planned
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 2: Update the validate() function for Step 1 date validation**

Find the validate function and add this condition for step 1:

```javascript
if (step === 1) {
  const dateValidation = validateDateRange(form.travelDate, form.travelDateEnd);
  if (!dateValidation.valid) {
    dateValidation.errors.forEach(err => {
      if (err.includes('Start')) errs.startDate = err;
      else if (err.includes('End')) errs.endDate = err;
      else errs.dateRange = err;
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "refactor: update step 1 (travel dates) with start/end date validation"
```

---

## Task 6: Create and Integrate Step 2 (Trip Overview)

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx` (Add Step 2 rendering)
- Modify: `frontend/src/pages/PlanTrip.jsx` (Add destinationInsights state and fetch)

- [ ] **Step 1: Add destinationInsights state and fetch logic at top of component**

Add this state after existing useState declarations:

```javascript
const [destinationInsights, setDestinationInsights] = useState(null);
const [insightsLoading, setInsightsLoading] = useState(false);
```

Add this effect after the profile/personalization effects:

```javascript
// Fetch destination insights when entering Step 2 (Trip Overview)
useEffect(() => {
  if (step !== 2 || !form.destinations[0] || !form.travelDate || !form.travelDateEnd) return;
  
  let cancelled = false;
  const fetchInsights = async () => {
    setInsightsLoading(true);
    try {
      const destName = form.destinations[0].name;
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/destinations/insights?` +
        `destination=${encodeURIComponent(destName)}&` +
        `startDate=${form.travelDate}&` +
        `endDate=${form.travelDateEnd}&` +
        `interests=${encodeURIComponent(form.interests)}&` +
        `budget=${form.budget}&` +
        `currency=${form.currency}`
      );
      const data = await res.json();
      if (!cancelled) setDestinationInsights(data);
    } catch (e) {
      console.error('Failed to fetch insights', e);
    } finally {
      if (!cancelled) setInsightsLoading(false);
    }
  };
  fetchInsights();
  return () => { cancelled = true; };
}, [step, form.destinations, form.travelDate, form.travelDateEnd, form.interests, form.budget, form.currency]);
```

- [ ] **Step 2: Add Step 2 rendering (Trip Overview) before the existing Step 3**

Find where `{step === 3 &&` starts. Before that, add:

```javascript
{step === 2 && (
  <div>
    <div style={s.stepLabel}>Step 3 of 5</div>
    <h2 style={s.stepTitle}>Trip Overview</h2>
    <p style={s.stepSub}>Here's what to expect for your trip.</p>

    {insightsLoading && (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
        ⏳ Generating recommendations...
      </div>
    )}

    {!insightsLoading && destinationInsights && (
      <>
        {/* Activities Section */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#00d4aa', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
            🎯 Activities
          </div>
          {destinationInsights.thingsToDo && destinationInsights.thingsToDo.length > 0 ? (
            <div style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 12, padding: '14px' }}>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {destinationInsights.thingsToDo.slice(0, 6).map((activity, i) => (
                  <li key={i} style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', paddingLeft: '20px', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0 }}>✓</span>
                    {activity}
                  </li>
                ))}
              </ul>
              <button type="button" style={{ marginTop: '12px', ...s.choiceBtn(false) }}>Customize activities</button>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '1rem 0' }}>No activities loaded</div>
          )}
        </div>

        {/* Flights Section */}
        <FlightsSection
          destination={form.destinations[0]}
          origin={form.userLocation || ''}
          travelDate={form.travelDate}
          budgetEstimateUSD={destinationInsights.budgetEstimateUSD}
          currency={form.currency}
          onOriginChange={origin => set('userLocation', origin)}
          alwaysOpen={false}
        />

        {/* Hotels Section */}
        <AccommodationSection
          destination={form.destinations[0]}
          insights={destinationInsights}
          budget={form.budget}
          currency={form.currency}
          days={form.days}
          travelStyle={form.travelStyle}
          alwaysOpen={false}
        />

        {/* Budget Clarification */}
        <BudgetClarificationBox
          budgetEstimateUSD={destinationInsights.budgetEstimateUSD}
          currency={form.currency}
        />
      </>
    )}

    {!insightsLoading && !destinationInsights && (
      <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', padding: '2rem 0', textAlign: 'center' }}>
        Could not load recommendations. Please try again.
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: Update existing Step 3 (Travel Style) to become Step 3 in code but show as Step 4**

Find `{step === 3 &&` and change the label from "Step 4 of 6" to "Step 4 of 5".

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "feat: add step 2 (trip overview) with flights, hotels, activities, and budget breakdown"
```

---

## Task 7: Simplify Step 3 (Review) - Remove Travel Style Questions

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx` (Remove Step 3 travel style, consolidate into review)

- [ ] **Step 1: Find the old Step 3 (Travel Style) and remove it**

Find the section starting with `{step === 3 && (` that contains "How do you travel?", pace, interests, etc.

Remove the entire step since these are now in Step 0.

- [ ] **Step 2: Update old Step 4 (Your Details) to new Step 3 (Review)**

Rename the step label from "Step 5 of 6" to "Step 4 of 5" and update the summary box to include all form data:

```javascript
{step === 3 && (
  <div>
    <div style={s.stepLabel}>Step 4 of 5</div>
    <h2 style={s.stepTitle}>Review</h2>
    <p style={s.stepSub}>Everything looks good?</p>

    <div style={s.summaryBox}>
      {[
        ['Destination', form.destinations.map(d => d.name).join(', ') || '—'],
        ['Duration', `${form.days} days (${calculateTripDays(form.travelDate, form.travelDateEnd)} days planned)`],
        ['Travel Dates', form.travelDate && form.travelDateEnd ? `${form.travelDate} to ${form.travelDateEnd}` : '—'],
        ['Budget', `${form.currency} ${form.budget}`],
        ['Travel Pace', form.travelPace],
        ['Traveler Type', form.travelerType || '(not specified)'],
        ['Interests', form.interests],
        ['Language', form.language],
      ].map(([k, v]) => (
        <div key={k} style={s.summaryRow}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}</span>
          <strong style={{ color: '#00d4aa' }}>{v}</strong>
        </div>
      ))}
    </div>

    <div style={s.fieldWrap}>
      <label style={s.label}>Your email address *</label>
      <input
        style={{ ...s.input, ...(errors.email ? s.inputError : {}) }}
        type="email"
        placeholder="you@example.com"
        value={form.email}
        onChange={e => set('email', e.target.value)}
        autoFocus
      />
      {errors.email && <div style={s.error}>{errors.email}</div>}
      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.5rem', fontStyle: 'italic' }}>
        We only use your email to send the itinerary. No spam, ever.
      </div>
    </div>

    {submitError && <div style={s.submitError}>{submitError}</div>}
  </div>
)}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "refactor: consolidate travel style into step 0, simplify review step"
```

---

## Task 8: Update Submit Step (Step 4) and Navigation

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx` (Update step 4 button text, update nav button logic)

- [ ] **Step 1: Find the nav buttons section and update for 5-step flow**

Find:
```javascript
{step < 5 && (
```

Change to:
```javascript
{step < 4 && (
```

And update the text/logic for the last step button on step 3 (Review):

```javascript
{step === 3 && (
  <div style={s.navBtns}>
    {step > 0 && (
      <button type="button" style={s.backBtnForm} onClick={back} disabled={submitting}>← Back</button>
    )}
    <div style={{ flex: 1 }} />
    <button
      type="button"
      style={{
        ...s.nextBtn,
        ...(submitting ? { background: 'rgba(0,212,170,0.5)', cursor: 'not-allowed' } : {}),
      }}
      onClick={handleSubmit}
      disabled={submitting}
    >
      {submitting ? 'Generating...' : 'Generate My Itinerary'}
    </button>
  </div>
)}
```

- [ ] **Step 2: Update the old StepReview reference (if it exists)**

If there's code for `{step === 5 &&` with StepReview import, remove it since we no longer have a separate review component.

- [ ] **Step 3: Update STEPS length check in progressBar**

Find the progressBar section and verify it loops through all STEPS. It should now loop through 5 items instead of 6.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PlanTrip.jsx
git commit -m "refactor: update navigation and step logic for 5-step flow"
```

---

## Task 9: End-to-End Form Flow Test

**Files:**
- Test: Manual testing of entire form flow

- [ ] **Step 1: Start the dev server**

```bash
cd frontend && npm run dev
```

Expected: Server runs on http://localhost:5173

- [ ] **Step 2: Navigate to /plan and test Step 0 (Destination & Preferences)**

- Fill destination: "Paris"
- Set days: 5
- Set budget: 2500
- Set interests: "hiking, food tours, museums"
- Select pace: "Balanced"
- Select language: "English"
- Click Next

Expected: Form advances to Step 1, no errors, all fields accepted.

- [ ] **Step 3: Test Step 1 (Travel Dates)**

- Click on start date field
- Try selecting a date in the past → Error: "Start date cannot be in the past"
- Select start date: 10 days from today
- Leave end date empty
- Click Next → Error: "End date is required"
- Select end date: 2 days before start date
- Click Next → Error: "End date must be after start date"
- Select end date: 5 days after start date
- Click Next

Expected: Form advances to Step 2, dates validated correctly.

- [ ] **Step 4: Test Step 2 (Trip Overview)**

Verify:
- Loading spinner shows "Generating recommendations..."
- Activities section loads with 6+ activities
- Flights section shows collapsed summary: "✈️ Est. £XXX–XXX"
- Hotels section shows collapsed summary: "🏡 Est. £XX–XX/night"
- Budget clarification box visible: "Budget shown includes..."
- No console errors

Click "Flights" summary to expand → Full flights section loads with From/To/Price/Links.

Click "Hotels" summary to expand → Full hotels section loads with 4 accommodation cards.

Click Next → Advance to Step 3.

- [ ] **Step 5: Test Step 3 (Review)**

Verify:
- All form data displayed: destination, dates, budget, pace, interests, language, traveler type
- Email field pre-filled with logged-in user's email (or empty if not logged in)
- Budget total calculated correctly
- No console errors

- [ ] **Step 6: Test Step 4 (Submit)**

- Try submitting with invalid email
- Correct email
- Click "Generate My Itinerary"
- Verify loading state
- On success: Should redirect to /confirmation

- [ ] **Step 7: Test validation edge cases**

- **Budget validation:**
  - Try budget: 100 → Error: "Budget must be at least $500"
  - Try budget: 100000 → Error: "Budget cannot exceed $50000"
  - Try budget: 2500 → Success

- **Date validation:**
  - Try dates: start = today, end = tomorrow → Success
  - Try dates: start = today - 1, end = today + 5 → Error: "Start date cannot be in the past"
  - Try dates: start = empty, end = tomorrow → Error: "Start date is required"

- **Interests validation:**
  - Try interests: "abc" (3 chars) → Error: "Tell us what interests you (at least 10 characters)"
  - Try interests: "hiking food culture" → Success

- [ ] **Step 8: Test back button navigation**

- On Step 1, click Back → Go to Step 0
- On Step 3, click Back → Go to Step 2
- Verify form data persists when navigating back and forth

- [ ] **Step 9: Commit test results**

```bash
git add -A && git commit -m "test: verify end-to-end form flow with all validations"
```

---

## Task 10: Regression Testing - Verify No Breakage

**Files:**
- Test: Existing features remain functional

- [ ] **Step 1: Test Dashboard page loads without errors**

Navigate to `/dashboard` → Should show user itineraries, no console errors.

- [ ] **Step 2: Test Pricing page loads without errors**

Navigate to `/pricing` → Should show pricing tiers, no errors.

- [ ] **Step 3: Test Explore page loads without errors**

Navigate to `/explore` → Should show destination search, no errors.

- [ ] **Step 4: Test existing form persistence**

- Go to /plan, fill Step 0 partially
- Refresh page → Form data should persist in sessionStorage
- Fill rest of form, submit → On success, sessionStorage should be cleared

- [ ] **Step 5: Test currency persistence**

- On Step 0, change currency to EUR
- Go back to home, come back to /plan
- Currency should still be EUR (persisted in localStorage)

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "test: regression testing confirms no breakage to existing features"
```

---

## Implementation Checklist

- [ ] Task 1: Create DateValidator utility ✓
- [ ] Task 2: Create BudgetValidator utility ✓
- [ ] Task 3: Create BudgetClarificationBox component ✓
- [ ] Task 4: Refactor Step 0 (Destination & Preferences) ✓
- [ ] Task 5: Refactor Step 1 (Travel Dates) ✓
- [ ] Task 6: Create Step 2 (Trip Overview) ✓
- [ ] Task 7: Simplify Step 3 (Review) ✓
- [ ] Task 8: Update navigation and buttons ✓
- [ ] Task 9: End-to-end form flow testing ✓
- [ ] Task 10: Regression testing ✓

---

## Notes

- All code follows WanderZenAI's existing patterns (s-object styles, card layouts, Fraunces serif, #00d4aa accents)
- Validators are reusable utilities (not tied to React components)
- FlightsSection + AccommodationSection require no changes (drop-in integration)
- Form state structure remains similar (only added travelDateEnd, moved interests, added destinationInsights)
- All validations happen on form submission, not real-time (matches current UX pattern)
- Errors cleared on field change (existing behavior preserved)
- SessionStorage and localStorage persistence maintained
