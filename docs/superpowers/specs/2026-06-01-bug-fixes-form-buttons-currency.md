# Bug Fixes: Form Button Selection + Currency Auto-Select

**Date:** 2026-06-01
**Status:** Approved, ready for implementation
**Scope:** PlanTrip.jsx form buttons + currency default logic

---

## Bug A1: All options selected when one tapped

### Root cause

Every `<button>` inside the PlanTrip `<form>` element that lacks an explicit `type="button"` attribute defaults to `type="submit"` per the HTML spec. On some browsers (especially mobile Safari and Chrome Android), clicking these buttons fires a form submission event in addition to the `onClick` handler. This causes React to re-render with stale or reset state, making all buttons briefly appear selected.

### Fix

Add `type="button"` to every non-submit button inside the PlanTrip form:
- Currency grid buttons
- Traveler type buttons
- Travel style tag buttons
- Pace option buttons
- Days stepper (`+` / `−`) buttons
- Language option buttons (if rendered as buttons)

The submit button (Continue →) at the bottom of each step already uses `type="submit"` implicitly or explicitly and must NOT be changed.

### Files
- `frontend/src/pages/PlanTrip.jsx`

---

## Bug A2: Currency not auto-selected from user location

### Current behaviour

`INITIAL_FORM` hardcodes `currency: 'USD'`. All users see USD selected by default regardless of location or prior preference.

### Desired behaviour

Priority chain (highest to lowest):

1. **Saved preference** — `localStorage.getItem('wz_currency')` — written when user changes the currency selection in step 2
2. **IP geolocation** — call existing `getUserLocationFromIP()` (already used by VenueSelection), map returned `countryCode` to currency via lookup table
3. **Default** — `'USD'`

### Currency lookup table

New file `frontend/src/utils/countryToCurrency.js` — minimal lookup covering ~35 countries that represent 95%+ of likely users:

```
IN → INR    GB → GBP    AU → AUD    CA → CAD
SG → SGD    JP → JPY    AE → AED    NZ → NZD
HK → HKD    CN → CNY    MX → MXN    BR → BRL
ZA → ZAR    KR → KRW    TH → THB    ID → IDR
MY → MYR    PH → PHP    PK → PKR    BD → BDT
NG → NGN    KE → KES    EG → EGP    GH → GHS
DE → EUR    FR → EUR    IT → EUR    ES → EUR
NL → EUR    PT → EUR    BE → EUR    AT → EUR
SE → SEK    NO → NOK    DK → DKK    CH → CHF
PL → PLN    CZ → CZK    TR → TRY
* → USD  (default)
```

The lookup is a plain JS object export: `{ IN: 'INR', GB: 'GBP', ... }`.

### localStorage key

`'wz_currency'` — set via `localStorage.setItem('wz_currency', code)` whenever user changes currency in the form. Read once on component mount as part of the priority chain.

### Implementation in PlanTrip.jsx

1. Import `countryToCurrency` from `'../utils/countryToCurrency'`
2. Import `getUserLocationFromIP` from `'../utils/geolocation'`
3. Replace hardcoded `currency: 'USD'` in `INITIAL_FORM` with `currency: localStorage.getItem('wz_currency') || 'USD'` — this handles case 1 synchronously on mount
4. Add a `useEffect` that runs once on mount (no dependencies): call `getUserLocationFromIP()`, map `countryCode` via lookup, and if `localStorage` key is absent and detected currency differs from current form value, update `form.currency`
5. In the currency `set('currency', c.code)` `onClick`, also call `localStorage.setItem('wz_currency', c.code)`

### Files
- `frontend/src/pages/PlanTrip.jsx`
- `frontend/src/utils/countryToCurrency.js` *(new)*

---

## Out of scope

- Saving currency to the backend user profile (can be added in a future sprint once profile schema is extended)
- Currency auto-conversion of previously entered budget amounts
- Any changes to VenueSelection, Dashboard, or Landing
