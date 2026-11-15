import { render, screen, fireEvent } from '@testing-library/react';
import StepReview, { entitlementLine, limitMessage, reviewAction } from './StepReview';

jest.mock('../../api/itinerary', () => ({ fetchPreview: jest.fn(async () => ({ days: [{ day: 1, theme: 'Arrive', vibe: 'slow' }] })) }));

const form = {
  destinations: [{ name: 'Vietnam' }], days: 5, travelPace: 'balanced', travelDate: '2026-12-25', travelDateEnd: '2026-12-29',
  tripPrefs: { adults: 2, kids: [] }, budget: '3000', currency: 'AUD', budgetScope: 'full-trip',
  route: { bases: [{ name: 'Da Nang', days: 2, stayType: 'beach guesthouse' }, { name: 'Hoi An', days: 3, stayType: 'garden homestay' }] },
  selected_venues: { version: 2, picks: [{ name: 'My Khe Beach', day: 1 }, { name: 'Bé Mặn', day: 1 }, { name: 'Marble Mountains', day: 2 }, { name: 'Tailor', day: null }], interests: [] },
};
const base = { form, set: jest.fn(), onEditStep: jest.fn(), submitError: '', accountEmail: 'a@example.com' };

test('entitlementLine / limitMessage', () => {
  expect(entitlementLine({ allowed: true, source: 'free', remaining: 1 })).toMatch(/free itinerary/);
  expect(entitlementLine({ allowed: true, source: 'credit', remaining: 3 })).toBe('Uses 1 of your 3 itinerary credits.');
  expect(entitlementLine({ allowed: true, source: 'credit', remaining: 1 })).toMatch(/last itinerary credit/);
  expect(entitlementLine({ allowed: true, source: 'monthly', remaining: 4 })).toMatch(/4 Wanderer itineraries left/);
  expect(entitlementLine({ allowed: true, source: 'test', remaining: null })).toBeNull();
  expect(entitlementLine(null)).toBeNull();
  expect(limitMessage({ allowed: false, code: 'MONTHLY_LIMIT_REACHED' })).toMatch(/billing date/);
  expect(limitMessage({ allowed: false, code: 'FREE_TIER_EXHAUSTED' })).toMatch(/free itinerary/);
  expect(limitMessage({ allowed: true })).toBeNull();
});

test('reviewAction picks the footer button', () => {
  expect(reviewAction({ signedIn: false })).toEqual({ label: 'Create free account', kind: 'signup' });
  expect(reviewAction({ signedIn: true, entitlement: { allowed: false, code: 'FREE_TIER_EXHAUSTED' } }).kind).toBe('plans');
  expect(reviewAction({ signedIn: true, entitlement: { allowed: true } })).toEqual({ label: 'Create my itinerary', kind: 'submit' });
  expect(reviewAction({ signedIn: true, entitlement: null, submitting: true }).label).toBe('Creating…');
});

test('summarises every step, with Edit links back to each', async () => {
  render(<StepReview {...base} />);
  expect(await screen.findByText('Arrive')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Trip' })).toHaveTextContent('Vietnam · 5 days · Fri 25 Dec – Tue 29 Dec');
  expect(screen.getByRole('region', { name: 'Trip' })).toHaveTextContent('2 adults · Balanced pace · AUD 3,000 whole trip');
  expect(screen.getByRole('region', { name: 'Route' })).toHaveTextContent('Da Nang (days 1–2) → Hoi An (days 3–5)');
  expect(screen.getByRole('region', { name: 'Your days' })).toHaveTextContent('Day 1My Khe Beach, Bé Mặn');
  expect(screen.getByRole('region', { name: 'Your days' })).toHaveTextContent('Any dayTailor');
  expect(screen.getByRole('region', { name: 'Stays' })).toHaveTextContent('beach guesthouse (Da Nang) · garden homestay (Hoi An)');
  fireEvent.click(screen.getByRole('button', { name: 'Edit your days' }));
  expect(base.onEditStep).toHaveBeenCalledWith(2);
  // Nothing new is asked here: no travel-style or pace pickers.
  expect(screen.queryByText('Travel style')).toBeNull();
  expect(screen.queryByRole('button', { name: /Relaxed|Packed/ })).toBeNull();
});

test('guests see the free-account prompt (the footer button signs them up)', async () => {
  const onSignIn = jest.fn();
  render(<StepReview {...base} signedIn={false} onSignIn={onSignIn} />);
  expect(await screen.findByTestId('signin-gate')).toHaveTextContent(/first itinerary is free/);
  expect(screen.queryByText(/a@example.com/)).toBeNull();
  fireEvent.click(screen.getByText('I already have an account'));
  expect(onSignIn).toHaveBeenCalled();
});

test('signed in: what it uses; none left: told before Submit', async () => {
  const { unmount } = render(<StepReview {...base} entitlement={{ allowed: true, source: 'credit', remaining: 2 }} />);
  expect(await screen.findByText(/Uses 1 of your 2 itinerary credits/)).toBeInTheDocument();
  unmount();
  render(<StepReview {...base} entitlement={{ allowed: false, code: 'FREE_TIER_EXHAUSTED', remaining: 0 }} />);
  expect(await screen.findByText(/used this month's free itinerary/)).toBeInTheDocument();
});
