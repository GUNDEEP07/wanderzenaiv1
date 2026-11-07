import { CURATED_COUNTRIES, DEFAULT_TRIP_PREFS } from '../components/plantrip/WhoIsTravelling';

/**
 * Chat → planner handoff (Nov 7 2026).
 *
 * The chat used to open the planner at Step 2, skipping the country and "Who's travelling?"
 * questions, so kids mentioned in chat were lost and routes were planned for two adults.
 * Now it opens Step 1 with everything the chat learned filled in, for a quick check.
 */

const BUDGET_BY_LEVEL = { Budget: '1500', 'Mid-range': '3000', Luxury: '6000' };
const ADULTS_BY_TYPE = { Solo: 1, Couple: 2, Family: 2, 'Group of friends': 4 };

const clampInt = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};

/** @param {object} trip the chat's READY data */
export function chatTripToPrefill(trip = {}) {
  const place = String(trip.destination || '').split(',')[0].trim();
  const country = CURATED_COUNTRIES.find(c => c.name.toLowerCase() === place.toLowerCase());
  const destinations = country
    ? [{ name: country.name, country: country.name, lat: country.lat, lng: country.lng, isCountry: true }]
    : (place ? [{ name: place, lat: 0, lng: 0 }] : []);

  const kids = (Array.isArray(trip.kids) ? trip.kids : [])
    .map(a => clampInt(a, 0, 17)).filter(a => a !== null).slice(0, 8);
  const adults = clampInt(trip.adults, 1, 12) ?? ADULTS_BY_TYPE[trip.travelerType] ?? 2;
  const styles = Array.isArray(trip.travelStyle) ? trip.travelStyle.filter(s => typeof s === 'string') : [];

  return {
    destinations,
    days: clampInt(trip.days, 2, 30) ?? 5,
    travelDate: typeof trip.travelDate === 'string' ? trip.travelDate : '',
    travelerType: trip.travelerType || (kids.length ? 'Family' : ''),
    travelStyle: styles,
    // Step 1 requires interests; the chat's vibes are a fine start (editable there).
    interests: styles.join(', '),
    budget: BUDGET_BY_LEVEL[trip.budget] || '3000',
    tripPrefs: { ...DEFAULT_TRIP_PREFS, adults, kids, overnightOk: false },
  };
}
