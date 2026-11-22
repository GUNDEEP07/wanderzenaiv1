import { render, screen, fireEvent, within } from '@testing-library/react';
import StepStays, { stayPlan, stayLinks, flightsUrl } from './StepStays';
import { fetchDestinationInsights } from '../../api/destinationInsights';
import { _clearStopInsights } from '../../api/stopInsights';

jest.mock('../../api/destinationInsights', () => ({ fetchDestinationInsights: jest.fn() }));

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

describe('estimated cost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _clearStopInsights();
    fetchDestinationInsights.mockImplementation(async (dest, styles, start, end, opts) => ({
      thingsToDo: [],
      estimates: dest.startsWith('Da Nang')
        ? { currency: 'AUD', stays: [{ style: 'homestay', label: 'Beach guesthouse', low: 60, high: 90 }, { style: 'boutique', label: 'Boutique hotel', low: 150, high: 210 }], flights: opts.from ? { cheapest: { low: 700, high: 900 }, direct: null, note: 'via Singapore' } : null }
        : { currency: 'AUD', stays: [{ style: 'homestay', label: 'Garden homestay', low: 50, high: 70 }], flights: null },
    }));
  });

  const renderIt = (props = {}) => render(<StepStays stops={STOPS} startDate="2026-12-25" endDate="2026-12-29" days={5} adults={2}
    origin="Sydney" onOrigin={jest.fn()} alreadyBooked={false} onAlreadyBooked={jest.fn()}
    currency="AUD" budget="3000" budgetScope="full-trip" onStayChoice={jest.fn()} onFlightChoice={jest.fn()} {...props} />);

  test('asks once per stop, home city only with the first stop, and adds flights + stays', async () => {
    renderIt();
    const total = await screen.findByRole('region', { name: 'Estimated trip cost' });
    await within(total).findByText(/Flights · 2 ×/);
    expect(fetchDestinationInsights).toHaveBeenCalledTimes(2);
    const calls = fetchDestinationInsights.mock.calls.map((c) => [c[0], c[4].from]);
    expect(calls).toEqual([['Da Nang, Vietnam', 'Sydney'], ['Hoi An, Vietnam', '']]);
    // flights 2 × 800 = 1600; Da Nang 2 nights × 75 = 150; Hoi An 2 nights × 60 = 120 → 1870
    expect(within(total).getByText('~A$1,870 AUD')).toBeInTheDocument();
    expect(within(total).getByText(/Leaves ~A\$1,130 of your A\$3,000 budget/)).toBeInTheDocument();
    expect(within(total).getByText(/not live prices/)).toBeInTheDocument();
    expect(screen.queryByText('Direct only')).toBeNull(); // no direct flights offered
  });

  test('picking a stay style reports it (the planner puts it on the route)', async () => {
    const onStayChoice = jest.fn();
    renderIt({ onStayChoice });
    const dn = screen.getByRole('region', { name: 'Stay in Da Nang' });
    fireEvent.click(await within(dn).findByRole('radio', { name: /Boutique hotel/ }));
    expect(onStayChoice).toHaveBeenCalledWith('Da Nang, Vietnam', expect.objectContaining({ style: 'boutique', label: 'Boutique hotel' }));
  });

  test('chosen style changes the total; over budget says so', async () => {
    renderIt({ stayChoices: { 'Da Nang, Vietnam': 'boutique' }, budget: '1500' });
    const total = await screen.findByRole('region', { name: 'Estimated trip cost' });
    await within(total).findByText(/Flights/);
    expect(within(total).getByText(/over your A\$1,500 budget/)).toBeInTheDocument();
  });
});
