import { render, screen, fireEvent } from '@testing-library/react';
import StepStays, { stayPlan, stayLinks, flightsUrl } from './StepStays';

const STOPS = [
  { name: 'Da Nang', country: 'Vietnam', fromDay: 1, toDay: 2, stayType: 'beachside guesthouse on My Khe' },
  { name: 'Hoi An', country: 'Vietnam', fromDay: 3, toDay: 5, stayType: 'garden homestay' },
];

test('nights per stop follow the route (no night on the last day)', () => {
  const plan = stayPlan(STOPS, '2026-12-25', 5);
  expect(plan.map(p => [p.name, p.nights, p.checkin, p.checkout])).toEqual([
    ['Da Nang', 2, '2026-12-25', '2026-12-27'],
    ['Hoi An', 2, '2026-12-27', '2026-12-29'],
  ]);
  expect(stayPlan(STOPS, '', 5)[0].checkin).toBe('');
});

test('booking links carry the town, dates and group', () => {
  const [dn] = stayPlan(STOPS, '2026-12-25', 5);
  const { airbnb, booking } = stayLinks(dn, 2);
  const a = new URL(airbnb), b = new URL(booking);
  expect(decodeURIComponent(a.pathname)).toBe('/s/Da Nang, Vietnam/homes');
  expect(a.searchParams.get('checkin')).toBe('2026-12-25');
  expect(a.searchParams.get('checkout')).toBe('2026-12-27');
  expect(b.searchParams.get('ss')).toBe('Da Nang, Vietnam');
  expect(b.searchParams.get('group_adults')).toBe('2');
});

test('flights: from home into the first stop, back from the last; never a made-up origin', () => {
  const q = (u) => new URL(u).searchParams.get('q');
  expect(q(flightsUrl({ from: 'Sydney', firstStop: STOPS[0], lastStop: STOPS[1], startDate: '2026-12-25', endDate: '2026-12-29' })))
    .toBe('flights from Sydney to Da Nang, Vietnam on 2026-12-25 returning from Hoi An, Vietnam on 2026-12-29');
  expect(q(flightsUrl({ from: '', firstStop: STOPS[0], lastStop: STOPS[0] }))).toBe('flights to Da Nang, Vietnam return');
});

test('"already booked" hides the suggestions', () => {
  const onAlreadyBooked = jest.fn();
  const { rerender } = render(<StepStays stops={STOPS} startDate="2026-12-25" days={5} onOrigin={jest.fn()} onAlreadyBooked={onAlreadyBooked} />);
  expect(screen.getByRole('region', { name: 'Stay in Hoi An' })).toHaveTextContent('2 nights · 27–29 Dec');
  fireEvent.click(screen.getByLabelText("I've already booked flights and stays"));
  expect(onAlreadyBooked).toHaveBeenCalledWith(true);
  rerender(<StepStays stops={STOPS} startDate="2026-12-25" days={5} alreadyBooked onOrigin={jest.fn()} onAlreadyBooked={onAlreadyBooked} />);
  expect(screen.queryByRole('region', { name: 'Stay in Hoi An' })).toBeNull();
});
