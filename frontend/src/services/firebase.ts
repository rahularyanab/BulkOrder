// Firebase configuration for SaudaSetu
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyACSSOxF4v2SBs_SxJFzRT-HmfdHGGrrq8",
  authDomain: "saudasetu-4e804.firebaseapp.com",
  projectId: "saudasetu-4e804",
  storageBucket: "saudasetu-4e804.firebasestorage.app",
  messagingSenderId: "710262795734",
  appId: "1:710262795734:android:e4d5d64f266bf740e8c877"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// For development/testing - disable app verification
// Remove this in production
if (typeof window !== 'undefined') {
  // @ts-ignore
  auth.settings.appVerificationDisabledForTesting = false;
}

export { auth, RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential };
export default app;
