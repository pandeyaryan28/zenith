import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCDZzFuWs6XMDR0Gwsz4-1nHFe_wnFLIoE",
  authDomain: "zenith-ap28-2026.firebaseapp.com",
  projectId: "zenith-ap28-2026",
  storageBucket: "zenith-ap28-2026.firebasestorage.app",
  messagingSenderId: "595101892863",
  appId: "1:595101892863:web:afebdfee36b452bdc68cca"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Configure Google Auth Provider with Scopes for Tasks and Calendar
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/tasks');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleProvider.addScope('https://www.googleapis.com/auth/calendar');

// Google Sign-In helper
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;
    
    if (token) {
      // Store OAuth access token for Google API calls
      localStorage.setItem('google_oauth_token', token);
      localStorage.setItem('google_oauth_token_expiry', (Date.now() + 3500 * 1000).toString()); // Tokens last 1 hour
    }
    
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};

// Sign-out helper
export const signOutUser = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('google_oauth_token');
    localStorage.removeItem('google_oauth_token_expiry');
  } catch (error) {
    console.error("Sign-Out Error:", error);
    throw error;
  }
};

export default app;
