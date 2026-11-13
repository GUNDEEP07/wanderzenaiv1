import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { RoleGate } from '../components/RoleGate';

let fire; // the onAuthStateChanged callback
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, cb) => { fire = cb; return () => {}; },
  signInWithPopup: jest.fn(), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(), sendPasswordResetEmail: jest.fn(),
}));
jest.mock('../firebase', () => ({ auth: {}, googleProvider: {}, FIREBASE_CONFIGURED: true }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const user = { uid: 'u1', email: 'a@example.com', getIdToken: async () => 'tok' };
let resolveProfile;
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() => new Promise(r => { resolveProfile = (roles) => r({ ok: true, json: async () => ({ roles }) }); }));
});

function Page() {
  const { currentUser, rolesLoading } = useAuth();
  return <div>page for {currentUser?.email || 'guest'} {rolesLoading ? '(roles loading)' : '(roles ready)'}</div>;
}

test('nothing renders until we know who is signed in (~0.5 s), then the page shows at once', async () => {
  render(<AuthProvider><Page /></AuthProvider>);
  expect(screen.queryByText(/page for/)).toBeNull();
  await act(async () => { await fire(null); });
  expect(screen.getByText('page for guest (roles ready)')).toBeInTheDocument();
});

test('signed in: the page shows before the slow /profile call returns', async () => {
  render(<AuthProvider><Page /></AuthProvider>);
  await act(async () => { fire(user); await Promise.resolve(); });
  expect(screen.getByText('page for a@example.com (roles loading)')).toBeInTheDocument();
  await act(async () => { resolveProfile(['user']); await Promise.resolve(); await Promise.resolve(); });
  expect(screen.getByText('page for a@example.com (roles ready)')).toBeInTheDocument();
});

test('admin pages (RoleGate) still wait for roles, then let an admin in', async () => {
  render(<AuthProvider><RoleGate requiredRoles={['admin']}><div>admin area</div></RoleGate></AuthProvider>);
  await act(async () => { fire(user); await Promise.resolve(); });
  expect(screen.queryByText('admin area')).toBeNull();
  expect(mockNavigate).not.toHaveBeenCalled(); // not bounced while roles load
  await act(async () => { resolveProfile(['admin']); await Promise.resolve(); await Promise.resolve(); });
  expect(screen.getByText('admin area')).toBeInTheDocument();
});

test('a non-admin is sent away only once roles are known', async () => {
  render(<AuthProvider><RoleGate requiredRoles={['admin']}><div>admin area</div></RoleGate></AuthProvider>);
  await act(async () => { fire(user); await Promise.resolve(); });
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => { resolveProfile(['user']); await Promise.resolve(); await Promise.resolve(); });
  expect(screen.queryByText('admin area')).toBeNull();
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
});
