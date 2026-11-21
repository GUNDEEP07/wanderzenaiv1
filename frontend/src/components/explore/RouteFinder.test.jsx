import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RouteFinder from './RouteFinder';

jest.mock('../PhotoCredit', () => ({ CreditedPhoto: ({ keyword, alt }) => <img alt={alt} data-q={keyword} /> }));

function PlanProbe() {
  const { state } = useLocation();
  return <div data-testid="plan">{JSON.stringify(state?.prefill)}</div>;
}
const renderAt = (el) => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={el} />
      <Route path="/plan" element={<PlanProbe />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('wz_origin', 'sydney');
  jest.useFakeTimers().setSystemTime(new Date('2026-11-16T10:00:00+11:00'));
});
afterEach(() => jest.useRealTimers());



test('explore: defaults to this month, filters by kids and travel day', () => {
  renderAt(<RouteFinder />);
  expect(screen.getByRole('button', { name: 'Nov (now)' })).toHaveAttribute('aria-pressed', 'true');
  const count = () => Number(screen.getByText(/Asia routes match/).textContent.match(/^(\d+)/)[1]);
  const inNov = count();
  expect(inNov).toBeGreaterThanOrEqual(5);
  fireEvent.click(screen.getByRole('button', { name: 'Any month' }));
  expect(count()).toBe(21);
  fireEvent.click(screen.getByRole('button', { name: 'Show all routes' }));
  const kids = count();
  expect(kids).toBeLessThan(21);
  fireEvent.click(screen.getByRole('button', { name: 'Under 3 h' }));
  expect(count()).toBeLessThanOrEqual(kids);
  fireEvent.click(screen.getAllByRole('button', { name: /^Plan / })[0]);
  expect(JSON.parse(screen.getByTestId('plan').textContent).preferRouteId).toBeTruthy();
});
