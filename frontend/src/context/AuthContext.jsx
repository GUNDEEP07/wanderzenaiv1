import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut as fbSignOut,
  onAuthStateChanged, sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, googleProvider, FIREBASE_CONFIGURED } from '../firebase';

const AuthContext = createContext(null);

// Demo user shown when Firebase is not yet configured
const DEMO_USER = {
  uid: 'demo-uid',
  email: 'demo@wanderzenai.com',
  displayName: 'Demo User',
  photoURL: null,
  getIdToken: async () => 'demo-token',
};

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  // `loading`: is anyone signed in? Known in ~0.5 s, and the app renders as soon as it is.
  // `rolesLoading`: roles come from GET /profile, which can take seconds on a cold start —
  // only RoleGate (admin/agency pages) waits for them. (Nov 2026: pages used to wait for
  // /profile before showing anything — 2–8 s blank screen for signed-in users.)
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) {
      // Demo mode: not logged in by default, login buttons will set demo user
      setLoading(false);
      setRolesLoading(false);
      return;
    }
    let controller = new AbortController();
    const unsub = onAuthStateChanged(auth, async (user) => {
      controller.abort();
      controller = new AbortController();
      setCurrentUser(user);
      setLoading(false); // render now; roles follow
      if (!user) {
        setUserRoles([]);
        setRolesLoading(false);
        return;
      }
      setRolesLoading(true);
      const { signal } = controller;
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${import.meta.env.VITE_API_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        if (res.ok) {
          const d = await res.json();
          if (!signal.aborted) setUserRoles(d.roles || []);
        }
      } catch { /* graceful — includes AbortError on sign-out */ }
      if (!signal.aborted) setRolesLoading(false);
    });
    return () => { unsub(); controller.abort(); };
  }, []);

  const signInWithGoogle = async () => {
    if (!FIREBASE_CONFIGURED) { setCurrentUser(DEMO_USER); return; }
    return signInWithPopup(auth, googleProvider);
  };

  const signInWithEmail = async (email, password) => {
    if (!FIREBASE_CONFIGURED) { setCurrentUser({ ...DEMO_USER, email, displayName: email.split('@')[0] }); return; }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email, password) => {
    if (!FIREBASE_CONFIGURED) { setCurrentUser({ ...DEMO_USER, email, displayName: email.split('@')[0] }); return; }
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    if (!FIREBASE_CONFIGURED) { setCurrentUser(null); return; }
    return fbSignOut(auth);
  };

  const resetPassword = (email) => {
    if (!FIREBASE_CONFIGURED) return Promise.resolve();
    return sendPasswordResetEmail(auth, email);
  };

  const getIdToken = async () => {
    if (!currentUser) return null;
    if (!FIREBASE_CONFIGURED) return 'demo-token';
    return currentUser.getIdToken();
  };

  const ROLE_PRIORITY = { superadmin: 5, admin: 4, agency: 3, support: 2, user: 1 };
  const hasRole = (role) => userRoles.includes(role);
  const primaryRole = userRoles.reduce(
    (best, r) => (ROLE_PRIORITY[r] || 0) > (ROLE_PRIORITY[best] || 0) ? r : best,
    'user'
  );

  return (
    <AuthContext.Provider value={{
      currentUser, loading, rolesLoading,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, resetPassword, getIdToken,
      isDemo: !FIREBASE_CONFIGURED,
      userRoles, hasRole, primaryRole,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
