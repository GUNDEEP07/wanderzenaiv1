import { toAmount, formatMoney, parseTime, todayDayNumber, dayDate, dayStops, upNext, directionsUrl, budgetRows, routeStops } from './tripPlan';
import { buildIcs, fold, escapeText } from './ics';
import { plainText } from './plainText';

const act = (time, cost = 10, extra = {}) => ({ time, activity: `Walk ${time}`, location: 'Old Town, Hội An', cost, isFree: false, why: 'Quiet [View on map](https://maps.google.com/?q=A%20(B)%2C)', ...extra });
const DAY = { dayNumber: 2, base: 'Hoi An', theme: 'Lanterns', dailyCost: 60, morningActivity: act('06:00'), afternoonActivity: act('2pm', 'A$15–20'), eveningActivity: act('Evening', 0, { isFree: true, localName: 'Chợ Đêm An Hội' }), localEats: { name: 'Thanh', dish: 'cao lầu', cost: '4' }, hiddenGem: 'Pottery lanes' };

test('amounts and money', () => {
  expect(toAmount('A$15–20')).toBe(15);
  expect(toAmount('1,200')).toBe(1200);
  expect(toAmount(-3)).toBe(0);
  expect(formatMoney(2200, 'AUD')).toBe('A$2,200');
  expect(formatMoney(0, 'AUD')).toBe('');
  expect(formatMoney(5, 'NOPE')).toBe('5 NOPE');
});

test('times', () => {
  expect(parseTime('05:30')).toBe(330);
  expect(parseTime('7:30 pm')).toBe(1170);
  expect(parseTime('12am')).toBe(0);
  expect(parseTime('Day 3 at 8am')).toBe(480);
  expect(parseTime('2 hours')).toBeNull();
  expect(parseTime('Late afternoon')).toBeNull();
});

test('trip dates and today', () => {
  expect(dayDate('2026-11-16', 3).toDateString()).toBe(new Date(2026, 10, 18).toDateString());
  expect(todayDayNumber('2026-11-16', 6, new Date(2026, 10, 18, 9))).toBe(3);
  expect(todayDayNumber('2026-11-16', 6, new Date(2026, 10, 22, 23))).toBeNull();
  expect(todayDayNumber('2026-11-16', 6, new Date(2026, 10, 15, 23))).toBeNull();
  expect(todayDayNumber(null, 6)).toBeNull();
  expect(todayDayNumber('16/11/2026', 6)).toBeNull();
});

test('stops and what is next', () => {
  const stops = dayStops(DAY);
  expect(stops.map(s => s.id)).toEqual(['morningActivity', 'afternoonActivity', 'eveningActivity', 'localEats', 'hiddenGem']);
  expect(stops[2].minutes).toBe(19 * 60); // no clock time → evening fallback
  expect(upNext(stops, new Date(2026, 10, 18, 13, 0)).id).toBe('afternoonActivity');
  expect(upNext(stops, new Date(2026, 10, 18, 13, 0), new Set(['afternoonActivity'])).id).toBe('eveningActivity');
  expect(upNext(stops, new Date(2026, 10, 18, 22, 0))).toBeNull();
});

test('directions link names the place, not just the country', () => {
  const u = new URL(directionsUrl('Old Town, Hội An', 'Hoi An', 'Vietnam'));
  expect(u.searchParams.get('destination')).toBe('Old Town, Hội An, Hoi An, Vietnam');
  expect(new URL(directionsUrl('Vietnam', '', 'vietnam')).searchParams.get('destination')).toBe('Vietnam');
});

test('budget rows and route stays', () => {
  expect(budgetRows({ days: [DAY] })).toEqual([{ dayNumber: 2, base: 'Hoi An', acts: 25, food: 4, other: 31, total: 60 }]);
  const r = routeStops({ route: { bases: [{ name: 'Da Nang', days: 1 }, { name: 'Hoi An', days: 3, transferIn: { mode: 'car', hours: 0.75 } }] }, stays: [{ base: 'hoi an', type: 'villa homestay', priceTier: 'mid' }] });
  expect(r.map(x => [x.name, x.from, x.to, x.stay?.type || null])).toEqual([['Da Nang', 1, 1, null], ['Hoi An', 2, 4, 'villa homestay']]);
});

test('plain text drops map links whose URLs contain brackets', () => {
  expect(plainText(DAY.morningActivity.why)).toBe('Quiet');
});

test('calendar file: one all-day event per day + one per activity, escaped and folded', () => {
  const ics = buildIcs({ submissionId: 'wz_x', destination: 'Vietnam', travelDate: '2026-11-16', itinerary: { title: 'Coast; Lanterns, Rivers', days: [{ ...DAY, dayNumber: 1 }] } }, new Date(Date.UTC(2026, 10, 15, 1, 2)));
  expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
  expect(ics).toContain('X-WR-CALNAME:Coast\\; Lanterns\\, Rivers');
  expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(4);
  expect(ics).toContain('DTSTART;VALUE=DATE:20261116');
  expect(ics).toContain('DTSTART:20261116T060000');
  expect(ics).toContain('DTSTART:20261116T140000');
  expect(ics).toContain('DTSTAMP:20261115T010200Z');
  expect(ics).not.toMatch(/maps\.google\.com\/\?q=A%20\(B\)/);
  const utf8Len = (s) => unescape(encodeURIComponent(s)).length;
  for (const line of ics.split('\r\n')) expect(utf8Len(line)).toBeLessThanOrEqual(75);
  expect(buildIcs({ travelDate: null, itinerary: { days: [DAY] } })).toBeNull();
});

const utf8Len = (s) => unescape(encodeURIComponent(s)).length;

test('fold and escape', () => {
  expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  const long = `DESCRIPTION:${'Hội An '.repeat(30)}`;
  expect(fold(long).split('\r\n ').join('')).toBe(long);
});
