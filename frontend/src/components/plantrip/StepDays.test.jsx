import { useState } from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import StepDays, { daysStatus, _clearIdeaCache } from './StepDays';
import { fetchDestinationInsights } from '../../api/destinationInsights';

jest.mock('../../api/destinationInsights', () => ({ fetchDestinationInsights: jest.fn() }));
jest.mock('../PhotoCredit', () => ({ CreditedPhoto: ({ keyword }) => <img alt="" data-q={keyword} /> }));

const STOPS = [
  { name: 'Queenstown', country: 'New Zealand', lat: -45.03, lng: 168.66, fromDay: 1, toDay: 3, dayTrips: ['Glenorchy'] },
  { name: 'Te Anau', country: 'New Zealand', lat: -45.41, lng: 167.71, fromDay: 4, toDay: 5, dayTrips: [] },
];

function Harness({ onSel, onSkip = jest.fn(), initial }) {
  const [sel, setSel] = useState(initial || { version: 2, picks: [], interests: [] });
  return <StepDays stops={STOPS} startDate="" value={sel} onSkip={onSkip} onChange={(v) => { setSel(v); onSel?.(v); }} />;
}

beforeEach(() => {
  jest.clearAllMocks();
  _clearIdeaCache();
  fetchDestinationInsights.mockImplementation(async (dest) => ({
    thingsToDo: dest.startsWith('Queenstown')
      ? [{ name: 'Onsen Hot Pools', reason: 'Cedar tubs above the river.', verified: true }, { name: 'Glenorchy', reason: 'dup of the day trip', verified: false }]
      : [{ name: 'Te Anau Glowworm Caves', reason: 'Boat into the dark.', verified: true }],
  }));
});

test('every stop loads its ideas at once (parallel), day trips first, no duplicates', async () => {
  render(<Harness />);
  expect(fetchDestinationInsights).toHaveBeenCalledTimes(2);
  const q = screen.getByRole('region', { name: 'Queenstown' });
  expect(within(q).getByText('Glenorchy')).toBeInTheDocument(); // instant, from the route
  await within(q).findByText('Onsen Hot Pools');
  expect(within(q).getAllByText('Glenorchy')).toHaveLength(1);
  await within(screen.getByRole('region', { name: 'Te Anau' })).findByText('Te Anau Glowworm Caves');
});

test('Keep saves a pick for that stop with no day (the generator places it); tap again removes', async () => {
  const onSel = jest.fn();
  render(<Harness onSel={onSel} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Keep Onsen Hot Pools' }));
  const sel = onSel.mock.calls.at(-1)[0];
  expect(sel.version).toBe(2);
  expect(sel.picks).toEqual([expect.objectContaining({ name: 'Onsen Hot Pools', destination: 'Queenstown, New Zealand', day: null })]);
  expect(screen.getByText(/Days 1–3 · 1 kept/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Kept Onsen Hot Pools — remove' }));
  expect(onSel.mock.calls.at(-1)[0].picks).toEqual([]);
});

test('Skip goes straight on; the label changes once something is kept', async () => {
  const onSkip = jest.fn();
  render(<Harness onSkip={onSkip} />);
  fireEvent.click(screen.getByRole('button', { name: 'Skip — you choose for me' }));
  expect(onSkip).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Keep Glenorchy' }));
  expect(screen.getByRole('button', { name: 'Done — plan the rest for me' })).toBeInTheDocument();
});

test('add your own: search the stop, or keep the name as written', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ categories: [{ category: 'Cafes', venues: [{ fsq_id: 'c1', name: 'Fergbaker' }] }] }) }));
  const onSel = jest.fn();
  render(<Harness onSel={onSel} />);
  const q = screen.getByRole('region', { name: 'Queenstown' });
  fireEvent.change(within(q).getByRole('searchbox'), { target: { value: 'bakery' } });
  fireEvent.click(within(q).getByRole('button', { name: 'Find' }));
  await within(q).findByText('Fergbaker');
  fireEvent.click(within(q).getAllByRole('button', { name: '+ Keep' })[0]);
  expect(onSel.mock.calls.at(-1)[0].picks.map((p) => p.name)).toEqual(['Fergbaker']);
  fireEvent.change(within(q).getByRole('searchbox'), { target: { value: "Aunty's place" } });
  fireEvent.click(within(q).getByRole('button', { name: 'Find' }));
  fireEvent.click(await within(q).findByRole('button', { name: /as written/ }));
  expect(onSel.mock.calls.at(-1)[0].picks.map((p) => p.name)).toEqual(['Fergbaker', "Aunty's place"]);
  expect(within(q).getByRole('list', { name: 'Your own places in Queenstown' })).toHaveTextContent("Aunty's place");
});

test('a stop whose ideas fail still offers add-your-own', async () => {
  fetchDestinationInsights.mockRejectedValue(new Error('500'));
  render(<Harness />);
  await waitFor(() => expect(screen.getByText(/Couldn’t load ideas for Te Anau/)).toBeInTheDocument());
  expect(screen.getByRole('searchbox', { name: 'Add your own place in Te Anau' })).toBeInTheDocument();
});

test('footer status', () => {
  expect(daysStatus({ picks: [] })).toMatch(/Optional/);
  expect(daysStatus({ picks: [{ name: 'a' }, { name: 'b' }] })).toBe("2 places kept · we'll plan the rest");
});
