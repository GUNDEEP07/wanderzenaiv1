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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) {
      // Demo mode: not logged in by default, login buttons will set demo user
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          const res = await fetch(`${import.meta.env.VITE_API_URL}/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const d = await res.json();
            setUserRoles(d.roles || []);
          }
        } catch { /* graceful */ }
      } else {
        setUserRoles([]);
      }
      setLoading(false);
    });
    return unsub;
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
      currentUser, loading,
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
