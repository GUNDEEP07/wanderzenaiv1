import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import SeasonHero from './SeasonHero';
import RouteFinder from '../explore/RouteFinder';

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

test('home: November from Sydney leads with an in-season country and plans the shown route', () => {
  renderAt(<SeasonHero />);
  const chips = screen.getAllByRole('button', { pressed: true });
  expect(chips[0]).toHaveTextContent(/good in Nov/);
  expect(screen.getByRole('heading', { name: 'Where do you want to slow down?' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Vietnam/ }));
  // Vietnam in Nov: the north (Ninh Binh) is in season and goes first; its checked photo shows
  expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('The north, slowly');
  expect(document.querySelector('img[data-q="Ninh Binh, Vietnam"]')).not.toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Central coast, easy pace' }));
  expect(screen.getByText(/Best Feb–Aug/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Plan this route, free' }));
  const prefill = JSON.parse(screen.getByTestId('plan').textContent);
  expect(prefill).toMatchObject({ preferRouteId: 'vn-central-easy', days: 9 });
  expect(prefill.destinations[0]).toMatchObject({ name: 'Vietnam', isCountry: true });
});

test('home: changing where you plan from re-orders and is remembered', () => {
  renderAt(<SeasonHero />);
  fireEvent.change(screen.getByLabelText('Planning from'), { target: { value: 'london' } });
  expect(localStorage.getItem('wz_origin')).toBe('london');
  expect(screen.getByText(/closest to London/)).toBeInTheDocument();
});

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
