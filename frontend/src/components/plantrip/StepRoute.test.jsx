import { render, screen, fireEvent } from '@testing-library/react';
import StepRoute, { dayRanges, routeKey } from './StepRoute';

// DestinationSearch talks to the API; not needed here.
jest.mock('./DestinationSearch', () => ({ DestinationSearch: () => <div data-testid="dest-search" /> }));

const form = { destinations: [{ name: 'Japan' }], days: 10, tripPrefs: { adults: 2, kids: [], transferComfort: 'medium', overnightOk: false } };
const key = routeKey(form);
const route = {
  forKey: key,
  name: 'Mountains and old towns',
  summary: 'Temples, mountains, then the coast',
  bases: [
    { name: 'Kyoto', country: 'Japan', days: 4, why: 'Quiet temples', stayType: 'machiya', transferIn: null, dayTrips: [{ name: 'Kurama' }] },
    { name: 'Takayama', country: 'Japan', days: 3, transferIn: { mode: 'train', hours: 3.5, note: 'via Nagoya' }, dayTrips: [] },
    { name: 'Kanazawa', country: 'Japan', days: 3, transferIn: { mode: 'bus', hours: 2 }, dayTrips: [] },
  ],
};
const options = [
  { id: 'jp-alps', name: 'Alps & old towns', summary: 'Slow and green', source: 'curated', kidFriendly: true, longestTransferHours: 3.5, fitsConstraints: true, caution: null, bases: route.bases },
  { id: 'ai-1', name: 'Coast & islands', summary: 'Sea air', source: 'ai', longestTransferHours: 5, fitsConstraints: false, caution: 'One leg is ~5 h, longer than you asked for.', bases: [{ name: 'Hiroshima', days: 5 }, { name: 'Naoshima', days: 5 }] },
];
const props = { form, loading: false, error: '', onPlan: jest.fn(), onChoose: jest.fn(), onChange: jest.fn() };

test('dayRanges and routeKey', () => {
  expect(dayRanges(route.bases)).toEqual(['Days 1–4', 'Days 5–7', 'Days 8–10']);
  expect(dayRanges([{ days: 1 }])).toEqual(['Day 1']);
  expect(key).toBe('Japan|10||medium|0');
  // Kids or travel-time comfort change the key → new suggestions.
  expect(routeKey({ ...form, tripPrefs: { ...form.tripPrefs, kids: [4, 7] } })).toBe('Japan|10|4.7|medium|0');
  expect(routeKey({ destinations: [{ name: 'Japan' }], days: 10 })).toBe('Japan|10||medium|0');
});

test('asks for suggestions on arrival when there are none for this trip', () => {
  const onPlan = jest.fn();
  render(<StepRoute {...props} route={null} options={[]} onPlan={onPlan} />);
  expect(onPlan).toHaveBeenCalledWith({ more: false });
});

test('does not re-ask when suggestions for this trip are already loaded', () => {
  const onPlan = jest.fn();
  render(<StepRoute {...props} route={null} options={options} optionsKey={key} onPlan={onPlan} />);
  expect(onPlan).not.toHaveBeenCalled();
});

test('suggestions planned for another trip are hidden and re-fetched', () => {
  const onPlan = jest.fn();
  render(<StepRoute {...props} route={null} options={options} optionsKey="Japan|7||medium|0" onPlan={onPlan} />);
  expect(screen.queryByText('Alps & old towns')).not.toBeInTheDocument();
  expect(onPlan).toHaveBeenCalledTimes(1);
});

test('shows option cards with stops, transfer, badges and caution; choosing one calls onChoose', () => {
  const onChoose = jest.fn();
  render(<StepRoute {...props} route={null} options={options} optionsKey={key} onChoose={onChoose} />);
  expect(screen.getByText('Alps & old towns')).toBeInTheDocument();
  expect(screen.getByText('WanderZen pick')).toBeInTheDocument();
  expect(screen.getByText('Kid-friendly')).toBeInTheDocument();
  expect(screen.getByText('Longest transfer: ~3.5 h')).toBeInTheDocument();
  expect(screen.getByText(/One leg is ~5 h/)).toBeInTheDocument();
  fireEvent.click(screen.getAllByText('This looks good →')[1]);
  expect(onChoose).toHaveBeenCalledWith(options[1]);
});

test('"Show other ideas" asks for more', () => {
  const onPlan = jest.fn();
  render(<StepRoute {...props} route={null} options={options} optionsKey={key} onPlan={onPlan} />);
  fireEvent.click(screen.getByText('Show other ideas'));
  expect(onPlan).toHaveBeenCalledWith({ more: true });
});

test('error shows a retry', () => {
  const onPlan = jest.fn();
  render(<StepRoute {...props} route={null} options={[]} error="Could not plan a route" onPlan={onPlan} />);
  expect(screen.getByText(/Could not plan a route/)).toBeInTheDocument();
  onPlan.mockClear();
  fireEvent.click(screen.getByText('Try again'));
  expect(onPlan).toHaveBeenCalledWith({ more: false });
});

test('chosen route: bases with day ranges, transfers, stay and day trips; no fetch', () => {
  const onPlan = jest.fn();
  render(<StepRoute {...props} route={route} options={[]} onPlan={onPlan} />);
  expect(onPlan).not.toHaveBeenCalled();
  expect(screen.getByText('Temples, mountains, then the coast')).toBeInTheDocument();
  expect(screen.getByText('✓ All 10 days placed')).toBeInTheDocument();
  expect(screen.getByText(/Days 5–7/)).toBeInTheDocument();
  expect(screen.getByText(/Train · ~3.5 h — via Nagoya/)).toBeInTheDocument();
  expect(screen.getByText('Stay: machiya')).toBeInTheDocument();
  expect(screen.getByText('Day trip: Kurama')).toBeInTheDocument();
});

test('a route chosen for another trip length is ignored and new suggestions are fetched', () => {
  const onPlan = jest.fn();
  render(<StepRoute {...props} form={{ ...form, days: 12 }} route={route} options={[]} onPlan={onPlan} />);
  expect(onPlan).toHaveBeenCalledTimes(1);
});

test('+ adds a day and keeps the forKey', () => {
  const onChange = jest.fn();
  render(<StepRoute {...props} route={route} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('One day more in stop 2, Takayama'));
  const next = onChange.mock.calls[0][0];
  expect(next.bases.map(b => b.days)).toEqual([4, 4, 3]);
  expect(next.forKey).toBe(key);
});

test('removing a stop hands its days to the neighbour (total unchanged)', () => {
  const onChange = jest.fn();
  render(<StepRoute {...props} route={route} onChange={onChange} />);
  fireEvent.click(screen.getAllByText('✕ Remove')[1]); // Takayama
  const next = onChange.mock.calls[0][0];
  expect(next.bases.map(b => [b.name, b.days])).toEqual([['Kyoto', 4], ['Kanazawa', 6]]);
});

test('moving a stop earlier clears transfers that no longer apply; first base never has one', () => {
  const onChange = jest.fn();
  render(<StepRoute {...props} route={route} onChange={onChange} />);
  fireEvent.click(screen.getAllByText('↑ Earlier')[0]); // Takayama before Kyoto
  const next = onChange.mock.calls[0][0];
  expect(next.bases.map(b => b.name)).toEqual(['Takayama', 'Kyoto', 'Kanazawa']);
  expect(next.bases[0].transferIn).toBeNull();
  expect(next.bases[1].transferIn).toBeNull();
  expect(next.bases[2].transferIn).toEqual({ mode: 'bus', hours: 2 });
});

test('a repeat stop (Hanoi → Sapa → Hanoi) renders both visits', () => {
  const loop = { forKey: routeKey({ ...form, days: 6 }), bases: [{ name: 'Hanoi', days: 2 }, { name: 'Sapa', days: 2 }, { name: 'Hanoi', days: 2 }] };
  render(<StepRoute {...props} form={{ ...form, days: 6 }} route={loop} />);
  expect(screen.getAllByText('Hanoi')).toHaveLength(2);
  expect(screen.getByText('✓ All 6 days placed')).toBeInTheDocument();
});

test('mismatch counter; "Choose a different route" goes back to the options', () => {
  const off = { ...route, bases: route.bases.map((b, i) => (i === 0 ? { ...b, days: 6 } : b)) };
  render(<StepRoute {...props} route={off} options={options} optionsKey={key} />);
  expect(screen.getByText(/12 of 10 days placed/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('↺ Choose a different route'));
  expect(screen.getByText('Alps & old towns')).toBeInTheDocument();
  fireEvent.click(screen.getByText('← Back to my route'));
  expect(screen.getByText(/12 of 10 days placed/)).toBeInTheDocument();
});
