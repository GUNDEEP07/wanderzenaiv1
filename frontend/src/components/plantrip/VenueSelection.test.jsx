import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VenueSelection } from './VenueSelection';
import * as geolocation from '../../utils/geolocation';
import * as foursquare from '../../utils/foursquare';
import * as youtube from '../../utils/youtube';

jest.mock('../../utils/geolocation');
jest.mock('../../utils/foursquare');
jest.mock('../../utils/youtube');
jest.mock('./subcomponents/DestinationInsightsPanel', () => ({
  DestinationInsightsPanel: ({ onInsightsLoaded, onActivityToggle, selectedActivities }) => (
    <div data-testid="insights-panel">
      <button
        data-testid="ai-suggestion-btn"
        onClick={() => onActivityToggle('Alps Hiking')}
      >
        AI: Alps Hiking {selectedActivities.includes('Alps Hiking') ? '(selected)' : ''}
      </button>
      <button data-testid="load-suggestions" onClick={() =>
        onInsightsLoaded([{ name: 'Alps Hiking', emoji: '🥾', reason: 'Great trails' }])
      }>
        Load suggestions
      </button>
    </div>
  ),
}));

const DESTINATIONS = [{ name: 'Munich', lat: 48.1, lng: 11.5 }];

beforeEach(() => {
  jest.clearAllMocks();
  geolocation.getUserLocationFromIP.mockResolvedValue({ countryCode: 'DE', country: 'Germany', city: 'Munich', latitude: 48.1, longitude: 11.5 });
  foursquare.getActivitiesForTravelStyle.mockReturnValue(['Hiking', 'Food', 'Views', 'Culture', 'Nature', 'Nightlife']);
  foursquare.fetchVenuesForActivity.mockResolvedValue([]);
  youtube.fetchTrendingVideos.mockResolvedValue([]);
});

test('renders activity grid after geolocation resolves', async () => {
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      onSubmit={jest.fn()}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => expect(screen.getByText('Hiking')).toBeInTheDocument());
});

test('clicking AI suggestion adds activity to selectedActivities (shared state)', async () => {
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      onSubmit={jest.fn()}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => screen.getByTestId('insights-panel'));
  fireEvent.click(screen.getByTestId('ai-suggestion-btn'));
  await waitFor(() =>
    expect(screen.getByTestId('ai-suggestion-btn').textContent).toContain('(selected)')
  );
});

test('Skip calls onSkip', async () => {
  const onSkip = jest.fn();
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate=""
      endDate=""
      onSubmit={jest.fn()}
      onSkip={onSkip}
    />
  );
  await waitFor(() => screen.getByText('Skip'));
  fireEvent.click(screen.getByText('Skip'));
  expect(onSkip).toHaveBeenCalled();
});

test('Continue calls onSubmit with activities and venues', async () => {
  const onSubmit = jest.fn();
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      onSubmit={onSubmit}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => screen.getByText('Hiking'));
  fireEvent.click(screen.getByText('Hiking').closest('button'));
  fireEvent.click(screen.getByText('Continue →'));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ activities: expect.any(Object), venues: expect.any(Object) })
  );
});

test('onSubmit receives dayAssignments when Continue clicked', async () => {
  const onSubmit = jest.fn();
  render(
    <VenueSelection
      destinations={DESTINATIONS}
      travelStyles={[]}
      startDate="2026-05-31"
      endDate="2026-06-05"
      days={5}
      onSubmit={onSubmit}
      onSkip={jest.fn()}
    />
  );
  await waitFor(() => screen.getByText('Hiking'));
  fireEvent.click(screen.getByText('Continue →'));
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      activities: expect.any(Object),
      venues: expect.any(Object),
      dayAssignments: expect.any(Object),
    })
  );
});

// Nov 2026 audit: day pickers return "Day 2"; the selection sent to the generator had
// `day: null` for every pick, and venues (keyed by `id`) were never captured at all.
test('a venue picked for "Day 2" reaches the itinerary request with day 2', async () => {
  foursquare.fetchVenuesForActivity.mockResolvedValue([{ id: 'fsq-1', name: 'Bé Mặn', category: 'Seafood', address: 'Đà Nẵng', lat: 16.06, lng: 108.24 }]);
  const onSubmit = jest.fn();
  render(
    <VenueSelection
      destinations={[{ name: 'Da Nang, Vietnam', lat: 16.05, lng: 108.2 }, { name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33 }]}
      stops={[{ fromDay: 1, toDay: 2 }, { fromDay: 3, toDay: 5 }]}
      travelStyles={[]}
      startDate="2026-12-25"
      endDate="2026-12-29"
      days={5}
      onSubmit={onSubmit}
      onSkip={jest.fn()}
    />
  );
  expect(await screen.findByText(/Da Nang · Days 1–2 · 25–26 Dec/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Food').closest('button'));
  fireEvent.click(await screen.findByRole('button', { name: 'Add Bé Mặn to a day' }));
  expect(screen.queryByText('Day 3')).toBeNull(); // Hoi An's days aren't offered in Da Nang
  fireEvent.click(screen.getByText('Day 2').closest('button'));
  fireEvent.click(screen.getByText('Continue →'));
  const { selection } = onSubmit.mock.calls[0][0];
  expect(selection.picks).toEqual([expect.objectContaining({ name: 'Bé Mặn', day: 2, destination: 'Da Nang, Vietnam', lat: 16.06 })]);
});

test('the second stop offers its own days and dates', async () => {
  render(
    <VenueSelection
      destinations={[{ name: 'Da Nang, Vietnam', lat: 16.05, lng: 108.2 }, { name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33 }]}
      stops={[{ fromDay: 1, toDay: 2 }, { fromDay: 3, toDay: 5 }]}
      travelStyles={[]}
      startDate="2026-12-25"
      days={5}
      onSubmit={jest.fn()}
      onSkip={jest.fn()}
    />
  );
  fireEvent.click(await screen.findByRole('button', { name: /Hoi An/ }));
  expect(screen.getByText(/Hoi An · Days 3–5 · 27–29 Dec/)).toBeInTheDocument();
});
