import { render, screen, fireEvent, act } from '@testing-library/react';
import ItineraryView, { ADJUST_POLL_MS } from './ItineraryView';
import { fetchAdjustments, startDayAdjustment } from '../api/itinerary';

jest.mock('../api/itinerary', () => ({ fetchAdjustments: jest.fn(), startDayAdjustment: jest.fn() }));
jest.mock('../utils/analytics', () => ({ analytics: { itineraryViewed: jest.fn() } }));
let mockUser = { uid: 'u1', email: 'a@example.com' };
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser, getIdToken: async () => 'tok' }) }));
jest.mock('react-router-dom', () => ({ useParams: () => ({ id: 'wz_abc123_ABCDEFGHIJKLMNOP' }), useNavigate: () => jest.fn() }));

const act_ = (v) => ({ time: '9:00', activity: 'a', location: v, venueName: v, why: '', cost: 0, isFree: true });
const mkDay = (n, theme, adjusted) => ({ dayNumber: n, theme, morningActivity: act_(`M${n}`), ...(adjusted ? { adjusted: { at: 'now' } } : {}) });
const trip = (day2) => ({ destination: 'Vietnam', days: 2, createdAt: '2026-11-01', itinerary: { title: 'Vietnam slowly', days: [mkDay(1, 'Old 1'), day2] } });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUser = { uid: 'u1', email: 'a@example.com' };
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => trip(mkDay(2, 'Old 2')) })
    .mockResolvedValue({ ok: true, json: async () => trip(mkDay(2, 'New 2', true)) });
});
afterEach(() => jest.useRealTimers());

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

test('owner: adjust a day, page polls, then shows the new day and a notice', async () => {
  fetchAdjustments.mockResolvedValueOnce({ max: 3, used: 0, remaining: 3, pending: null, items: [] });
  startDayAdjustment.mockResolvedValue({ max: 3, used: 1, remaining: 2, pending: { id: '9', day: 2 }, items: [{ id: '9', day: 2, status: 'pending' }] });
  render(<ItineraryView />);
  expect(await screen.findByText('Old 2')).toBeInTheDocument();
  expect(await screen.findByText(/3 free changes left on this trip/)).toBeInTheDocument();

  fireEvent.click(screen.getAllByText('✎ Adjust this day')[1]);
  fireEvent.click(screen.getByText('Less walking'));
  fireEvent.click(screen.getByText('Rewrite day 2'));
  await flush();
  expect(startDayAdjustment).toHaveBeenCalledWith('wz_abc123_ABCDEFGHIJKLMNOP', 2, 'Less walking');
  expect(screen.getByTestId('adjusting-2')).toBeInTheDocument();

  // still running at the first check, done at the second
  fetchAdjustments
    .mockResolvedValueOnce({ max: 3, used: 1, remaining: 2, pending: { id: '9', day: 2 }, items: [{ id: '9', day: 2, status: 'pending' }] })
    .mockResolvedValueOnce({ max: 3, used: 1, remaining: 2, pending: null, items: [{ id: '9', day: 2, status: 'done' }] });
  await act(async () => { jest.advanceTimersByTime(ADJUST_POLL_MS); });
  await flush();
  expect(screen.getByTestId('adjusting-2')).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(ADJUST_POLL_MS); });
  await flush(); await flush();
  expect(await screen.findByText('New 2')).toBeInTheDocument();
  expect(screen.getByText('Updated')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(/Day 2 is updated/);
});

test('a failed rewrite says so (and that it did not count)', async () => {
  fetchAdjustments
    .mockResolvedValueOnce({ max: 3, used: 1, remaining: 2, pending: { id: '4', day: 1 }, items: [{ id: '4', day: 1, status: 'pending' }] })
    .mockResolvedValueOnce({ max: 3, used: 0, remaining: 3, pending: null, items: [{ id: '4', day: 1, status: 'failed' }] });
  render(<ItineraryView />);
  await screen.findByText('Old 2');
  await flush();
  await act(async () => { jest.advanceTimersByTime(ADJUST_POLL_MS); });
  await flush();
  expect(await screen.findByText(/couldn't rewrite day 1/)).toBeInTheDocument();
  expect(screen.queryByText('New 2')).toBeNull();
});

test('not the owner (or signed out): no adjust controls', async () => {
  fetchAdjustments.mockResolvedValue(null);
  render(<ItineraryView />);
  await screen.findByText('Old 2');
  await flush();
  expect(screen.queryByText('✎ Adjust this day')).toBeNull();
  mockUser = null;
});
