import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  projectId: "letusmeet-6f4e1",
  appId: "1:976624737612:web:07ec0031febed7525143e9",
  storageBucket: "letusmeet-6f4e1.firebasestorage.app",
  apiKey: "AIzaSyCyJLyVaBjTdrIYpeDTYjQwTex8ZenCgPM",
  authDomain: "letusmeet-6f4e1.firebaseapp.com",
  messagingSenderId: "976624737612",
  measurementId: "G-LQV7KN20WJ",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch (e) {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const functions = getFunctions(app);

// Connect to emulators if in development OR if running on localhost (common for E2E tests)
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (import.meta.env.DEV || isLocalhost) {
  console.log("🔥 Connecting to Firebase Emulators...");
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8081);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
