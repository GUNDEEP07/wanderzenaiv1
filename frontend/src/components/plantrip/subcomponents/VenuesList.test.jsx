import { render, screen, fireEvent } from '@testing-library/react';
import { VenuesList } from './VenuesList';

const VENUES = [
  { fsq_id: 'v1', name: 'Zugspitze Trail', categories: [{ name: 'Hiking' }], location: {}, stats: { total_ratings: 100 }, rating: 9.8 },
  { fsq_id: 'v2', name: 'English Garden', categories: [{ name: 'Park' }], location: {}, stats: { total_ratings: 80 }, rating: 9.2 },
];

const DEFAULT_PROPS = {
  activity: 'Hiking',
  venues: VENUES,
  selectedVenues: new Set(),
  onVenueToggle: jest.fn(),
  onDayAssign: jest.fn(),
  loading: false,
  destination: { name: 'Munich' },
  days: 5,
  startDate: '2026-05-31',
};

beforeEach(() => jest.clearAllMocks());

test('renders venues in the grid', () => {
  render(<VenuesList {...DEFAULT_PROPS} />);
  expect(screen.getByText('Zugspitze Trail')).toBeInTheDocument();
  expect(screen.getByText('English Garden')).toBeInTheDocument();
});

test('clicking + opens the day list', () => {
  render(<VenuesList {...DEFAULT_PROPS} />);
  const addBtns = screen.getAllByText('+');
  fireEvent.click(addBtns[0]);
  expect(screen.getByText('Day 1')).toBeInTheDocument();
});

test('selecting a day calls onVenueToggle and onDayAssign', () => {
  const onVenueToggle = jest.fn();
  const onDayAssign = jest.fn();
  render(<VenuesList {...DEFAULT_PROPS} onVenueToggle={onVenueToggle} onDayAssign={onDayAssign} />);
  fireEvent.click(screen.getAllByText('+')[0]);
  fireEvent.click(screen.getByText('Day 2').closest('button'));
  expect(onVenueToggle).toHaveBeenCalledWith('v1');
  expect(onDayAssign).toHaveBeenCalledWith('v1', 'Day 2');
});

test('shows loading state', () => {
  render(<VenuesList {...DEFAULT_PROPS} loading={true} venues={[]} />);
  expect(screen.getByRole('status')).toHaveTextContent(/Finding places/i);
});

test('shows empty state when no venues', () => {
  render(<VenuesList {...DEFAULT_PROPS} venues={[]} />);
  expect(screen.getByText(/No hiking places found near Munich/i)).toBeInTheDocument();
});

// Venues from utils/foursquare.js carry `id` (not fsq_id). Before Nov 2026 every card used
// venue.fsq_id (undefined), so all cards toggled together and no pick reached the itinerary.
test('venues with `id` are picked one at a time, with a map link', () => {
  const onVenueToggle = jest.fn();
  const onDayAssign = jest.fn();
  const venues = [{ id: 'a1', name: 'Bé Mặn', category: 'Seafood', address: 'Võ Nguyên Giáp, Đà Nẵng' }, { id: 'a2', name: 'Bánh Mì Bà Lan', category: 'Bakery' }];
  render(<VenuesList {...DEFAULT_PROPS} venues={venues} onVenueToggle={onVenueToggle} onDayAssign={onDayAssign} days={2} firstDay={1} />);
  fireEvent.click(screen.getByRole('button', { name: 'Add Bé Mặn to a day' }));
  expect(screen.getAllByText('Day 1')).toHaveLength(1);
  const map = screen.getByText('View on Google Maps').closest('a');
  expect(new URL(map.href).searchParams.get('query')).toBe('Bé Mặn, Võ Nguyên Giáp, Đà Nẵng');
  fireEvent.click(screen.getByText('Day 2').closest('button'));
  expect(onVenueToggle).toHaveBeenCalledWith('a1');
  expect(onDayAssign).toHaveBeenCalledWith('a1', 'Day 2');
});

test('an added venue can be removed', () => {
  const onVenueToggle = jest.fn();
  const onDayAssign = jest.fn();
  render(<VenuesList {...DEFAULT_PROPS} venues={[{ id: 'a1', name: 'Bé Mặn' }]} selectedVenues={new Set(['a1'])} onVenueToggle={onVenueToggle} onDayAssign={onDayAssign} />);
  fireEvent.click(screen.getByText('Remove'));
  expect(onVenueToggle).toHaveBeenCalledWith('a1');
  expect(onDayAssign).toHaveBeenCalledWith('a1', undefined);
});
