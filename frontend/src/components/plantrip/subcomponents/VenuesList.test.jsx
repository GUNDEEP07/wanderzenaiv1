import { render, screen, fireEvent } from '@testing-library/react';
import { VenuesList } from './VenuesList';

const mockVenues = [
  { id: 'v1', name: 'Mountain Peak Trail', category: 'Hiking', rating: 4.8 },
  { id: 'v2', name: 'Waterfall Hike', category: 'Hiking', rating: 4.9 },
];

test('VenuesList renders venues with details', () => {
  render(
    <VenuesList
      activity="Hiking"
      venues={mockVenues}
      selectedVenues={new Set()}
      onVenueToggle={() => {}}
      loading={false}
    />
  );
  expect(screen.getByText('Mountain Peak Trail')).toBeInTheDocument();
  expect(screen.getByText('Waterfall Hike')).toBeInTheDocument();
  expect(screen.getByText(/Hiking Venues/)).toBeInTheDocument();
});

test('VenuesList shows loading state', () => {
  render(
    <VenuesList
      activity="Hiking"
      venues={[]}
      selectedVenues={new Set()}
      onVenueToggle={() => {}}
      loading={true}
    />
  );
  expect(screen.getByText('Loading venues...')).toBeInTheDocument();
});

test('VenuesList shows empty state', () => {
  render(
    <VenuesList
      activity="Hiking"
      venues={[]}
      selectedVenues={new Set()}
      onVenueToggle={() => {}}
      loading={false}
    />
  );
  expect(screen.getByText(/No venues found/)).toBeInTheDocument();
});

test('VenuesList calls onVenueToggle on checkbox change', () => {
  const mockToggle = jest.fn();
  render(
    <VenuesList
      activity="Hiking"
      venues={mockVenues}
      selectedVenues={new Set()}
      onVenueToggle={mockToggle}
      loading={false}
    />
  );
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[0]);
  expect(mockToggle).toHaveBeenCalledWith('v1');
});
