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

test('mobile chips appear after onInsightsLoaded fires', async () => {
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
  await waitFor(() => screen.getByTestId('load-suggestions'));
  expect(screen.queryByText('AI Picks — tap to add')).toBeNull();
  fireEvent.click(screen.getByTestId('load-suggestions'));
  await waitFor(() =>
    expect(screen.getByText('AI Picks — tap to add')).toBeInTheDocument()
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
