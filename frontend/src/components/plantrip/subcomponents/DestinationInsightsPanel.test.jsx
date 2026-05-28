import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DestinationInsightsPanel } from './DestinationInsightsPanel';
import { fetchDestinationInsights } from '../../../api/destinationInsights';

jest.mock('../../../api/destinationInsights');

const MOCK_INSIGHTS = {
  bestMonths: ['May', 'June'],
  weather: 'Warm and sunny (20-25°C), occasional showers',
  crowdLevel: 'Moderate',
  thingsToDo: [
    { name: 'Alps Hiking', emoji: '🥾', category: 'Adventure', reason: 'Perfect trail weather — ideal for outdoor exploration' },
    { name: 'Beer Festival', emoji: '🍺', category: 'Culture', reason: 'Early June season — festive atmosphere for social travel' },
  ],
};

const PROPS = {
  destination: { name: 'Munich' },
  travelStyles: ['Adventure'],
  startDate: '2026-05-31',
  endDate: '2026-06-05',
  selectedActivities: [],
  onActivityToggle: jest.fn(),
  onInsightsLoaded: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchDestinationInsights.mockResolvedValue(MOCK_INSIGHTS);
});

test('renders nothing when destination is missing', () => {
  const { container } = render(<DestinationInsightsPanel {...PROPS} destination={null} />);
  expect(container.firstChild).toBeNull();
});

test('renders compact badges after insights load', async () => {
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() => expect(screen.getByText(/Moderate/)).toBeInTheDocument());
  expect(screen.getByText(/Warm and sunny/)).toBeInTheDocument();
  expect(screen.getByText(/May & June/)).toBeInTheDocument();
});

test('renders AI suggestion cards', async () => {
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  expect(screen.getByText('Beer Festival')).toBeInTheDocument();
});

test('clicking a suggestion card calls onActivityToggle with its name', async () => {
  const onActivityToggle = jest.fn();
  render(<DestinationInsightsPanel {...PROPS} onActivityToggle={onActivityToggle} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  const card = screen.getByText('Alps Hiking').closest('.item-card');
  fireEvent.click(card.querySelector('.add-btn'));
  expect(onActivityToggle).toHaveBeenCalledWith('Alps Hiking');
});

test('selected activity shows --added class on its card', async () => {
  render(<DestinationInsightsPanel {...PROPS} selectedActivities={['Alps Hiking']} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  const card = screen.getByText('Alps Hiking').closest('.item-card');
  expect(card.className).toContain('item-card--added');
});

test('calls onInsightsLoaded with thingsToDo when insights arrive', async () => {
  const onInsightsLoaded = jest.fn();
  render(<DestinationInsightsPanel {...PROPS} onInsightsLoaded={onInsightsLoaded} />);
  await waitFor(() =>
    expect(onInsightsLoaded).toHaveBeenCalledWith(MOCK_INSIGHTS.thingsToDo)
  );
});

test('shows error message when fetch fails', async () => {
  fetchDestinationInsights.mockRejectedValue(new Error('network'));
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() =>
    expect(screen.getByText('Could not load destination insights')).toBeInTheDocument()
  );
});

test('clicking chevron expands a pick card', async () => {
  render(<DestinationInsightsPanel {...PROPS} />);
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  const card = screen.getByText('Alps Hiking').closest('.item-card');
  expect(card.className).not.toContain('item-card--picking');
  fireEvent.click(card.querySelector('.item-chevron'));
  expect(card.className).toContain('item-card--picking');
});

test('selecting a day calls onDayAssign and onActivityToggle', async () => {
  const onActivityToggle = jest.fn();
  const onDayAssign = jest.fn();
  render(
    <DestinationInsightsPanel
      {...PROPS}
      onActivityToggle={onActivityToggle}
      onDayAssign={onDayAssign}
      days={3}
    />
  );
  await waitFor(() => expect(screen.getByText('Alps Hiking')).toBeInTheDocument());
  const card = screen.getByText('Alps Hiking').closest('.item-card');
  fireEvent.click(card.querySelector('.item-chevron'));
  fireEvent.click(screen.getByText('Day 2').closest('button'));
  expect(onActivityToggle).toHaveBeenCalledWith('Alps Hiking');
  expect(onDayAssign).toHaveBeenCalledWith('Alps Hiking', 'Day 2');
});
