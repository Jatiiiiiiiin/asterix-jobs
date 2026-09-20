import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase config is loaded from VITE_FIREBASE_* environment variables.
// Set these in .env.local for local dev, and in Vercel/hosting dashboard for production.
// NEVER hardcode these values in source — use environment variables instead.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB5eoWgef1xBy9ZSdCX4UZtqCEFDYDp0xw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "asterix-find.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "asterix-find",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "asterix-find.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1061504941512",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1061504941512:web:ec4755f40f5b3fc37094fd",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-RB0W99G85Y",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const linkedinProvider = new OAuthProvider('linkedin.com');

