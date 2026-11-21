import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Landing, { homePicks } from './Landing';
import { ORIGINS, LIVE_COUNTRIES } from '../utils/seasons';

jest.mock('../components/PhotoCredit', () => ({ CreditedPhoto: ({ keyword, alt }) => <img alt={alt} data-q={keyword} /> }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../hooks/usePricing', () => ({
  usePricing: () => ({ loading: false, trip: { plan: 'trip', name: 'One trip', trips: 1, currency: 'AUD', amount: 19, url: 'https://buy.stripe.com/t' }, pass: { plan: 'pass', name: 'Trip Pass', trips: 6, validDays: 365, currency: 'AUD', amount: 59, url: 'https://buy.stripe.com/p' } }),
  passTerm: (p) => `${p.trips} trips · use within 12 months`,
}));

function PlanProbe() {
  const { state } = useLocation();
  return <div data-testid="plan">{JSON.stringify(state?.prefill || null)}</div>;
}
const renderHome = () => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes><Route path="/" element={<Landing />} /><Route path="/plan" element={<PlanProbe />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('wz_origin', 'sydney');
  jest.useFakeTimers().setSystemTime(new Date('2026-11-22T10:00:00+11:00'));
});
afterEach(() => jest.useRealTimers());

test('first screen says what we do, region-neutral, with one main action', () => {
  renderHome();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your slow-travel plan, written day by day.');
  expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/Asia/);
  expect(screen.getAllByRole('button', { name: 'Plan my trip, free' }).length).toBeGreaterThanOrEqual(1);
  expect(screen.queryByText(/Why I built this/)).toBeNull();
});

test('picks come from live regions, in season this month, closest first, and plan that route', () => {
  const sydney = ORIGINS.find(o => o.id === 'sydney');
  const picks = homePicks(sydney, 11);
  expect(picks).toHaveLength(3);
  picks.forEach(p => expect(LIVE_COUNTRIES).toContain(p.country));
  expect(picks.every(p => p.good)).toBe(true);
  renderHome();
  const where = screen.getByRole('heading', { name: 'Not sure where yet?' }).closest('section');
  expect(within(where).getByText(/At their best in November/)).toBeInTheDocument();
  fireEvent.click(within(where).getAllByRole('button', { name: /^Plan / })[0]);
  const prefill = JSON.parse(screen.getByTestId('plan').textContent);
  expect(prefill.preferRouteId).toBe(picks[0].route.id);
});

test('changing the city re-orders and is remembered', () => {
  renderHome();
  fireEvent.change(screen.getByLabelText('Planning from'), { target: { value: 'london' } });
  expect(localStorage.getItem('wz_origin')).toBe('london');
});

test('prices from Stripe with the currency; menu opens on phones', () => {
  renderHome();
  const price = screen.getByRole('heading', { name: 'Try it free. Pay per trip.' }).closest('section');
  expect(price).toHaveTextContent('A$19 AUD');
  expect(price).toHaveTextContent('A$59 AUD');
  const menu = screen.getByRole('button', { name: 'Menu' });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
});
