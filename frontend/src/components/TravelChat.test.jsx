import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TravelChat } from './TravelChat';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ getIdToken: async () => 'tok' }) }));
jest.mock('../utils/analytics', () => ({ analytics: { chatOpened: jest.fn() } }));

const soon = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
const trips = [{ id: 'wz_abc123_aaaaaaaaaaaaaaaa', destination: 'Queenstown, New Zealand', days: 5, status: 'email_sent', travelDate: soon, createdAt: new Date().toISOString() }];

beforeAll(() => { Element.prototype.scrollIntoView = jest.fn(); });

beforeEach(() => {
  global.fetch = jest.fn(async () => ({ json: async () => ({ reply: 'Pack layers.' }) }));
});

test('with an upcoming trip: companion mode, sends the trip id', async () => {
  render(<MemoryRouter><TravelChat trips={trips} /></MemoryRouter>);
  expect(screen.getByText('Trip companion')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Your Queenstown trip' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'What should I pack for this trip?' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body).toMatchObject({ mode: 'trip', tripId: trips[0].id });
});

test('"New trip" switches to the planning chat', async () => {
  render(<MemoryRouter><TravelChat trips={trips} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('tab', { name: 'New trip' }));
  expect(screen.getByText('AI Travel Advisor')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Help me plan my next trip' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.mode).toBe('plan');
  expect(body.tripId).toBeUndefined();
});

test('no trips: planning chat, no tabs', () => {
  render(<MemoryRouter><TravelChat trips={[]} /></MemoryRouter>);
  expect(screen.getByText('AI Travel Advisor')).toBeInTheDocument();
  expect(screen.queryByRole('tab')).toBeNull();
});

test('several trips: a picker switches which trip the chat is about', async () => {
  const two = [...trips, { id: 'wz_abc123_bbbbbbbbbbbbbbbb', destination: 'Queenstown', days: 5, status: 'email_sent', travelDate: null, createdAt: new Date().toISOString() }];
  two[0] = { ...two[0], destination: 'Hoi An, Vietnam' };
  render(<MemoryRouter><TravelChat trips={two} /></MemoryRouter>);
  expect(screen.getByRole('tab', { name: 'Your Hoi An trip' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Which trip' }), { target: { value: 'wz_abc123_bbbbbbbbbbbbbbbb' } });
  expect(screen.getByRole('tab', { name: 'Your Queenstown trip' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'What should I pack for this trip?' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(JSON.parse(global.fetch.mock.calls[0][1].body).tripId).toBe('wz_abc123_bbbbbbbbbbbbbbbb');
});
