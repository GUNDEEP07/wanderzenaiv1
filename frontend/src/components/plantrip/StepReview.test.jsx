import { render, screen, fireEvent } from '@testing-library/react';
import StepReview, { entitlementLine, limitMessage } from './StepReview';

jest.mock('../../api/itinerary', () => ({ fetchPreview: jest.fn(async () => ({ days: [{ day: 1, theme: 'Arrive', vibe: 'slow' }] })) }));

const form = { destinations: [{ name: 'Peru' }], days: 5, travelStyle: [], travelPace: 'balanced', selected_venues: null };
const base = { form, set: jest.fn(), onBack: jest.fn(), onSubmit: jest.fn(), submitting: false, submitError: '', accountEmail: 'a@example.com' };

test('entitlementLine says what Submit will use', () => {
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

test('guests see the free-account prompt instead of Generate', async () => {
  const onSignUp = jest.fn(); const onSignIn = jest.fn();
  render(<StepReview {...base} signedIn={false} onSignUp={onSignUp} onSignIn={onSignIn} />);
  expect(await screen.findByTestId('signin-gate')).toHaveTextContent(/first itinerary is free/);
  expect(screen.queryByText(/Generate full itinerary/)).toBeNull();
  expect(screen.queryByText(/a@example.com/)).toBeNull();
  fireEvent.click(screen.getByText('Create free account →'));
  fireEvent.click(screen.getByText('I have an account'));
  expect(onSignUp).toHaveBeenCalled();
  expect(onSignIn).toHaveBeenCalled();
});

test('signed in with credits: Generate, plus what it uses', async () => {
  render(<StepReview {...base} entitlement={{ allowed: true, source: 'credit', remaining: 2 }} />);
  expect(await screen.findByText(/Uses 1 of your 2 itinerary credits/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Generate full itinerary →'));
  expect(base.onSubmit).toHaveBeenCalled();
});

test('signed in with none left: told before Submit, offered plans', async () => {
  const onSeePlans = jest.fn();
  render(<StepReview {...base} entitlement={{ allowed: false, code: 'FREE_TIER_EXHAUSTED', remaining: 0 }} onSeePlans={onSeePlans} />);
  expect(await screen.findByRole('status')).toHaveTextContent(/used this month's free itinerary/);
  expect(screen.queryByText(/Generate full itinerary/)).toBeNull();
  fireEvent.click(screen.getByText('See plans →'));
  expect(onSeePlans).toHaveBeenCalled();
});

test('entitlement unknown (check failed): behaves as before', async () => {
  render(<StepReview {...base} entitlement={null} />);
  expect(await screen.findByText('Generate full itinerary →')).toBeInTheDocument();
});
