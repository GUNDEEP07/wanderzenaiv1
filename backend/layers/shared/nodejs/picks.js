'use strict';

/**
 * "Picked for you" (dashboard + Explore), Nov 16 2026: chosen from the hand-curated routes in
 * LIVE regions only (curated-routes.js REGIONS — Asia today), never free-form AI suggestions.
 * Before this, Claude named any place on earth (Ljubljana, Patagonia) and the answer was cached
 * for a week. Now:
 *   one route per country, the best for this month; then, in order:
 *   1. in season THIS month and in a country they haven't planned yet
 *   2. in season, in a country they have planned (another region of it — better than off season)
 *   3. off season (labelled with its best months) — only when nothing else is left
 *   families get kid-friendly routes first; a stable shuffle per user per week breaks ties, so
 *   the picks change weekly but don't flicker.
 * No API calls, no cost, no rate limit needed.
 */

const curated = require('./curated-routes');

const FLAGS = {
  Vietnam: '🇻🇳', Japan: '🇯🇵', India: '🇮🇳', Thailand: '🇹🇭', 'Sri Lanka': '🇱🇰', Indonesia: '🇮🇩', Nepal: '🇳🇵',
  Italy: '🇮🇹', Portugal: '🇵🇹', 'New Zealand': '🇳🇿',
};

/** Small deterministic hash → [0, 1) for the weekly shuffle. */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** Which curated countries a list of past destinations ("Kyoto", "Hoi An, Vietnam") covers. */
function visitedCountries(pastDestinations = [], countries = Object.values(curated.COUNTRIES)) {
  const text = pastDestinations.map(d => String(d || '').toLowerCase());
  const out = new Set();
  for (const c of countries) {
    const names = [c.name, ...c.routes.flatMap(r => r.bases.map(b => b.name))].map(n => n.toLowerCase());
    if (text.some(t => names.some(n => n.length > 2 && t.includes(n)))) out.add(c.name);
  }
  return out;
}

/**
 * @param {{ pastDestinations?: string[], travelerTypes?: string[], month?: number, seed?: string,
 *           liveCountries?: string[], count?: number }} args
 * @returns {Array<{ destination, country, routeId, routeName, days, photoQuery, bestLabel, inSeason, reason, emoji }>}
 */
function pickForUser({
  pastDestinations = [], travelerTypes = [], month = new Date().getUTCMonth() + 1, seed = '',
  liveCountries = curated.LIVE_COUNTRIES, count = 3,
} = {}) {
  const live = Object.values(curated.COUNTRIES).filter(c => liveCountries.includes(c.name));
  const visited = visitedCountries(pastDestinations, live);
  const pool = live;
  const family = travelerTypes.some(t => /family|kid|child/i.test(String(t)));

  const picks = pool.map(c => {
    const routes = [...c.routes].sort((a, b) =>
      (curated.inSeason(b, month) - curated.inSeason(a, month))
      || (family ? (b.kidFriendly ? 1 : 0) - (a.kidFriendly ? 1 : 0) : 0)
      || (seeded(`${seed}:${a.id}`) - seeded(`${seed}:${b.id}`)));
    const r = routes[0];
    const good = curated.inSeason(r, month) === true;
    const towns = [...new Set(r.bases.map(b => b.name))];
    return {
      country: c.name,
      route: r,
      good,
      kidOk: !!r.kidFriendly,
      fresh: !visited.has(c.name),
      rank: seeded(`${seed}:${c.name}`),
      destination: `${towns.slice(0, 3).join(' → ')}, ${c.name}`,
    };
  });

  picks.sort((a, b) => (b.good - a.good) || (b.fresh - a.fresh) || (family ? b.kidOk - a.kidOk : 0) || (a.rank - b.rank));

  return picks.slice(0, count).map(p => {
    const best = curated.monthRanges(p.route.seasons.best);
    const when = p.good ? `Good in ${curated.MONTH_NAMES[month - 1]}` : `Best ${best}`;
    return {
      destination: p.destination,
      country: p.country,
      routeId: p.route.id,
      routeName: p.route.name,
      days: Math.max(1, Math.round(p.route.bases.reduce((a, b) => a + b.weight, 0))),
      photoQuery: p.route.photoQuery,
      bestLabel: best,
      inSeason: p.good,
      reason: `${when}: ${p.route.name.charAt(0).toLowerCase()}${p.route.name.slice(1)}${family && p.kidOk ? ', easy with kids' : ''}. ${p.route.seasons.note}.`,
      emoji: FLAGS[p.country] || '',
    };
  });
}

module.exports = { pickForUser, visitedCountries, seeded };
