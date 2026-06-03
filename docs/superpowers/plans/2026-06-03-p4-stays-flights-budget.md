# P4: Accommodation, Flights + Budget Health — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accommodation type selection, flights deep links, and a budget health check to VenueSelection, powered by an extended destination-insights Lambda and with budget moved to step 0.

**Architecture:** Budget + currency move to step 0 of PlanTrip (so they're available during VenueSelection). The destination-insights Lambda returns two new Claude-generated fields: `accommodation[]` and `budgetEstimateUSD`. Two new frontend components (FlightsSection, AccommodationSection) render collapsible sections at the top of the VenueSelection right panel. VenueSelection receives `currency`, `budget`, `userLocation` props from PlanTrip.

**Tech Stack:** React 18, Vite, AWS Lambda (Node 20), Anthropic SDK, Foursquare Places API (existing), Google Flights deep link, Skyscanner deep link, Airbnb search link, Booking.com search link

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/pages/PlanTrip.jsx` | Modify | Move budget+currency to step 0; simplify step 2 to dates only; pass new props to VenueSelection |
| `backend/functions/destination-insights/handler.js` | Modify | Extend Claude prompt to return `accommodation[]` + `budgetEstimateUSD`; Foursquare path returns nulls |
| `frontend/src/components/plantrip/subcomponents/FlightsSection.jsx` | **Create** | Collapsible flights card with origin→dest, estimate, Google Flights + Skyscanner links |
| `frontend/src/components/plantrip/subcomponents/AccommodationSection.jsx` | **Create** | Type selector (Hotels/Airbnbs/Homestays/Surprise me), cards, budget health check |
| `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx` | Modify | Add `onFullInsightsLoaded` prop that passes complete result object |
| `frontend/src/components/plantrip/VenueSelection.jsx` | Modify | Accept `currency/budget/userLocation`; capture full insights; render FlightsSection + AccommodationSection |

**Execution order:** Task 1 (PlanTrip) → Task 2 (Lambda, deploy via GitHub Actions push) → Task 3 (FlightsSection) → Task 4 (AccommodationSection) → Task 5 (Wire VenueSelection)

---

## Task 1: Move budget to step 0, simplify step 2

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

Read the file first to confirm line numbers (it is ~580 lines).

- [ ] **Step 1: Add budget + currency to step 0**

In step 0 (the Destination step), find the start date field block:
```jsx
              <div style={s.fieldWrap}>
                <label style={s.label}>Start date <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' }}>(optional)</span></label>
                <input style={s.input} type="date" value={form.travelDate} onChange={e => set('travelDate', e.target.value)} />
              </div>
```

Insert the following BEFORE the start date field:
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
              </div>
```

- [ ] **Step 2: Remove start date from step 0**

Delete the start date field from step 0 (the block added in step 1 replaces its position — start date moves to step 2 only).

- [ ] **Step 3: Replace step 2 content**

Find the entire step 2 block (search for `{step === 2 &&`). Replace the full block with:

```jsx
          {/* ── Step 2: Travel dates ──────────────────────────────── */}
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

- [ ] **Step 4: Remove budget validation from validate()**

Find `validate()`. Remove the budget validation line:
```js
    if (step === 2 && (!form.budget || isNaN(form.budget) || +form.budget <= 0)) errs.budget = 'Enter your total budget';
```
Budget is now optional — delete this line entirely.

- [ ] **Step 5: Pass currency, budget, userLocation to VenueSelection**

Find the `<VenueSelection` JSX (in the step === 1 early return). Add three new props:
```jsx
            currency={form.currency}
            budget={form.budget}
            userLocation={form.userLocation}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 7: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/PlanTrip.jsx && git commit -m "feat: move budget+currency to step 0; step 2 becomes travel dates only"
```

---

## Task 2: Extend destination-insights Lambda

**Files:**
- Modify: `backend/functions/destination-insights/handler.js`

- [ ] **Step 1: Update the Claude prompt in generateFromClaude()**

Find the `const prompt = ...` string in `generateFromClaude()`. The current JSON structure ends with `"travelTip"`. Add two new fields to the expected JSON schema in the prompt:

Find this line near the end of the prompt:
```
  "travelTip": "One specific actionable tip for this destination and travel style"
```

Replace with:
```
  "travelTip": "One specific actionable tip for this destination and travel style",
  "accommodation": [
    {
      "type": "Eco-lodge",
      "style": "homestay",
      "priceRangePerNightUSD": { "low": 35, "high": 70 },
      "description": "One sentence describing this accommodation type at this destination",
      "searchKeyword": "eco lodge bali ubud",
      "whyItFits": "One sentence on why this matches the travel style"
    }
  ],
  "budgetEstimateUSD": {
    "flightsLow": 300,
    "flightsHigh": 600,
    "accommodationPerNightLow": 25,
    "accommodationPerNightHigh": 120,
    "activitiesPerDayLow": 20,
    "activitiesPerDayHigh": 60,
    "cheaperMonths": ["April", "May"],
    "peakMonths": ["July", "August"],
    "flightTip": "Book 6-8 weeks in advance for best prices"
  }
```

Also add to the instruction text in the prompt:

After `Return 5–7 thingsToDo.`, add:
```
Return exactly 4 accommodation options — one each for style values: "hotel", "airbnb", "homestay", "surprise". The "surprise" entry should be the most unique slow-travel option for this destination. For budgetEstimateUSD, provide typical ranges in USD for international travel to this destination.
```

- [ ] **Step 2: Update Foursquare path to include null accommodation fields**

Find `getFromFoursquare()`. The function returns an object ending with `travelTip`. Add the two new fields with null/empty values:

```js
  return {
    thingsToDo: allVenues.slice(0, 8),
    weather: 'Check local forecast for your travel dates',
    crowdLevel: 'Moderate',
    seasonalHighlights: `Curated top spots in ${destination} for ${travelStyles.join(', ') || 'all interests'}`,
    travelTip: `Book popular venues in ${destination} ahead of time during peak season`,
    bestMonths: [],
    whyThisMonth: '',
    accommodation: [],
    budgetEstimateUSD: null,
  };
```

- [ ] **Step 3: Verify Lambda syntax**

```bash
node --input-type=module --eval "import('./backend/functions/destination-insights/handler.js').then(() => console.log('OK')).catch(e => { if (!e.message.includes('DB_HOST') && !e.message.includes('CLAUDE_API')) console.error('SYNTAX ERROR:', e.message); else console.log('OK'); })" 2>&1
```
Expected: `OK`

- [ ] **Step 4: Commit and push (GitHub Actions deploys)**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add backend/functions/destination-insights/handler.js && git commit -m "feat: extend destination-insights — accommodation types + budget estimates from Claude" && git push origin main
```

Wait for GitHub Actions to deploy before testing. Monitor at: https://github.com/GUNDEEP07/wanderzenaiv1/actions

- [ ] **Step 5: Verify live endpoint returns new fields**

```bash
curl -s "https://y44o2x9cu1.execute-api.ap-southeast-2.amazonaws.com/prod/destination-insights?destination=Bali&travelStyles=Nature&startDate=2025-06-28&endDate=2025-07-03" | python3 -c "import sys,json; d=json.load(sys.stdin); print('accommodation:', len(d['insights'].get('accommodation',[])), 'entries'); print('budgetEstimateUSD:', 'present' if d['insights'].get('budgetEstimateUSD') else 'MISSING')"
```
Expected: `accommodation: 4 entries` and `budgetEstimateUSD: present`

---

## Task 3: Create FlightsSection component

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/FlightsSection.jsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/components/plantrip/subcomponents/FlightsSection.jsx` with this full content:

```jsx
import React, { useState } from 'react';

const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}
function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

export function FlightsSection({ destination, origin, travelDate, budgetEstimateUSD, currency, onOriginChange }) {
  const [open, setOpen] = useState(true);
  const [localOrigin, setLocalOrigin] = useState(origin || '');
  const destName = destination?.name || '';
  const effectiveOrigin = origin || localOrigin;
  const originCity = (effectiveOrigin || '').split(',')[0].trim();
  const originSlug = originCity.toLowerCase().replace(/\s+/g, '-');
  const dateStr = travelDate || '';

  const flightsLow = budgetEstimateUSD ? toUserCurrency(budgetEstimateUSD.flightsLow, currency) : null;
  const flightsHigh = budgetEstimateUSD ? toUserCurrency(budgetEstimateUSD.flightsHigh, currency) : null;

  const googleUrl = `https://www.google.com/flights?hl=en#flt=${encodeURIComponent(originCity || 'London')}.${encodeURIComponent(destName)}.${dateStr};r:1`;
  const skyscannerUrl = originSlug
    ? `https://www.skyscanner.com/transport/flights-from/${originSlug}/`
    : 'https://www.skyscanner.com/flights';

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', cursor: 'pointer',
          background: open ? 'rgba(96,165,250,0.08)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${open ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: open ? '8px 8px 0 0' : 8,
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
          ✈️ Flights {originCity ? `from ${originCity}` : '— where are you flying from?'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px' }}>

          {!origin && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Flying from</div>
              <input
                value={localOrigin}
                onChange={e => setLocalOrigin(e.target.value)}
                onBlur={e => { if (e.target.value.trim()) onOriginChange?.(e.target.value.trim()); }}
                placeholder="e.g. Sydney, London, Mumbai"
                style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: '#fff', fontFamily: 'inherit', fontSize: 12, outline: 'none' }}
              />
            </div>
          )}

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            {originCity || '?'} → {destName}
            {travelDate && ` · ${new Date(travelDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            {flightsLow && flightsHigh && (
              <span style={{ color: 'rgba(255,255,255,0.8)', marginLeft: 8, fontWeight: 600 }}>
                · {fmt(flightsLow, currency)}–{fmt(flightsHigh, currency)} return
              </span>
            )}
          </div>

          {budgetEstimateUSD?.flightTip && (
            <div style={{ fontSize: 10, color: '#60a5fa', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 6, padding: '5px 8px', marginBottom: 10, lineHeight: 1.5 }}>
              💡 {budgetEstimateUSD.flightTip}
            </div>
          )}

          {budgetEstimateUSD?.cheaperMonths?.length > 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,217,61,0.85)', background: 'rgba(255,217,61,0.05)', border: '1px solid rgba(255,217,61,0.15)', borderRadius: 6, padding: '5px 8px', marginBottom: 10, lineHeight: 1.5 }}>
              📅 Cheaper to fly in: {budgetEstimateUSD.cheaperMonths.join(', ')}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <a href={googleUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '8px', background: 'linear-gradient(135deg,#60a5fa,#3b82f6)', borderRadius: 7, fontSize: 11, fontWeight: 800, color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
              Google Flights →
            </a>
            <a href={skyscannerUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', textAlign: 'center' }}>
              Skyscanner →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 3: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/components/plantrip/subcomponents/FlightsSection.jsx && git commit -m "feat: FlightsSection component — origin/dest, estimates, Google Flights + Skyscanner links"
```

---

## Task 4: Create AccommodationSection component

**Files:**
- Create: `frontend/src/components/plantrip/subcomponents/AccommodationSection.jsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/components/plantrip/subcomponents/AccommodationSection.jsx`:

```jsx
import React, { useState } from 'react';

const USD_RATES = { USD:1, EUR:1.09, GBP:1.28, INR:0.012, AUD:0.65, CAD:0.72, SGD:0.74, JPY:0.0065 };
const SYMBOLS = { USD:'$', EUR:'€', GBP:'£', INR:'₹', AUD:'A$', CAD:'C$', SGD:'S$', JPY:'¥' };

function toUserCurrency(usd, currency) {
  return Math.round(usd / (USD_RATES[currency] || 1));
}
function fmt(amount, currency) {
  return `${SYMBOLS[currency] || currency}${amount.toLocaleString()}`;
}

const TYPE_OPTIONS = [
  { key: 'hotel',    label: '🏨 Hotels' },
  { key: 'airbnb',   label: '🏠 Airbnbs' },
  { key: 'homestay', label: '🤝 Homestays' },
  { key: 'surprise', label: '✨ Surprise me' },
];

function getBudgetHealth(budget, currency, days, budgetEstimateUSD, accomType) {
  if (!budgetEstimateUSD || !budget || +budget <= 0) return null;
  const budgetUSD = +budget * (USD_RATES[currency] || 1);

  const multipliers = { hotel: 1.4, airbnb: 1.0, homestay: 0.6, surprise: 0.8 };
  const m = multipliers[accomType] || 1.0;
  const stayMidUSD = ((budgetEstimateUSD.accommodationPerNightLow + budgetEstimateUSD.accommodationPerNightHigh) / 2) * m * days;
  const flightsMidUSD = (budgetEstimateUSD.flightsLow + budgetEstimateUSD.flightsHigh) / 2;
  const activitiesMidUSD = ((budgetEstimateUSD.activitiesPerDayLow + budgetEstimateUSD.activitiesPerDayHigh) / 2) * days;
  const totalUSD = flightsMidUSD + stayMidUSD + activitiesMidUSD;
  const ratio = totalUSD / budgetUSD;

  return {
    status: ratio < 0.85 ? 'ok' : ratio < 1.05 ? 'tight' : 'over',
    flights: toUserCurrency(flightsMidUSD, currency),
    stay: toUserCurrency(stayMidUSD, currency),
    activities: toUserCurrency(activitiesMidUSD, currency),
    total: toUserCurrency(totalUSD, currency),
    budget: +budget,
    cheaperMonths: budgetEstimateUSD.cheaperMonths || [],
  };
}

export function AccommodationSection({ destination, insights, budget, currency, days, travelStyle }) {
  const [open, setOpen] = useState(true);
  const [accomType, setAccomType] = useState('surprise');
  const destName = destination?.name || '';

  const accommodation = insights?.accommodation || [];
  const budgetEstimateUSD = insights?.budgetEstimateUSD || null;

  const filtered = accomType === 'surprise'
    ? accommodation
    : accommodation.filter(a => a.style === accomType);
  const cards = filtered.slice(0, 3);

  const health = getBudgetHealth(budget, currency, days, budgetEstimateUSD, accomType);

  const statusStyle = {
    ok:    { bg: 'rgba(0,212,170,0.08)', border: 'rgba(0,212,170,0.25)', label: '✅ Budget looks comfortable', color: '#00d4aa' },
    tight: { bg: 'rgba(255,217,61,0.08)', border: 'rgba(255,217,61,0.3)', label: '⚠️ Budget is tight', color: '#ffd93d' },
    over:  { bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.3)', label: '❌ Likely over budget', color: '#ff6b6b' },
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', cursor: 'pointer',
          background: open ? 'rgba(0,212,170,0.06)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${open ? 'rgba(0,212,170,0.25)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: open ? '8px 8px 0 0' : 8,
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
          🏡 Where to stay
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '10px 12px' }}>

          {/* Type selector */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 12 }}>
            {TYPE_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccomType(key)}
                style={{
                  padding: '6px 8px', borderRadius: 7, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', textAlign: 'center',
                  border: `1px solid ${accomType === key ? '#00d4aa' : 'rgba(255,255,255,0.1)'}`,
                  background: accomType === key ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.03)',
                  color: accomType === key ? '#00d4aa' : 'rgba(255,255,255,0.5)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Cards */}
          {accommodation.length === 0 && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: 10 }}>
              Loading accommodation suggestions…
            </div>
          )}
          {cards.map((a, i) => {
            const low = toUserCurrency(a.priceRangePerNightUSD?.low || 30, currency);
            const high = toUserCurrency(a.priceRangePerNightUSD?.high || 80, currency);
            const airbnbUrl = `https://www.airbnb.com/s/${encodeURIComponent(destName)}/homes?query=${encodeURIComponent(a.searchKeyword || destName)}`;
            const bookingUrl = `https://www.booking.com/search.html?ss=${encodeURIComponent(destName + ' ' + (a.searchKeyword || ''))}`;
            return (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '9px 11px', marginBottom: 7 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{a.type}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4, lineHeight: 1.5 }}>{a.description}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#00d4aa' }}>
                    {fmt(low, currency)}–{fmt(high, currency)}/night
                  </span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>{a.whyItFits}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  <a href={airbnbUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '5px', background: 'linear-gradient(135deg,rgba(255,90,60,0.8),rgba(255,56,92,0.8))', borderRadius: 6, fontSize: 9, fontWeight: 800, color: '#fff', textDecoration: 'none', textAlign: 'center' }}>
                    Airbnb →
                  </a>
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', textAlign: 'center' }}>
                    Booking →
                  </a>
                </div>
              </div>
            );
          })}

          {/* Budget health */}
          {health && (
            <div style={{ background: statusStyle[health.status].bg, border: `1px solid ${statusStyle[health.status].border}`, borderRadius: 8, padding: '9px 11px', marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: statusStyle[health.status].color, marginBottom: 6 }}>
                {statusStyle[health.status].label}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>✈️ Flights (est.)</span><span style={{ color: 'rgba(255,255,255,0.75)' }}>{fmt(health.flights, currency)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🏡 Stays ({days} nights)</span><span style={{ color: 'rgba(255,255,255,0.75)' }}>{fmt(health.stay, currency)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>🎯 Activities + food</span><span style={{ color: 'rgba(255,255,255,0.75)' }}>{fmt(health.activities, currency)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 2 }}>
                  <span style={{ color: '#fff' }}>Estimated total</span>
                  <span style={{ color: statusStyle[health.status].color }}>{fmt(health.total, currency)}</span>
                </div>
              </div>
              {health.status !== 'ok' && health.cheaperMonths.length > 0 && (
                <div style={{ fontSize: 10, color: '#ffd93d', marginTop: 6, background: 'rgba(255,217,61,0.06)', borderRadius: 5, padding: '4px 7px', lineHeight: 1.5 }}>
                  💡 Try travelling in {health.cheaperMonths[0]} — typically 20–35% cheaper flights
                </div>
              )}
              {health.status === 'over' && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.5 }}>
                  Tip: Switching to homestay saves ~{fmt(toUserCurrency(
                    ((budgetEstimateUSD?.accommodationPerNightLow || 30) + (budgetEstimateUSD?.accommodationPerNightHigh || 80)) / 2 * 0.4 * days, currency
                  ), currency)} on accommodation
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 3: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/components/plantrip/subcomponents/AccommodationSection.jsx && git commit -m "feat: AccommodationSection — type selector, cards, budget health check"
```

---

## Task 5: Wire FlightsSection + AccommodationSection into VenueSelection

**Files:**
- Modify: `frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx`
- Modify: `frontend/src/components/plantrip/VenueSelection.jsx`

- [ ] **Step 1: Add onFullInsightsLoaded to DestinationInsightsPanel**

In `DestinationInsightsPanel.jsx`, find the function signature:
```jsx
export function DestinationInsightsPanel({
  destination, travelStyles, startDate, endDate,
  selectedActivities = [], onActivityToggle, onInsightsLoaded, onDayAssign, days = 5,
}) {
```

Add `onFullInsightsLoaded` to the destructuring:
```jsx
export function DestinationInsightsPanel({
  destination, travelStyles, startDate, endDate,
  selectedActivities = [], onActivityToggle, onInsightsLoaded, onFullInsightsLoaded, onDayAssign, days = 5,
}) {
```

Find where `onInsightsLoaded` is called (line ~46):
```js
        if (result.thingsToDo) onInsightsLoaded?.(result.thingsToDo);
```

Add the full insights callback on the next line:
```js
        if (result.thingsToDo) onInsightsLoaded?.(result.thingsToDo);
        onFullInsightsLoaded?.(result);
```

- [ ] **Step 2: Add new state + imports to VenueSelection**

In `VenueSelection.jsx`, add imports at the top (after existing imports):
```jsx
import { FlightsSection } from './subcomponents/FlightsSection';
import { AccommodationSection } from './subcomponents/AccommodationSection';
```

Add `destinationInsights` state (after existing useState declarations):
```jsx
const [destinationInsights, setDestinationInsights] = useState(null);
```

Add `currency`, `budget`, `userLocation` to the function signature:
```jsx
export function VenueSelection({ destinations, travelStyles, startDate, endDate, days = 5, onSubmit, onSkip, onBack, savedState, onSave, preferredActivities = [], currency = 'USD', budget = 0, userLocation = '' }) {
```

- [ ] **Step 3: Pass onFullInsightsLoaded to DestinationInsightsPanel**

Find the `<DestinationInsightsPanel` usage and add the new prop:
```jsx
              <DestinationInsightsPanel
                destination={destination}
                travelStyles={travelStyles}
                startDate={startDate}
                endDate={endDate}
                selectedActivities={currentActivities}
                onActivityToggle={handleActivityToggle}
                onDayAssign={handleDayAssign}
                onFullInsightsLoaded={setDestinationInsights}
                days={days}
              />
```

- [ ] **Step 4: Add FlightsSection + AccommodationSection to right panel**

In VenueSelection.jsx, find the right panel scroll div content (search for `{/* RIGHT PANEL */}`). Find the `<div className="venue-panel-right__scroll">` opening. Insert the two new sections as the FIRST children inside it, before the existing `<div className="venue-sec-row">`:

Find:
```jsx
          <div className="venue-panel-right__scroll">
            <div className="venue-sec-row">
              <div className="venue-sec-label">Explore by category</div>
```

Replace with:
```jsx
          <div className="venue-panel-right__scroll">
            {/* ── Flights + Stays ── */}
            {destination && (
              <div style={{ padding: '12px 12px 4px' }}>
                <FlightsSection
                  destination={destination}
                  origin={userLocation}
                  travelDate={startDate}
                  budgetEstimateUSD={destinationInsights?.budgetEstimateUSD || null}
                  currency={currency}
                  budget={budget}
                  onOriginChange={(val) => {/* userLocation is read-only here — handled by profile */}}
                />
                <AccommodationSection
                  destination={destination}
                  insights={destinationInsights}
                  budget={budget}
                  currency={currency}
                  days={days}
                  travelStyle={travelStyles}
                />
              </div>
            )}
            <div className="venue-sec-row">
              <div className="venue-sec-label">Explore by category</div>
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -4
```
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Verify no isMobile or aiSuggestions references remain in VenueSelection**

```bash
grep -n "isMobile\|aiSuggestions\|onInsightsLoaded={set" /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend/src/components/plantrip/VenueSelection.jsx
```
Expected: no output.

- [ ] **Step 7: Commit and push**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/components/plantrip/VenueSelection.jsx frontend/src/components/plantrip/subcomponents/DestinationInsightsPanel.jsx && git commit -m "feat: wire FlightsSection + AccommodationSection into VenueSelection right panel" && git push origin main
```

---

## Done

5 commits, full feature live. VenueSelection now shows:
- Collapsible ✈️ Flights card — origin, estimate, cheaper months tip, Google Flights + Skyscanner links
- Collapsible 🏡 Where to stay card — Hotels/Airbnbs/Homestays/Surprise me selector, 3 AI-matched options with prices, Airbnb + Booking links
- Budget health check — ✅/⚠️/❌ with breakdown and alternative month tip if over budget
