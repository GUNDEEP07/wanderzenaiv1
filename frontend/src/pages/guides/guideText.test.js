import { formatHours, modeLabel, dayRanges, dayLabel, daysSpan, routeLine, countWord } from './guideText';
import guides from '../../data/guides.json';

test('formatting helpers', () => {
  expect(formatHours(0.75)).toBe('45 min');
  expect(formatHours(2)).toBe('2 h');
  expect(formatHours(5.5)).toBe('5 h 30 min');
  expect(formatHours(0)).toBe('');
  expect(modeLabel('flight')).toBe('Flight');
  expect(modeLabel('tuk-tuk')).toBe('Tuk-tuk');
  expect(dayRanges([{ days: 2 }, { days: 1 }, { days: 3 }])).toEqual([{ from: 1, to: 2 }, { from: 3, to: 3 }, { from: 4, to: 6 }]);
  expect(dayLabel({ from: 3, to: 3 })).toBe('Day 3');
  expect(dayLabel({ from: 1, to: 2 })).toBe('Days 1–2');
  expect(daysSpan([{ days: 8 }, { days: 10 }, { days: 9 }])).toBe('8–10 days');
  expect(daysSpan([{ days: 9 }])).toBe('9 days');
  expect(routeLine([{ name: 'Hanoi' }, { name: 'Sapa' }, { name: 'Hanoi' }, { name: 'Hoi An' }])).toBe('Hanoi → Sapa → Hanoi → Hoi An');
  expect(countWord(3)).toBe('three');
});

test('guides data: every route adds up and every stop is on the map', () => {
  expect(guides.length).toBeGreaterThanOrEqual(10);
  const slugs = new Set();
  for (const g of guides) {
    expect(g.slug).toMatch(/^[a-z0-9-]+$/);
    expect(slugs.has(g.slug)).toBe(false);
    slugs.add(g.slug);
    for (const r of g.routes) {
      expect(r.stops.reduce((a, s) => a + s.days, 0)).toBe(r.days);
      for (const s of r.stops) {
        expect(Number.isFinite(s.lat) && Number.isFinite(s.lng)).toBe(true);
        expect(s.why && s.stayType).toBeTruthy();
      }
    }
  }
});

test('guides.json matches the curated routes (run `node scripts/build-guides.mjs` after editing them)', () => {
  const { execFileSync } = require('child_process');
  const path = require('path');
  expect(() => execFileSync(process.execPath, [path.resolve(__dirname, '../../../scripts/build-guides.mjs'), '--check'], { stdio: 'pipe' })).not.toThrow();
});
