import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as any).url || 'unknown';
    const start = performance.now();
    
    // Check if this is a Firestore emulator Listen Channel request
    const isFirestoreListenChannel = url.includes('/Listen/channel');
    
    if (isFirestoreListenChannel) {
      // Enforce 5-second timeout for emulator stream listeners to self-heal WebKit network queue locks
      const controller = new AbortController();
      const signal = controller.signal;
      
      const timeoutId = setTimeout(() => {
        console.warn(`⏱️ [Timeout] Aborting Firestore Listen Channel stream after 5 seconds: ${url}`);
        controller.abort();
      }, 5000);
      
      const options = args[1] || {};
      (options as any).signal = signal;
      args[1] = options;
      
      try {
        const response = await originalFetch.apply(this, args);
        clearTimeout(timeoutId);
        console.log(`🌐 [Fetch] ${url} resolved in ${(performance.now() - start).toFixed(2)}ms with status ${response.status}`);
        return response;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          console.error(`🌐 [Fetch] ${url} aborted (5s timeout)`);
          throw new TypeError('Failed to fetch'); // Fallback trigger
        }
        console.error(`🌐 [Fetch] ${url} failed in ${(performance.now() - start).toFixed(2)}ms`, err);
        throw err;
      }
    }

    try {
      const response = await originalFetch.apply(this, args);
      return response;
    } catch (err) {
      console.error(`🌐 [Fetch] ${url} failed in ${(performance.now() - start).toFixed(2)}ms`, err);
      throw err;
    }
  };
}

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-letusmeet",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo-app-id-placeholder",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-letusmeet.firebasestorage.app",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key-placeholder-for-emulator-testing",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-letusmeet.firebaseapp.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MEASUREMENT-ID-PLACEHOLDER",
};

import { initializeZK } from "charproof";
import { setupMockZkStorage } from "./lib/mockZkStorage";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const useEmulator = import.meta.env.DEV || isLocalhost;

let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    experimentalForceLongPolling: false,
  });
} catch (e) {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const functions = getFunctions(app);

// Initialize Zero-Knowledge Library
initializeZK({ db, auth });

if (typeof window !== 'undefined') {
  let mockZkVal = (window as any).__MOCK_ZK;
  if (mockZkVal === 'true') {
    setupMockZkStorage();
  }
  Object.defineProperty(window, '__MOCK_ZK', {
    get() {
      return mockZkVal;
    },
    set(val) {
      mockZkVal = val;
      if (val === 'true') {
        setupMockZkStorage();
      }
    },
    configurable: true
  });
}

if (useEmulator) {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  console.log(`🔥 Connecting to Firebase Emulators on ${host}...`);
  connectAuthEmulator(auth, `http://${host}:9099`);
  connectFirestoreEmulator(db, host, 8081);
  connectFunctionsEmulator(functions, host, 5001);
}

if (typeof window !== 'undefined') {
  (window as any).firebaseAuth = auth;
}
