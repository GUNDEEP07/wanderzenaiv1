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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) {
      // Demo mode: not logged in by default, login buttons will set demo user
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
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

  return (
    <AuthContext.Provider value={{
      currentUser, loading,
      signInWithGoogle, signInWithEmail, signUpWithEmail,
      signOut, resetPassword, getIdToken,
      isDemo: !FIREBASE_CONFIGURED,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
