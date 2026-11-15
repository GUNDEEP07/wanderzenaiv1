import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SiteHeader from './SiteHeader';

let mockUser = null;
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));

const renderIt = () => render(<MemoryRouter><SiteHeader /></MemoryRouter>);

test('logo and Home always go home; guests get Sign in', () => {
  mockUser = null;
  renderIt();
  expect(screen.getByRole('link', { name: 'WanderZenAI home' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: 'Plan a trip' })).toHaveAttribute('href', '/plan');
});

test('signed in: Dashboard instead of Sign in', () => {
  mockUser = { uid: 'u1' };
  renderIt();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard');
  expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
});
