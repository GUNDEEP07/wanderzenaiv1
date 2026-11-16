import { render, screen, fireEvent } from '@testing-library/react';
import BookingChecklist from './BookingChecklist';
import { bookingUrl, toursUrl, hasPartnerIds } from '../../utils/partnerLinks';

const itinerary = {
  route: { bases: [
    { name: 'Hanoi', country: 'Vietnam', days: 2 },
    { name: 'Sapa', country: 'Vietnam', days: 3 },
    { name: 'Hanoi', country: 'Vietnam', days: 1 },
    { name: 'Hoi An', country: 'Vietnam', days: 3 },
  ] },
  stays: [{ base: 'Sapa', type: 'family homestay in Ta Van' }],
  days: [],
};

beforeEach(() => localStorage.clear());

test('partner links: same search, tagged only with an id', () => {
  const plain = new URL(bookingUrl({ place: 'Sapa, Vietnam', checkin: '2026-12-03', checkout: '2026-12-06', adults: 2 }, ''));
  expect(plain.searchParams.get('ss')).toBe('Sapa, Vietnam');
  expect(plain.searchParams.get('checkin')).toBe('2026-12-03');
  expect(plain.searchParams.has('aid')).toBe(false);
  expect(new URL(bookingUrl({ place: 'Sapa' }, '123')).searchParams.get('aid')).toBe('123');
  expect(new URL(toursUrl({ place: 'Hoi An' }, 'GYG1')).searchParams.get('partner_id')).toBe('GYG1');
  expect(hasPartnerIds({ BOOKING_AID: '', GYG_PARTNER_ID: '' })).toBe(false);
  expect(hasPartnerIds({ BOOKING_AID: '1', GYG_PARTNER_ID: '' })).toBe(true);
});

test('checklist: one row per stay in route order, nights and dates, ticks remembered', () => {
  const { unmount } = render(<BookingChecklist tripId="t1" itinerary={itinerary} travelDate="2026-12-01" />);
  const rows = screen.getAllByRole('checkbox');
  expect(rows).toHaveLength(5); // Hanoi, Sapa, Hanoi, Hoi An, flights
  expect(screen.getByText('Sapa').parentElement).toHaveTextContent('3 nights');
  expect(screen.getByText(/Suggested: family homestay in Ta Van/)).toBeInTheDocument();
  expect(screen.getByText(/2026-12-03 → 2026-12-06/)).toBeInTheDocument();
  // last base: no night on the final day
  expect(screen.getAllByText('Hoi An')[0].parentElement).toHaveTextContent('2 nights');
  // no commission claimed without partner ids
  expect(screen.getByText(/We don’t earn anything from them/)).toBeInTheDocument();
  fireEvent.click(rows[1]);
  unmount();
  render(<BookingChecklist tripId="t1" itinerary={itinerary} travelDate="2026-12-01" />);
  expect(screen.getAllByRole('checkbox')[1]).toBeChecked();
  const stayLinks = screen.getAllByRole('link', { name: 'Stays' });
  expect(stayLinks[0].getAttribute('rel')).toMatch(/sponsored/);
});
