import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Confirmation, { stageIndex, STAGES } from './Confirmation';
import { fetchProgress } from '../api/itinerary';

jest.mock('../api/itinerary', () => ({ fetchProgress: jest.fn() }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: { email: 'gundeep07@gmail.com' } }) }));
jest.mock('../components/map/RouteMap', () => ({ __esModule: true, default: ({ stops }) => <div data-testid="route-map">{stops.map(s => s.name).join(' > ')}</div> }));

const ID = 'wz_mw60pg7p_WaAL4pQuDWiGvyKO';
const route = [{ name: 'Hanoi', lat: 21, lng: 105.8, days: 2 }, { name: 'Sapa', lat: 22.3, lng: 103.8, days: 2 }];
const day = (n, base) => ({ day: n, theme: `Theme ${n}`, base, travelDay: n === 3, stops: ['Old Quarter walk', 'Water puppets'], eat: 'Bun Cha Huong Lien' });

const renderAt = (url = `/confirmation?id=${ID}`) => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/confirmation" element={<Confirmation />} />
      <Route path="/plan" element={<div>plan page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { jest.clearAllMocks(); delete global.fetch; });

test('stageIndex follows the real status and stage', () => {
  expect(stageIndex('pending', null)).toBe(0);
  expect(stageIndex('processing', 'writing')).toBe(1);
  expect(stageIndex('processing', 'finishing')).toBe(3);
  expect(stageIndex('itinerary_ready', 'finishing')).toBe(4);
  expect(stageIndex('pdf_ready', 'finishing')).toBe(5);
  expect(stageIndex('email_sent', 'finishing')).toBe(STAGES.length);
});

test('while writing: steps, route + map, written days and placeholders', async () => {
  fetchProgress.mockResolvedValue({ ok: true, data: { status: 'processing', stage: 'writing', destination: 'Vietnam', totalDays: 4, route, days: [day(3, 'Sapa'), day(1, 'Hanoi')], startedAt: new Date().toISOString() } });
  renderAt();
  expect(await screen.findByText('Writing your Vietnam trip')).toBeInTheDocument();
  expect(fetchProgress).toHaveBeenCalledWith(ID);
  expect(screen.getByText('Writing your days (2 of 4)')).toBeInTheDocument();
  expect(screen.getByTestId('route-map')).toHaveTextContent('Hanoi > Sapa');
  expect(screen.getByTestId('day-1')).toHaveTextContent('Theme 1');
  expect(screen.getByTestId('day-3')).toHaveTextContent('travel day');
  expect(screen.getByText('Day 2 — being written…')).toBeInTheDocument();
  expect(screen.getByText('Your days — 2 of 4 written')).toBeInTheDocument();
});

test('delivered: confirmation plus the whole trip at a glance', async () => {
  fetchProgress.mockResolvedValue({ ok: true, data: { status: 'email_sent', stage: 'finishing', destination: 'Vietnam', totalDays: 2, route, days: [day(1, 'Hanoi'), day(2, 'Hanoi')] } });
  renderAt();
  expect(await screen.findByText('Your Vietnam adventure begins now')).toBeInTheDocument();
  expect(screen.getByTestId('day-2')).toBeInTheDocument();
  expect(screen.getByText('How was your planning experience?')).toBeInTheDocument();
});

test('failed: friendly message from the API, never internal errors', async () => {
  fetchProgress.mockResolvedValue({ ok: true, data: { status: 'failed', failed: true, message: 'We could not finish this trip, and nothing was used up. Please try again.', days: [] } });
  renderAt();
  expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  expect(screen.getByText(/nothing was used up/)).toBeInTheDocument();
});

test('not signed in here: falls back to the public status', async () => {
  fetchProgress.mockResolvedValue({ ok: false, status: 401 });
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ success: true, data: { status: 'pdf_ready' } }) });
  renderAt();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`/itinerary/${ID}`), expect.anything()));
  // pdf_ready → the "Sending it to your inbox" step is the active one
  await waitFor(() => expect(screen.getByText('Building your travel guide PDF').previousSibling).toHaveTextContent('✓'));
});

test('no id → back to planning', async () => {
  renderAt('/confirmation');
  expect(await screen.findByText('plan page')).toBeInTheDocument();
});

test('names the account inbox (survives a refresh without router state)', async () => {
  fetchProgress.mockResolvedValue({ ok: true, data: { status: 'processing', stage: 'writing', destination: 'Vietnam', totalDays: 2, route, days: [] } });
  renderAt();
  expect(await screen.findByText('gundeep07@gmail.com')).toBeInTheDocument();
});
