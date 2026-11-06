import { render, screen, fireEvent } from '@testing-library/react';
import StepRoute, { dayRanges, routeKey } from './StepRoute';

// DestinationSearch talks to the API; not needed here.
jest.mock('./DestinationSearch', () => ({ DestinationSearch: () => <div data-testid="dest-search" /> }));

const form = { destinations: [{ name: 'Japan' }], days: 10 };
const route = {
  forKey: routeKey(form),
  summary: 'Temples, mountains, then the coast',
  bases: [
    { name: 'Kyoto', country: 'Japan', days: 4, why: 'Quiet temples', stayType: 'machiya', transferIn: null, dayTrips: [{ name: 'Kurama' }] },
    { name: 'Takayama', country: 'Japan', days: 3, transferIn: { mode: 'train', hours: 3.5, note: 'via Nagoya' }, dayTrips: [] },
    { name: 'Kanazawa', country: 'Japan', days: 3, transferIn: { mode: 'bus', hours: 2 }, dayTrips: [] },
  ],
};

test('dayRanges and routeKey', () => {
  expect(dayRanges(route.bases)).toEqual(['Days 1–4', 'Days 5–7', 'Days 8–10']);
  expect(dayRanges([{ days: 1 }])).toEqual(['Day 1']);
  expect(routeKey(form)).toBe('Japan|10');
});

test('shows bases with day ranges, transfers, stay and day trips', () => {
  render(<StepRoute form={form} route={route} loading={false} error="" onPlan={jest.fn()} onChange={jest.fn()} />);
  expect(screen.getByText('Temples, mountains, then the coast')).toBeInTheDocument();
  expect(screen.getByText('✓ All 10 days placed')).toBeInTheDocument();
  expect(screen.getByText(/Days 5–7/)).toBeInTheDocument();
  expect(screen.getByText(/Train · ~3.5 h — via Nagoya/)).toBeInTheDocument();
  expect(screen.getByText('Stay: machiya')).toBeInTheDocument();
  expect(screen.getByText('Day trip: Kurama')).toBeInTheDocument();
});

test('plans automatically when there is no route, but not when the route matches', () => {
  const onPlan = jest.fn();
  const { rerender } = render(<StepRoute form={form} route={null} loading={false} error="" onPlan={onPlan} onChange={jest.fn()} />);
  expect(onPlan).toHaveBeenCalledTimes(1);
  const onPlan2 = jest.fn();
  rerender(<StepRoute form={form} route={route} loading={false} error="" onPlan={onPlan2} onChange={jest.fn()} />);
  expect(onPlan2).not.toHaveBeenCalled();
});

test('re-plans when the trip length changed since the route was planned', () => {
  const onPlan = jest.fn();
  render(<StepRoute form={{ ...form, days: 12 }} route={route} loading={false} error="" onPlan={onPlan} onChange={jest.fn()} />);
  expect(onPlan).toHaveBeenCalledTimes(1);
});

test('+ adds a day; the counter would then show the mismatch', () => {
  const onChange = jest.fn();
  render(<StepRoute form={form} route={route} loading={false} error="" onPlan={jest.fn()} onChange={onChange} />);
  fireEvent.click(screen.getByLabelText('One day more in Takayama'));
  const next = onChange.mock.calls[0][0];
  expect(next.bases.map(b => b.days)).toEqual([4, 4, 3]);
  expect(next.forKey).toBe(route.forKey);
});

test('removing a stop hands its days to the neighbour (total unchanged)', () => {
  const onChange = jest.fn();
  render(<StepRoute form={form} route={route} loading={false} error="" onPlan={jest.fn()} onChange={onChange} />);
  fireEvent.click(screen.getAllByText('✕ Remove')[1]); // Takayama
  const next = onChange.mock.calls[0][0];
  expect(next.bases.map(b => [b.name, b.days])).toEqual([['Kyoto', 4], ['Kanazawa', 6]]);
});

test('moving a stop earlier clears transfers that no longer apply; first base never has one', () => {
  const onChange = jest.fn();
  render(<StepRoute form={form} route={route} loading={false} error="" onPlan={jest.fn()} onChange={onChange} />);
  fireEvent.click(screen.getAllByText('↑ Earlier')[0]); // Takayama before Kyoto
  const next = onChange.mock.calls[0][0];
  expect(next.bases.map(b => b.name)).toEqual(['Takayama', 'Kyoto', 'Kanazawa']);
  expect(next.bases[0].transferIn).toBeNull();
  expect(next.bases[1].transferIn).toBeNull();
  expect(next.bases[2].transferIn).toEqual({ mode: 'bus', hours: 2 });
});

test('mismatch counter and error with retry', () => {
  const onPlan = jest.fn();
  const off = { ...route, bases: route.bases.map((b, i) => (i === 0 ? { ...b, days: 6 } : b)) };
  render(<StepRoute form={form} route={off} loading={false} error="Could not plan a route" onPlan={onPlan} onChange={jest.fn()} />);
  expect(screen.getByText(/12 of 10 days placed/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Try again'));
  expect(onPlan).toHaveBeenCalled();
});

test('loading state', () => {
  render(<StepRoute form={form} route={null} loading error="" onPlan={jest.fn()} onChange={jest.fn()} />);
  expect(screen.getByText(/Planning your route through Japan/)).toBeInTheDocument();
});
