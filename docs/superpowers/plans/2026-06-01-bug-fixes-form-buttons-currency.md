# Bug Fixes: Form Button Types + Currency Auto-Select

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs in PlanTrip — all selection buttons becoming active on tap (missing `type="button"`), and currency defaulting to USD regardless of user location or preference.

**Architecture:** Two independent fixes in `PlanTrip.jsx`. Currency detection uses the existing `getUserLocationFromIP()` geolocation utility, a new `countryToCurrency` lookup table, and `localStorage` as the preference store. Button fix adds `type="button"` to every non-submit button and converts two stale-closure state updates to functional form.

**Tech Stack:** React 18, Jest, existing `frontend/src/utils/geolocation.js`, localStorage API

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/utils/countryToCurrency.js` | **Create** | Country-code → ISO currency code lookup table + `getCurrencyForCountry(code)` helper |
| `frontend/src/utils/countryToCurrency.test.js` | **Create** | Unit tests for the lookup helper |
| `frontend/src/pages/PlanTrip.jsx` | Modify | Currency priority chain on mount; `localStorage` save on selection; `type="button"` on all non-submit buttons; fix two stale-closure `setForm` calls |

---

## Task 1: countryToCurrency utility

**Files:**
- Create: `frontend/src/utils/countryToCurrency.js`
- Create: `frontend/src/utils/countryToCurrency.test.js`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/utils/countryToCurrency.test.js`:

```js
import { getCurrencyForCountry } from './countryToCurrency';

test('returns INR for India', () => {
  expect(getCurrencyForCountry('IN')).toBe('INR');
});

test('returns GBP for UK', () => {
  expect(getCurrencyForCountry('GB')).toBe('GBP');
});

test('returns AUD for Australia', () => {
  expect(getCurrencyForCountry('AU')).toBe('AUD');
});

test('returns EUR for Germany', () => {
  expect(getCurrencyForCountry('DE')).toBe('EUR');
});

test('returns EUR for France', () => {
  expect(getCurrencyForCountry('FR')).toBe('EUR');
});

test('returns SGD for Singapore', () => {
  expect(getCurrencyForCountry('SG')).toBe('SGD');
});

test('returns JPY for Japan', () => {
  expect(getCurrencyForCountry('JP')).toBe('JPY');
});

test('returns USD for unknown country code', () => {
  expect(getCurrencyForCountry('ZZ')).toBe('USD');
});

test('returns USD for US', () => {
  expect(getCurrencyForCountry('US')).toBe('USD');
});

test('returns USD for null/undefined', () => {
  expect(getCurrencyForCountry(null)).toBe('USD');
  expect(getCurrencyForCountry(undefined)).toBe('USD');
  expect(getCurrencyForCountry('')).toBe('USD');
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest countryToCurrency --no-coverage 2>&1 | tail -10
```
Expected: `Cannot find module './countryToCurrency'`

- [ ] **Step 3: Create the utility**

Create `frontend/src/utils/countryToCurrency.js`:

```js
const COUNTRY_TO_CURRENCY = {
  // South Asia
  IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', NP: 'NPR',
  // East Asia
  JP: 'JPY', CN: 'CNY', KR: 'KRW', HK: 'HKD', TW: 'TWD',
  // Southeast Asia
  SG: 'SGD', MY: 'MYR', TH: 'THB', ID: 'IDR', PH: 'PHP', VN: 'VND',
  // Middle East
  AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD',
  // Oceania
  AU: 'AUD', NZ: 'NZD',
  // Americas
  CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP',
  // UK
  GB: 'GBP',
  // Europe (EUR zone)
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', PT: 'EUR',
  BE: 'EUR', AT: 'EUR', GR: 'EUR', FI: 'EUR', IE: 'EUR', LU: 'EUR',
  // Europe (non-EUR)
  SE: 'SEK', NO: 'NOK', DK: 'DKK', CH: 'CHF', PL: 'PLN',
  CZ: 'CZK', HU: 'HUF', RO: 'RON', TR: 'TRY',
  // Africa
  ZA: 'ZAR', NG: 'NGN', KE: 'KES', EG: 'EGP', GH: 'GHS', ET: 'ETB',
  // Russia / CIS
  RU: 'RUB', UA: 'UAH',
};

/**
 * Returns the ISO 4217 currency code for a given ISO 3166-1 alpha-2 country code.
 * Falls back to 'USD' for unknown codes.
 */
export function getCurrencyForCountry(countryCode) {
  if (!countryCode) return 'USD';
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] || 'USD';
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest countryToCurrency --no-coverage 2>&1 | tail -10
```
Expected: `Tests: 10 passed, 10 total`

- [ ] **Step 5: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/utils/countryToCurrency.js frontend/src/utils/countryToCurrency.test.js && git commit -m "feat: add countryToCurrency utility with tests"
```

---

## Task 2: Currency auto-select in PlanTrip.jsx

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

- [ ] **Step 1: Add imports at the top of PlanTrip.jsx**

Find the existing imports block at the top of `frontend/src/pages/PlanTrip.jsx`. Add two imports after the existing ones:

```jsx
import { getUserLocationFromIP } from '../utils/geolocation';
import { getCurrencyForCountry } from '../utils/countryToCurrency';
```

- [ ] **Step 2: Update INITIAL_FORM to read localStorage on module load**

Find `INITIAL_FORM` (around line 53). Change the `currency` field:

```js
const INITIAL_FORM = {
  destinations: [], days: 5, budget: '',
  currency: (typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency')) || 'USD',
  travelerType: '', travelStyle: [], interests: '',
  travelDate: '', travelPace: 'balanced', wantsHotelRecs: true,
  startTime: '09:00', userMustDos: '',
  language: 'English', userAge: '', userLocation: '', email: '',
  selected_venues: {},
  day_assignments: {},
};
```

- [ ] **Step 3: Add geolocation useEffect inside the Dashboard component**

In `PlanTrip.jsx`, find the existing `useEffect` that fetches profile and recommendations (around line 134). Add a NEW separate `useEffect` AFTER it:

```jsx
// Auto-detect currency from IP if no saved preference
useEffect(() => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('wz_currency')) return;
  getUserLocationFromIP()
    .then(({ countryCode }) => {
      const detected = getCurrencyForCountry(countryCode);
      if (detected !== 'USD') {
        setForm(f => ({ ...f, currency: detected }));
      }
    })
    .catch(() => {});
}, []);
```

- [ ] **Step 4: Create a `setCurrency` helper and wire up localStorage save**

Find the `set` function definition (around line 167):
```js
const set = (key, val) => {
  setForm(f => ({ ...f, [key]: val }));
  setErrors(e => ({ ...e, [key]: '' }));
};
```

Add a `setCurrency` helper immediately after `set`:

```js
const setCurrency = (code) => {
  set('currency', code);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('wz_currency', code);
  }
};
```

- [ ] **Step 5: Wire setCurrency to the currency buttons**

Find the currency buttons in step 2 (around line 398):

```jsx
{CURRENCIES.map(c => (
  <button key={c.code} style={s.choiceBtn(form.currency === c.code)} onClick={() => set('currency', c.code)}>
    {c.label}
  </button>
))}
```

Replace `onClick={() => set('currency', c.code)}` with `onClick={() => setCurrency(c.code)}`:

```jsx
{CURRENCIES.map(c => (
  <button type="button" key={c.code} style={s.choiceBtn(form.currency === c.code)} onClick={() => setCurrency(c.code)}>
    {c.label}
  </button>
))}
```

(`type="button"` is also added here as part of the A1 fix — both bugs addressed in one edit per button group.)

- [ ] **Step 6: Verify build passes**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 7: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/PlanTrip.jsx && git commit -m "feat: currency auto-detects from IP location; saves preference to localStorage"
```

---

## Task 3: Fix Bug A1 — add type="button" to all non-submit buttons

**Files:**
- Modify: `frontend/src/pages/PlanTrip.jsx`

This task adds `type="button"` to every button in the form that does not submit the form, and fixes two stale-closure `setForm` calls.

- [ ] **Step 1: Fix days stepper buttons (step 0, around line 356)**

Find:
```jsx
<button style={s.daysBtn} onClick={() => set('days', Math.max(1, form.days - 1))}>−</button>
<div style={s.daysNum}>{form.days}</div>
<button style={s.daysBtn} onClick={() => set('days', Math.min(30, form.days + 1))}>+</button>
```

Replace with:
```jsx
<button type="button" style={s.daysBtn} onClick={() => set('days', Math.max(1, form.days - 1))}>−</button>
<div style={s.daysNum}>{form.days}</div>
<button type="button" style={s.daysBtn} onClick={() => set('days', Math.min(30, form.days + 1))}>+</button>
```

- [ ] **Step 2: Fix personalRecs quick-select buttons (step 0, around line 344)**

Find:
```jsx
<button key={i} onClick={() => handleDestinationSelect({ name: rec.destination.split(',')[0].trim(), lat: 0, lng: 0 })} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.07)', color: '#00d4aa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
  {rec.emoji} {rec.destination.split(',')[0].trim()}
</button>
```

Replace with (add `type="button"`):
```jsx
<button type="button" key={i} onClick={() => handleDestinationSelect({ name: rec.destination.split(',')[0].trim(), lat: 0, lng: 0 })} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(0,212,170,0.25)', background: 'rgba(0,212,170,0.07)', color: '#00d4aa', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
  {rec.emoji} {rec.destination.split(',')[0].trim()}
</button>
```

- [ ] **Step 3: Fix traveler type buttons (step 0, around line 372)**

Find:
```jsx
{TRAVELER_TYPES.map(t => (
  <button key={t} style={s.choiceBtn(form.travelerType === t)} onClick={() => set('travelerType', t)}>{t}</button>
))}
```

Replace with:
```jsx
{TRAVELER_TYPES.map(t => (
  <button type="button" key={t} style={s.choiceBtn(form.travelerType === t)} onClick={() => set('travelerType', t)}>{t}</button>
))}
```

- [ ] **Step 4: Fix travel style tag buttons (step 0, around line 381)**

Find:
```jsx
{TRAVEL_STYLES.map(st => (
  <button key={st} style={s.tag(form.travelStyle.includes(st))} onClick={() => toggleStyle(st)}>{st}</button>
))}
```

Replace with:
```jsx
{TRAVEL_STYLES.map(st => (
  <button type="button" key={st} style={s.tag(form.travelStyle.includes(st))} onClick={() => toggleStyle(st)}>{st}</button>
))}
```

- [ ] **Step 5: Fix pace option buttons (step 3, around line 436)**

Find:
```jsx
{PACE_OPTIONS.map(p => (
  <button key={p.val} style={{ ...s.choiceBtn(form.travelPace === p.val), padding: '0.875rem' }} onClick={() => set('travelPace', p.val)}>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
    <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 400 }}>{p.sub}</div>
  </button>
))}
```

Replace with:
```jsx
{PACE_OPTIONS.map(p => (
  <button type="button" key={p.val} style={{ ...s.choiceBtn(form.travelPace === p.val), padding: '0.875rem' }} onClick={() => set('travelPace', p.val)}>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
    <div style={{ fontSize: '0.75rem', opacity: 0.6, fontWeight: 400 }}>{p.sub}</div>
  </button>
))}
```

- [ ] **Step 6: Fix nav Back and Continue buttons (around line 550)**

Find:
```jsx
{step > 0 && (
  <button style={s.backBtnForm} onClick={back} disabled={submitting}>← Back</button>
)}
<div style={{ flex: 1 }} />
<button
  style={{
    ...s.nextBtn,
    ...(submitting ? { background: 'rgba(0,212,170,0.5)', cursor: 'not-allowed' } : {}),
    ...(step === 4 ? { minWidth: 200 } : {}),
  }}
  onClick={next}
  disabled={submitting}
>
  {step === 4 ? 'Review my trip →' : 'Continue →'}
</button>
```

Replace with:
```jsx
{step > 0 && (
  <button type="button" style={s.backBtnForm} onClick={back} disabled={submitting}>← Back</button>
)}
<div style={{ flex: 1 }} />
<button
  type="button"
  style={{
    ...s.nextBtn,
    ...(submitting ? { background: 'rgba(0,212,170,0.5)', cursor: 'not-allowed' } : {}),
    ...(step === 4 ? { minWidth: 200 } : {}),
  }}
  onClick={next}
  disabled={submitting}
>
  {step === 4 ? 'Review my trip →' : 'Continue →'}
</button>
```

- [ ] **Step 7: Fix stale-closure in handleDestinationSelect (around line 181)**

Find:
```jsx
const handleDestinationSelect = (destinations) => {
  setForm({
    ...form,
    destinations: Array.isArray(destinations) ? destinations : [destinations],
  });
};
```

Replace with (use functional update to avoid stale `form` closure):
```jsx
const handleDestinationSelect = (destinations) => {
  setForm(f => ({
    ...f,
    destinations: Array.isArray(destinations) ? destinations : [destinations],
  }));
};
```

- [ ] **Step 8: Fix stale-closure in handleVenueSelect (around line 188)**

Find:
```jsx
const handleVenueSelect = (venueData) => {
  setForm({
    ...form,
    selected_venues: venueData.venues || venueData,
    day_assignments: venueData.dayAssignments || {},
  });
  setStep(2);
};
```

Replace with:
```jsx
const handleVenueSelect = (venueData) => {
  setForm(f => ({
    ...f,
    selected_venues: venueData.venues || venueData,
    day_assignments: venueData.dayAssignments || {},
  }));
  setStep(2);
};
```

- [ ] **Step 9: Verify no remaining untyped buttons**

```bash
grep -n "<button" /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend/src/pages/PlanTrip.jsx | grep -v 'type='
```
Expected: only the ✕ Exit button in the nav (which already has `type="button"` is already set, or add it now if missing) and no others.

If any remain, add `type="button"` to them.

- [ ] **Step 10: Verify build passes**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx vite build 2>&1 | tail -5
```
Expected: `✓ built in X.XXs`

- [ ] **Step 11: Run all utils tests**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1/frontend && npx jest --testPathPattern=utils --no-coverage 2>&1 | tail -15
```
Expected: all tests pass including the new `countryToCurrency` tests.

- [ ] **Step 12: Commit**

```bash
cd /Users/gundeep/Documents/wanderzenai/wanderzenai/wanderzenaiv1 && git add frontend/src/pages/PlanTrip.jsx && git commit -m "fix: add type=button to all non-submit form buttons; fix stale-closure in handleDestinationSelect/handleVenueSelect"
```

---

## Done

Both bugs fixed across 3 commits. Manual verification:
1. Open `/plan`, tap a traveler type button — only that button highlights, others stay unselected
2. Open `/plan` in a new incognito tab with no localStorage — currency auto-selects based on your IP location
3. Select a different currency on the budget step — reload the page — your selection is remembered
