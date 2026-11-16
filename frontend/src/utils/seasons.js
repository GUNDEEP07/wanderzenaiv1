/**
 * Seasons and "where are you planning from" for the home page and Explore (Nov 2026,
 * designs A + B). Everything runs in the browser from data that ships with the site:
 *
 * - Best months per route come from the hand-curated routes (curated-routes.js →
 *   src/data/guides.json, `bestMonths`, 1 = Jan). They are reviewed with the routes.
 * - The month is TODAY's, read when the page renders, so the order changes by itself every
 *   month — nothing to re-generate. (Deploys and the monthly prerender refresh the saved copy.)
 * - The visitor's city is a guess from their browser's time zone: no permission prompt,
 *   no network call, nothing sent or stored server-side. They can change it; the choice is
 *   kept in this browser only.
 * - Flight times are rough (great-circle distance ÷ 800 km/h + 30 min), for ordering only.
 */

import { CURATED_COUNTRIES } from '../components/plantrip/WhoIsTravelling';
import REGIONS from '../data/regions.json';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Regions come from the curated data (curated-routes.js REGIONS → src/data/regions.json).
 * Only `live` regions are promoted; switching one on there needs no change here.
 */
export const LIVE_REGIONS = REGIONS.filter(r => r.live);
export const LIVE_COUNTRIES = LIVE_REGIONS.flatMap(r => r.countries);
/** "Asia", "Asia and Europe", "Asia, Europe and Oceania" */
export const liveRegionLabel = (regions = LIVE_REGIONS) => {
  const n = regions.map(r => r.name);
  return n.length <= 1 ? (n[0] || '') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
};

/** Where travellers usually fly into, per curated country — for the distance estimate. */
export const ARRIVAL_HUB = {
  Vietnam: [21.03, 105.85], Japan: [35.68, 139.69], India: [19.08, 72.88], Thailand: [13.75, 100.5],
  'Sri Lanka': [7.18, 79.88], Indonesia: [-8.75, 115.17], Nepal: [27.7, 85.32],
  Italy: [41.9, 12.5], Portugal: [38.72, -9.14], 'New Zealand': [-36.85, 174.76],
};

/** Cities a visitor can pick, and what each browser time zone maps to. */
export const ORIGINS = [
  { id: 'sydney', name: 'Sydney', lat: -33.87, lng: 151.21 },
  { id: 'melbourne', name: 'Melbourne', lat: -37.81, lng: 144.96 },
  { id: 'brisbane', name: 'Brisbane', lat: -27.47, lng: 153.03 },
  { id: 'adelaide', name: 'Adelaide', lat: -34.93, lng: 138.6 },
  { id: 'perth', name: 'Perth', lat: -31.95, lng: 115.86 },
  { id: 'auckland', name: 'Auckland', lat: -36.85, lng: 174.76 },
  { id: 'singapore', name: 'Singapore', lat: 1.35, lng: 103.82 },
  { id: 'hong-kong', name: 'Hong Kong', lat: 22.32, lng: 114.17 },
  { id: 'tokyo', name: 'Tokyo', lat: 35.68, lng: 139.69 },
  { id: 'delhi', name: 'Delhi', lat: 28.61, lng: 77.21 },
  { id: 'dubai', name: 'Dubai', lat: 25.2, lng: 55.27 },
  { id: 'london', name: 'London', lat: 51.51, lng: -0.13 },
  { id: 'berlin', name: 'Berlin', lat: 52.52, lng: 13.4 },
  { id: 'new-york', name: 'New York', lat: 40.71, lng: -74.01 },
  { id: 'los-angeles', name: 'Los Angeles', lat: 34.05, lng: -118.24 },
];

const TZ_TO_ORIGIN = {
  'Australia/Sydney': 'sydney', 'Australia/Canberra': 'sydney', 'Australia/Hobart': 'melbourne',
  'Australia/Melbourne': 'melbourne', 'Australia/Brisbane': 'brisbane', 'Australia/Lindeman': 'brisbane',
  'Australia/Adelaide': 'adelaide', 'Australia/Darwin': 'adelaide', 'Australia/Perth': 'perth',
  'Pacific/Auckland': 'auckland', 'Asia/Singapore': 'singapore', 'Asia/Kuala_Lumpur': 'singapore',
  'Asia/Jakarta': 'singapore', 'Asia/Bangkok': 'singapore', 'Asia/Ho_Chi_Minh': 'singapore', 'Asia/Manila': 'hong-kong',
  'Asia/Hong_Kong': 'hong-kong', 'Asia/Shanghai': 'hong-kong', 'Asia/Taipei': 'hong-kong',
  'Asia/Tokyo': 'tokyo', 'Asia/Seoul': 'tokyo', 'Asia/Kolkata': 'delhi', 'Asia/Calcutta': 'delhi',
  'Asia/Kathmandu': 'delhi', 'Asia/Colombo': 'delhi', 'Asia/Dubai': 'dubai', 'Asia/Riyadh': 'dubai', 'Asia/Qatar': 'dubai',
  'Europe/London': 'london', 'Europe/Dublin': 'london', 'Europe/Lisbon': 'london',
  'America/New_York': 'new-york', 'America/Toronto': 'new-york', 'America/Chicago': 'new-york',
  'America/Los_Angeles': 'los-angeles', 'America/Vancouver': 'los-angeles', 'America/Denver': 'los-angeles',
};
const REGION_FALLBACK = { Australia: 'sydney', Pacific: 'auckland', Asia: 'singapore', Europe: 'berlin', America: 'new-york', Africa: 'dubai' };
const STORE_KEY = 'wz_origin';

/** The visitor's likely city from the browser time zone (or their saved choice). */
export function guessOrigin(timeZone) {
  let saved = null;
  try { saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null; } catch { /* private mode */ }
  const fromSaved = ORIGINS.find(o => o.id === saved);
  if (fromSaved) return { ...fromSaved, guessed: false };
  let tz = timeZone;
  if (!tz) { try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { tz = ''; } }
  const id = TZ_TO_ORIGIN[tz] || REGION_FALLBACK[String(tz).split('/')[0]] || 'sydney';
  return { ...ORIGINS.find(o => o.id === id), guessed: true };
}

export function saveOrigin(id) {
  try { localStorage.setItem(STORE_KEY, id); } catch { /* private mode: fine */ }
}

export function distanceKm([lat1, lng1], [lat2, lng2]) {
  const r = Math.PI / 180;
  const h = Math.sin(((lat2 - lat1) * r) / 2) ** 2
    + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Rough flying time in hours, rounded to the half hour, at least 1. */
export const flightHours = (km) => Math.max(1, Math.round((km / 800 + 0.5) * 2) / 2);

/** The current month, 1–12. */
export const currentMonth = (date = new Date()) => date.getMonth() + 1;

export const inSeason = (route, month) => (route.bestMonths || []).includes(month);

/**
 * Curated countries for this visitor and month: in season first (more good routes first),
 * then the shortest flight. Each carries its routes ordered in-season first.
 * @param {object[]} guides  src/data/guides.json
 */
export function rankCountries(guides, { month, origin, only = LIVE_COUNTRIES }) {
  const here = [origin.lat, origin.lng];
  return guides
    .filter(g => !only || only.includes(g.name))
    .map(g => {
      const routes = [...g.routes].sort((a, b) => inSeason(b, month) - inSeason(a, month));
      const good = routes.filter(r => inSeason(r, month)).length;
      // A new country needs no hub entry: its first route's first stop is close enough.
      const first = g.routes[0]?.stops?.[0];
      const hub = ARRIVAL_HUB[g.name] || (first ? [first.lat, first.lng] : null);
      return { ...g, routes, goodRoutes: good, hours: hub ? flightHours(distanceKm(here, hub)) : null };
    })
    .sort((a, b) => (Math.min(b.goodRoutes, 1) - Math.min(a.goodRoutes, 1)) || ((a.hours ?? 99) - (b.hours ?? 99)));
}

/** "Mar–May, Oct–Nov" as built by build-guides (bestLabel); falls back to a list. */
export const bestLabel = (route) => route.bestLabel || (route.bestMonths || []).map(m => MONTHS[m - 1]).join(', ');

/** The order a route's stops are visited, without the repeat (Hanoi → Sapa → Hanoi → Hoi An). */
export const routeLine = (route) => route.stops.map(s => s.name).filter((n, i, a) => a[i - 1] !== n).join(' → ');

/** What the planner needs to open on this country with this route suggested first. */
export function planPrefill(country, route) {
  // Same pick as the country chips in Step 1, so the planner treats it as a whole-country trip.
  const c = CURATED_COUNTRIES.find(x => x.name === country) || { lat: 0, lng: 0 };
  return {
    destinations: [{ name: country, country, lat: c.lat, lng: c.lng, isCountry: true }],
    days: route?.days || 7,
    preferRouteId: route?.id || null,
  };
}
