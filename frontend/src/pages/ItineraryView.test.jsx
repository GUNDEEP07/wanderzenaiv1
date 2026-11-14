import { render, screen, fireEvent, act } from '@testing-library/react';
import ItineraryView, { ADJUST_POLL_MS } from './ItineraryView';
import { fetchAdjustments, startDayAdjustment, fetchPdfLink } from '../api/itinerary';
import { openUrl } from '../utils/openUrl';

jest.mock('../api/itinerary', () => ({ fetchAdjustments: jest.fn(), startDayAdjustment: jest.fn(), fetchPdfLink: jest.fn() }));
jest.mock('../utils/openUrl', () => ({ openUrl: jest.fn() }));
jest.mock('../utils/analytics', () => ({ analytics: { itineraryViewed: jest.fn() } }));
let mockUser = { uid: 'u1', email: 'a@example.com' };
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser, getIdToken: async () => (mockUser ? 'tok' : null) }) }));
let mockSearch = '';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useParams: () => ({ id: 'wz_abc123_ABCDEFGHIJKLMNOP' }), useNavigate: () => mockNavigate, useLocation: () => ({ search: mockSearch }) }));

const ID = 'wz_abc123_ABCDEFGHIJKLMNOP';
const act_ = (v, time = '9:00', extra = {}) => ({ time, activity: `Visit ${v}`, location: v, venueName: v, why: '', cost: 0, isFree: true, ...extra });
const mkDay = (n, theme, adjusted) => ({ dayNumber: n, theme, base: 'Hoi An', dailyCost: 50, morningActivity: act_(`M${n}`), ...(adjusted ? { adjusted: { at: 'now' } } : {}) });
const trip = (day2, extra = {}) => ({ destination: 'Vietnam', days: 2, currency: 'AUD', createdAt: '2026-11-01', isOwner: true, hasPdf: true, travelDate: null, itinerary: { title: 'Vietnam slowly', days: [mkDay(1, 'Old 1'), day2] }, ...extra });
const okJson = (body) => ({ ok: true, status: 200, json: async () => body });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const openDay = (n) => fireEvent.click(screen.getByRole('tab', { name: new RegExp(`(Day|·) ${n}$`) }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  window.localStorage.clear();
  mockUser = { uid: 'u1', email: 'a@example.com' };
  mockSearch = '';
  global.fetch = jest.fn()
    .mockResolvedValueOnce(okJson(trip(mkDay(2, 'Old 2'))))
    .mockResolvedValue(okJson(trip(mkDay(2, 'New 2', true))));
  fetchAdjustments.mockResolvedValue(null);
});
afterEach(() => jest.useRealTimers());

test('opens on day 1 without dates; day chips switch days; costs in the trip currency', async () => {
  render(<ItineraryView />);
  expect(await screen.findByText('Old 1')).toBeInTheDocument();
  expect(screen.queryByText('Old 2')).toBeNull();
  expect(screen.getByText(/Day budget ≈ A\$50/)).toBeInTheDocument();
  openDay(2);
  expect(screen.getByText('Old 2')).toBeInTheDocument();
});

test('owner: adjust a day, page polls, then shows the new day and a notice', async () => {
  fetchAdjustments.mockResolvedValueOnce({ max: 3, used: 0, remaining: 3, pending: null, items: [] });
  startDayAdjustment.mockResolvedValue({ max: 3, used: 1, remaining: 2, pending: { id: '9', day: 2 }, items: [{ id: '9', day: 2, status: 'pending' }] });
  render(<ItineraryView />);
  await screen.findByText('Old 1');
  expect(await screen.findByText(/3 free changes left on this trip/)).toBeInTheDocument();
  openDay(2);

  fireEvent.click(screen.getByText('✎ Adjust this day'));
  fireEvent.click(screen.getByText('Less walking'));
  fireEvent.click(screen.getByText('Rewrite day 2'));
  await flush();
  expect(startDayAdjustment).toHaveBeenCalledWith(ID, 2, 'Less walking');
  expect(screen.getByTestId('adjusting-2')).toBeInTheDocument();

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
  expect(screen.getByText(/Day 2 is updated/)).toBeInTheDocument();
});

test('a failed rewrite says so (and that it did not count)', async () => {
  fetchAdjustments
    .mockResolvedValueOnce({ max: 3, used: 1, remaining: 2, pending: { id: '4', day: 1 }, items: [{ id: '4', day: 1, status: 'pending' }] })
    .mockResolvedValueOnce({ max: 3, used: 0, remaining: 3, pending: null, items: [{ id: '4', day: 1, status: 'failed' }] });
  render(<ItineraryView />);
  await screen.findByText('Old 1');
  await flush();
  await act(async () => { jest.advanceTimersByTime(ADJUST_POLL_MS); });
  await flush();
  expect(await screen.findByText(/couldn't rewrite day 1/)).toBeInTheDocument();
});

test('not the owner: no adjust controls, no PDF or calendar buttons', async () => {
  global.fetch = jest.fn().mockResolvedValue(okJson(trip(mkDay(2, 'Old 2'), { isOwner: false, hasPdf: false })));
  render(<ItineraryView />);
  await screen.findByText('Old 1');
  await flush();
  expect(screen.queryByText('✎ Adjust this day')).toBeNull();
  expect(screen.queryByText(/Download PDF/)).toBeNull();
  expect(screen.queryByText(/Add to calendar/)).toBeNull();
});

test('during the trip: opens on today with "Up next" and directions to that place', async () => {
  jest.setSystemTime(new Date(2026, 10, 17, 8, 0));
  const d2 = { ...mkDay(2, 'Today theme'), morningActivity: act_('Basket boats', '09:30', { insiderTip: 'Go late', localName: 'Rừng Dừa Bảy Mẫu' }) };
  global.fetch = jest.fn().mockResolvedValue(okJson(trip(d2, { travelDate: '2026-11-16' })));
  render(<ItineraryView />);
  expect(await screen.findByText('Today theme')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Today · 2' })).toHaveAttribute('aria-selected', 'true');
  const upNext = screen.getByRole('region', { name: 'Up next' });
  expect(upNext).toHaveTextContent('Visit Basket boats');
  const link = upNext.querySelector('a');
  expect(new URL(link.href).searchParams.get('destination')).toBe('Basket boats, Hoi An, Vietnam');
  expect(screen.getByText(/Add to calendar/)).toBeInTheDocument();

  // the next stop opens by itself: local name for a driver, mark as done (kept on this device)
  fireEvent.click(screen.getByText('Show to a driver'));
  expect(screen.getAllByText(/Rừng Dừa Bảy Mẫu/).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText('Mark as done'));
  expect(JSON.parse(window.localStorage.getItem(`wz_done_${ID}`))).toEqual(['2:morningActivity']);
  expect(screen.queryByRole('region', { name: 'Up next' })).toBeNull();
});

test('no connection: shows the saved copy', async () => {
  window.localStorage.setItem(`wz_trip_${ID}`, JSON.stringify({ savedAt: Date.now(), data: trip(mkDay(2, 'Saved 2')) }));
  global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  render(<ItineraryView />);
  expect(await screen.findByText('Old 1')).toBeInTheDocument();
  expect(screen.getByText(/No connection — showing the copy saved/)).toBeInTheDocument();
});

test('a missing trip is not hidden behind a saved copy', async () => {
  window.localStorage.setItem(`wz_trip_${ID}`, JSON.stringify({ savedAt: Date.now(), data: trip(mkDay(2, 'Saved 2')) }));
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
  render(<ItineraryView />);
  expect(await screen.findByText('Itinerary not found')).toBeInTheDocument();
});

test('from the email (?download=1): the owner gets a fresh PDF link straight away', async () => {
  mockSearch = '?download=1';
  fetchPdfLink.mockResolvedValue({ url: 'https://signed.example/x.pdf' });
  render(<ItineraryView />);
  await screen.findByText('Old 1');
  await flush();
  expect(fetchPdfLink).toHaveBeenCalledWith(ID);
  expect(openUrl).toHaveBeenCalledWith('https://signed.example/x.pdf');
});

test('from the email, signed out: asks to sign in and comes back to download', async () => {
  mockSearch = '?download=1';
  mockUser = null;
  global.fetch = jest.fn().mockResolvedValue(okJson(trip(mkDay(2, 'Old 2'), { isOwner: false, hasPdf: false })));
  render(<ItineraryView />);
  await screen.findByText('Old 1');
  await flush();
  expect(screen.getByRole('status')).toHaveTextContent(/Sign in with the email this trip was sent to/);
  expect(fetchPdfLink).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByText('Sign in')[0]);
  expect(mockNavigate).toHaveBeenCalledWith(`/login?next=${encodeURIComponent(`/itinerary/${ID}?download=1`)}`);
});
