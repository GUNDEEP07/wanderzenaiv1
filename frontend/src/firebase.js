import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey:      import.meta.env.VITE_FIREBASE_API_KEY     || '',
  authDomain:  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN  || '',
  projectId:   import.meta.env.VITE_FIREBASE_PROJECT_ID   || '',
};

// Only initialise if config is present
const FIREBASE_CONFIGURED = !!firebaseConfig.apiKey;

export const auth = FIREBASE_CONFIGURED ? getAuth(initializeApp(firebaseConfig)) : null;
export const googleProvider = FIREBASE_CONFIGURED ? new GoogleAuthProvider() : null;
export { FIREBASE_CONFIGURED };
