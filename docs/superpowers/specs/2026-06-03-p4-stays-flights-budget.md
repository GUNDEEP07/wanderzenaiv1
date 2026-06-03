# P4: Accommodation, Flights + Budget Health Check

**Date:** 2026-06-03
**Status:** Approved, ready for implementation

---

## Overview

Adds accommodation type selection, flights deep links, and a budget health check to the VenueSelection step. Budget is moved to step 0 so it is available throughout the wizard.

---

## Change 1: Move budget + currency to step 0

**File:** `frontend/src/pages/PlanTrip.jsx`

Budget and currency are currently in step 2 (JSX index 2, "Budget & dates"). Move them to step 0 (Destinations step).

### 1a. In step 0 JSX, add budget + currency AFTER the days counter and BEFORE the start date field:

```jsx
<div style={s.fieldWrap}>
  <label style={s.label}>Total budget <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${errors.budget ? '#ff6b6b' : 'rgba(255,255,255,0.1)'}`, borderRadius: 10, overflow: 'hidden' }}>
    <select
      style={{ padding: '0.875rem 0.75rem', background: 'rgba(255,255,255,0.02)', border: 'none', color: 'rgba(255,255,255,0.7)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '0.85rem', outline: 'none', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}
      value={form.currency}
      onChange={e => setCurrency(e.target.value)}
    >
      {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label.match(/\((.+)\)/)?.[1] || c.code}</option>)}
    </select>
    <input
      style={{ ...s.input, border: 'none', borderRadius: 0, flex: 1 }}
      type="number" min="0" placeholder="e.g. 5000"
      value={form.budget}
      onChange={e => set('budget', e.target.value)}
    />
  </div>
  {errors.budget && <div style={s.error}>{errors.budget}</div>}
</div>
```

### 1b. Remove budget + currency from step 2 JSX

Step 2 ("Budget & dates") currently shows the currency grid + budget input. Remove both — step 2 becomes just the date picker. Rename the step heading to "Travel dates" and the stepSub to "When are you heading off? We'll use this to check flight prices and crowd levels."

Step 2 after the change:
```jsx
{step === 2 && (
  <div>
    <div style={s.stepLabel}>Step 3 of 6</div>
    <h2 style={s.stepTitle}>Travel dates</h2>
    <p style={s.stepSub}>When are you heading off? This helps us check flight options and seasonal highlights.</p>
    <div style={s.fieldWrap}>
      <label style={s.label}>Start date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
      <input style={s.input} type="date" value={form.travelDate} onChange={e => set('travelDate', e.target.value)} />
    </div>
  </div>
)}
```

(The start date was previously in step 0 — remove it from step 0 and keep it only in step 2. This keeps step 0 focused on destination + days + budget.)

### 1c. Update step 0 start date removal

Remove the start date `<div style={s.fieldWrap}>` block from step 0 — it moves to step 2.

### 1d. Update budget validation

The `validate()` function currently checks `step === 2` for budget. Update it:
- Budget is now in step 0, but it is optional (no validation needed)
- Remove the budget validation from `validate()` entirely (budget is optional — users can plan without one)

---

## Change 2: Extend destination-insights Lambda to return accommodation + budget estimates

**File:** `backend/functions/destination-insights/handler.js`

Add two new fields to the Claude prompt's expected JSON response:

```
"accommodation": [
  {
    "type": "Eco-lodge",
    "style": "homestay",
    "priceRangePerNightUSD": { "low": 35, "high": 70 },
    "description": "Jungle eco-lodge in Ubud with rice terrace views",
    "searchKeyword": "eco lodge ubud bali",
    "whyItFits": "Perfect for Nature + Relaxation travel styles"
  },
  ... 3 more covering hotel, airbnb, and surprise styles
],
"budgetEstimateUSD": {
  "flightsLow": 300,
  "flightsHigh": 600,
  "accommodationPerNightLow": 25,
  "accommodationPerNightHigh": 120,
  "activitiesPerDayLow": 20,
  "activitiesPerDayHigh": 60,
  "cheaperMonths": ["April", "May", "September"],
  "peakMonths": ["July", "August", "December"],
  "flightTip": "Book 6-8 weeks ahead for best prices"
}
```

Update the Claude prompt in `generateFromClaude()` to request these fields. Add them to the JSON structure in the prompt string.

Update the Foursquare path (`getFromFoursquare()`) to set `accommodation: []` and `budgetEstimateUSD: null` since Foursquare doesn't provide this data — the frontend will call Claude fallback if these are null or absent.

---

## Change 3: New AccommodationSection component

**File:** `frontend/src/components/plantrip/subcomponents/AccommodationSection.jsx` (new file)

Props: `destination`, `insights` (from DestinationInsightsPanel — passed up via a new `onInsightsLoaded` prop we re-add), `budget`, `currency`, `days`, `travelStyle`

The component renders:

### 3a. Accommodation type selector
4 buttons: Hotels | Airbnbs | Homestays | Surprise me

Internal state: `const [accomType, setAccomType] = useState('surprise')`

Type → style mapping:
- Hotels → `"hotel"`
- Airbnbs → `"airbnb"`
- Homestays → `"homestay"`
- Surprise me → show all, sorted by `whyItFits` match to travelStyle

### 3b. Accommodation cards
Filter `insights.accommodation` by selected type. Show up to 3 cards:
- Name/type
- Price range in user's currency (convert from USD using rough multipliers: INR×85, EUR×0.92, GBP×0.78, AUD×1.55, CAD×1.38, SGD×1.35, JPY×155; others use USD)
- `whyItFits` description
- "Search on Airbnb →" or "Search on Booking.com →" link using `searchKeyword + ' ' + destination.name`

Airbnb search URL: `https://www.airbnb.com/s/${encodeURIComponent(destination.name)}/homes?query=${encodeURIComponent(searchKeyword)}`
Booking search URL: `https://www.booking.com/search.html?ss=${encodeURIComponent(destination.name + ' ' + searchKeyword)}`

### 3c. Budget health check
Only render if `budget > 0`. Client-side calculation:

```js
function getBudgetHealth(budget, currency, days, budgetEstimateUSD, accomType) {
  if (!budgetEstimateUSD || !budget) return null;
  const rates = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
  const budgetUSD = budget * (rates[currency] || 1);

  const stayMidUSD = accomType === 'hotel'
    ? (budgetEstimateUSD.accommodationPerNightLow + budgetEstimateUSD.accommodationPerNightHigh) / 2 * 1.4
    : accomType === 'homestay'
    ? (budgetEstimateUSD.accommodationPerNightLow + budgetEstimateUSD.accommodationPerNightHigh) / 2 * 0.6
    : (budgetEstimateUSD.accommodationPerNightLow + budgetEstimateUSD.accommodationPerNightHigh) / 2;
  const stayTotalUSD = stayMidUSD * days;
  const flightsMidUSD = (budgetEstimateUSD.flightsLow + budgetEstimateUSD.flightsHigh) / 2;
  const activitiesMidUSD = (budgetEstimateUSD.activitiesPerDayLow + budgetEstimateUSD.activitiesPerDayHigh) / 2 * days;
  const totalUSD = flightsMidUSD + stayTotalUSD + activitiesMidUSD;
  const ratio = totalUSD / budgetUSD;

  return {
    status: ratio < 0.85 ? 'ok' : ratio < 1.05 ? 'tight' : 'over',
    flightsUSD: flightsMidUSD,
    stayUSD: stayTotalUSD,
    activitiesUSD: activitiesMidUSD,
    totalUSD,
    budgetUSD,
    cheaperMonths: budgetEstimateUSD.cheaperMonths || [],
    flightTip: budgetEstimateUSD.flightTip || '',
  };
}
```

Display:
- ✅ Comfortable — green
- ⚠️ Tight — yellow + show cheaper month tip if available
- ❌ Over budget — red + show accommodation type switch suggestion

---

## Change 4: New FlightsSection component

**File:** `frontend/src/components/plantrip/subcomponents/FlightsSection.jsx` (new file)

Props: `destination`, `origin` (from `form.userLocation`), `travelDate`, `days`, `budgetEstimateUSD`, `currency`, `budget`

Renders:
- Route: `{origin || 'your city'} → {destination.name}` with dates
- Estimated price range (from `budgetEstimateUSD.flightsLow/High`, converted to user currency)
- Flight tip from Claude
- Two buttons: Google Flights link + Skyscanner link

Google Flights URL:
```
https://www.google.com/flights?hl=en#flt=${encodeURIComponent(origin)}.${encodeURIComponent(destination.name)}.${travelDate || ''};r:1
```

Skyscanner URL:
```
https://www.skyscanner.com/transport/flights-from/${encodeURIComponent((origin || '').split(',')[0].trim().toLowerCase().replace(/\s+/g,'-'))/
```
(Simplified — Skyscanner resolves city names in path)

If `origin` is empty, show a small input: "Where are you flying from?" — saves to `form.userLocation` via a callback.

---

## Change 5: Wire new components into VenueSelection

**File:** `frontend/src/components/plantrip/VenueSelection.jsx`

### 5a. Re-add onInsightsLoaded to pass insights up to parent

VenueSelection already has `DestinationInsightsPanel` — pass a new local state handler to capture the full insights object (not just suggestions):

```jsx
const [destinationInsights, setDestinationInsights] = useState(null);
```

Pass to DestinationInsightsPanel:
```jsx
onInsightsLoaded={(things) => {
  // store full insights for AccommodationSection
}}
```

BUT DestinationInsightsPanel's `onInsightsLoaded` only receives `result.thingsToDo`. We need the full `result`. Update DestinationInsightsPanel to call a new `onFullInsightsLoaded` prop with the complete `result` object.

### 5b. Add FlightsSection + AccommodationSection at top of right panel scroll area

Add as collapsible sections at top of `venue-panel-right__scroll`, above the "Explore by category" row:

```jsx
{/* ── Flights + Stays ── */}
{destination && (
  <>
    <FlightsSection
      destination={destination}
      origin={userLocation}
      travelDate={startDate}
      days={days}
      budgetEstimateUSD={destinationInsights?.budgetEstimateUSD || null}
      currency={form?.currency || 'USD'}
      budget={form?.budget ? +form.budget : 0}
    />
    <AccommodationSection
      destination={destination}
      insights={destinationInsights}
      budget={form?.budget ? +form.budget : 0}
      currency={form?.currency || 'USD'}
      days={days}
      travelStyle={travelStyles}
    />
  </>
)}
```

VenueSelection needs `form` props passed from PlanTrip. Currently it receives: `destinations`, `travelStyles`, `startDate`, `endDate`, `days`, `onSubmit`, `onSkip`, `onBack`, `savedState`, `onSave`, `preferredActivities`.

Add: `currency`, `budget`, `userLocation`.

In PlanTrip.jsx, update the VenueSelection usage to pass these:
```jsx
<VenueSelection
  ...existing props...
  currency={form.currency}
  budget={form.budget}
  userLocation={form.userLocation}
/>
```

---

## Out of scope

- Real-time flight prices (no Amadeus, Skyscanner API, or Kiwi — all require partnerships)
- Real-time hotel availability (Booking.com, Airbnb APIs require commercial approval)
- Currency conversion API (rough fixed rates in client code are sufficient for estimates)
- Saving accommodation type preference to user profile
