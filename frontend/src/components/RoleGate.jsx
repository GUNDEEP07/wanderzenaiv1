import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

const ROLE_LANDING = {
  superadmin: '/admin',
  admin:      '/admin',
  support:    '/admin',
  agency:     '/agency',
  user:       '/dashboard',
};

export function RoleGate({ requiredRoles, children, fallback = null }) {
  const { currentUser, userRoles, loading, primaryRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!currentUser) { navigate('/login'); return; }
    if (requiredRoles && !requiredRoles.some(r => userRoles.includes(r))) {
      navigate(ROLE_LANDING[primaryRole] || '/dashboard');
    }
  }, [loading, currentUser, userRoles]);

  if (loading || !currentUser) return fallback;
  if (requiredRoles && !requiredRoles.some(r => userRoles.includes(r))) return fallback;
  return children;
}

export { ROLE_LANDING };
