import GUIDES from '../data/guides.json';
import { guessOrigin, rankCountries, flightHours, distanceKm, inSeason, ORIGINS, planPrefill, routeLine, ASIA } from './seasons';

beforeEach(() => { localStorage.clear(); });

test('guessOrigin: browser time zone → city, region fallback, saved choice wins', () => {
  expect(guessOrigin('Australia/Sydney').name).toBe('Sydney');
  expect(guessOrigin('Asia/Kolkata').name).toBe('Delhi');
  expect(guessOrigin('Europe/Oslo').name).toBe('Berlin');
  expect(guessOrigin('Mars/Olympus').name).toBe('Sydney');
  expect(guessOrigin('Australia/Sydney').guessed).toBe(true);
  localStorage.setItem('wz_origin', 'london');
  expect(guessOrigin('Australia/Sydney')).toMatchObject({ name: 'London', guessed: false });
});

test('flight hours: rough, half-hour steps, at least 1', () => {
  expect(flightHours(0)).toBe(1);
  const sydBali = distanceKm([-33.87, 151.21], [-8.75, 115.17]);
  expect(sydBali).toBeGreaterThan(4300);
  expect(flightHours(sydBali)).toBeGreaterThanOrEqual(5.5);
  expect(flightHours(sydBali)).toBeLessThanOrEqual(7);
});

test('every curated route carries best months, a reason and a checked photo search', () => {
  for (const g of GUIDES) {
    for (const r of g.routes) {
      expect(r.bestMonths.length).toBeGreaterThanOrEqual(3);
      expect(r.bestLabel).toBeTruthy();
      expect(r.seasonNote).toBeTruthy();
      expect(r.photoQuery).toBeTruthy();
    }
  }
});

test('rankCountries: only Asia, in-season countries first, then closest', () => {
  const sydney = ORIGINS.find(o => o.id === 'sydney');
  for (let month = 1; month <= 12; month++) {
    const ranked = rankCountries(GUIDES, { month, origin: sydney });
    expect(ranked.map(c => c.name).sort()).toEqual([...ASIA].sort());
    const firstOff = ranked.findIndex(c => c.goodRoutes === 0);
    if (firstOff >= 0) expect(ranked.slice(firstOff).every(c => c.goodRoutes === 0)).toBe(true);
    // within a country, in-season routes come first
    for (const c of ranked) {
      const flags = c.routes.map(r => inSeason(r, month));
      expect(flags).toEqual([...flags].sort((a, b) => b - a));
    }
  }
  // November from Sydney: Thailand's north is in season and closer than India
  const nov = rankCountries(GUIDES, { month: 11, origin: sydney }).map(c => c.name);
  expect(nov.indexOf('Thailand')).toBeLessThan(nov.indexOf('India'));
  // Bali is out of season in November, so Indonesia isn't first despite being closest
  expect(nov[0]).not.toBe('Indonesia');
});

test('planPrefill opens the planner on the whole country with the route suggested', () => {
  const vn = GUIDES.find(g => g.name === 'Vietnam');
  const p = planPrefill('Vietnam', vn.routes[0]);
  expect(p.destinations[0]).toMatchObject({ name: 'Vietnam', country: 'Vietnam', isCountry: true });
  expect(p.preferRouteId).toBe(vn.routes[0].id);
  expect(p.days).toBe(vn.routes[0].days);
  expect(routeLine(vn.routes[0])).toBe('Hanoi → Sapa → Hanoi → Hoi An');
});
