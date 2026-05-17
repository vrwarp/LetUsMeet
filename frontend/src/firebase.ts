import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-letusmeet",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app-id-placeholder",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-letusmeet.firebasestorage.app",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key-placeholder-for-emulator-testing",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-letusmeet.firebaseapp.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MEASUREMENT-ID-PLACEHOLDER",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const useEmulator = import.meta.env.DEV || isLocalhost;

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    experimentalForceLongPolling: useEmulator, // Only force in dev/test for stability
  });
} catch (e) {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const functions = getFunctions(app);

// Connect to emulators if in development OR if running on localhost (common for E2E tests)
if (useEmulator) {
  console.log("🔥 Connecting to Firebase Emulators...");
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8081);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

if (typeof window !== 'undefined') {
  (window as any).firebaseAuth = auth;
}
