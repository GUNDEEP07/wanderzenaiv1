import { addDaysIso, endDateFor, daysForEnd, tripDatesText } from './tripDates';
import { formatRange } from './dateRange';

test('end date follows the number of days', () => {
  expect(endDateFor('2026-12-25', 5)).toBe('2026-12-29');
  expect(endDateFor('2026-12-30', 5)).toBe('2027-01-03');
  expect(endDateFor('', 5)).toBe('');
  expect(addDaysIso('2027-02-28', 1)).toBe('2027-03-01');
});

test('changing the end date changes the trip length (2–30 days only)', () => {
  expect(daysForEnd('2026-12-25', '2027-01-03', 5)).toBe(10);
  expect(daysForEnd('2026-12-25', '2026-12-25', 5)).toBe(5); // 1 day: too short, keep
  expect(daysForEnd('2026-12-25', '2027-03-01', 5)).toBe(5); // too long, keep
});

test('readable ranges', () => {
  expect(tripDatesText('2026-12-25', '2026-12-29')).toBe('5 days · Fri 25 Dec – Tue 29 Dec');
  expect(formatRange('2026-12-25', '2026-12-26')).toBe('25–26 Dec');
  expect(formatRange('2026-12-30', '2027-01-02')).toBe('30 Dec – 2 Jan');
  expect(formatRange('2026-12-27', '2026-12-27')).toBe('27 Dec');
});
