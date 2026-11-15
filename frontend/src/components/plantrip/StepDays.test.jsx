import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import StepDays, { daysStatus } from './StepDays';
import { fetchDestinationInsights } from '../../api/destinationInsights';
import { placesFromResponse } from '../../api/places';

jest.mock('../../api/destinationInsights', () => ({ fetchDestinationInsights: jest.fn() }));

const STOPS = [
  { name: 'Da Nang', country: 'Vietnam', lat: 16.05, lng: 108.2, fromDay: 1, toDay: 2 },
  { name: 'Hoi An', country: 'Vietnam', lat: 15.88, lng: 108.33, fromDay: 3, toDay: 5 },
];

function Harness({ onSel }) {
  const [sel, setSel] = useState({ version: 2, picks: [], interests: [] });
  return <StepDays stops={STOPS} startDate="2026-12-25" value={sel} onChange={(v) => { setSel(v); onSel?.(v); }} />;
}

const venuesResponse = {
  categories: [
    { category: 'Restaurants', venues: [{ fsq_id: 'r1', name: 'Bé Mặn', category: 'Seafood Restaurant', address: 'Võ Nguyên Giáp', lat: 16.06, lng: 108.24 }] },
    { category: 'Cafes', venues: [{ fsq_id: 'c1', name: 'Huế Xưa Cafe' }, { fsq_id: 'r1', name: 'Bé Mặn' }] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchDestinationInsights.mockResolvedValue({ thingsToDo: [{ name: 'Son Tra Peninsula', reason: 'Forest road.', category: 'Nature', verified: true }] });
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => venuesResponse }));
});

// The old step matched "Restaurant" against the backend's "Restaurants" and never showed anything.
test('backend categories are all used (plural names), de-duplicated', () => {
  expect(placesFromResponse(venuesResponse).map(p => p.name)).toEqual(['Bé Mặn', 'Huế Xưa Cafe']);
});

test('picked-for-you place goes onto the chosen day, with the stop and coordinates', async () => {
  const onSel = jest.fn();
  render(<Harness onSel={onSel} />);
  expect(screen.getByRole('tab', { name: /Da Nang Days 1–2 · 25–26 Dec/ })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(await screen.findByRole('button', { name: 'Add Son Tra Peninsula to day 2' }));
  const last = onSel.mock.calls.at(-1)[0];
  expect(last.picks).toEqual([expect.objectContaining({ name: 'Son Tra Peninsula', day: 2, destination: 'Da Nang, Vietnam', source: 'foursquare' })]);
  expect(within(screen.getByRole('region', { name: 'Days in Da Nang' })).getByText('Son Tra Peninsula')).toBeInTheDocument();
  expect(daysStatus(last, 5)).toBe('1 place on 1 of 5 days · we\'ll plan the rest');
});

test('browse by category: Food & drink shows real places and adds them to a day', async () => {
  const onSel = jest.fn();
  render(<Harness onSel={onSel} />);
  fireEvent.click(screen.getByRole('tab', { name: 'Browse by category' }));
  expect(await screen.findByText('Huế Xưa Cafe')).toBeInTheDocument();
  expect(global.fetch.mock.calls[0][0]).toMatch(/recommendations\/venues\?.*activity=food/);
  fireEvent.click(screen.getByRole('button', { name: 'Add Bé Mặn to day 1' }));
  expect(onSel.mock.calls.at(-1)[0].picks[0]).toEqual(expect.objectContaining({ name: 'Bé Mặn', day: 1, lat: 16.06, address: 'Võ Nguyên Giáp' }));
  expect(screen.getByRole('button', { name: 'Remove Bé Mặn' })).toBeInTheDocument();
});

test('search, and the second stop offers only its own days', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('tab', { name: /Hoi An/ }));
  expect(screen.getByRole('region', { name: 'Days in Hoi An' })).toHaveTextContent('Day 3Sun 27 Dec');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search places in Hoi An' }), { target: { value: 'banh mi' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  expect(await screen.findByText('Results for “banh mi” near Hoi An')).toBeInTheDocument();
  expect(global.fetch.mock.calls.at(-1)[0]).toMatch(/query=banh\+mi/);
  expect((await screen.findAllByRole('button', { name: /to day 3$/ })).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /to day 1$/ })).toBeNull();
});

test('add your own place, any day', () => {
  const onSel = jest.fn();
  render(<Harness onSel={onSel} />);
  fireEvent.change(screen.getByLabelText("Can't find it? Add your own place"), { target: { value: "Lan's café" } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(onSel.mock.calls.at(-1)[0].picks[0]).toEqual(expect.objectContaining({ name: "Lan's café", day: null, source: 'user', destination: 'Da Nang, Vietnam' }));
  expect(within(screen.getByRole('region', { name: 'Days in Da Nang' })).getByText('Any day')).toBeInTheDocument();
});
