import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, getFirestore } from "firebase/firestore";
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

import { initializeZK } from "charproof";
import { MockPrfProvider } from "./lib/testing/mockPrfProvider";

// Injected at build time by Vite (`define` in vite.config.ts). `true` only for
// E2E builds; `false` in production so the test-hook branch below is eliminated.
declare const __E2E_HOOKS__: boolean;


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const isLocalhost = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const useEmulator = import.meta.env.DEV || isLocalhost;

// WebKit + the Firestore emulator: when BOTH autoDetectLongPolling and forceLongPolling
// are enabled, the auto-detect probing breaks the WebChannel stream on WebKit so that
// every getDoc/setDoc waits ~30s for its stream ack to arrive — making the E2E suite
// unusably slow/flaky. Forcing long-polling with auto-detect OFF and a short poll cycle
// makes acks arrive immediately. Scoped to the emulator so production Safari is unaffected.
// See docs/webkit-investigation.md.
const isWebKitUA = typeof navigator !== 'undefined'
  && /WebKit/.test(navigator.userAgent)
  && !/Firefox/.test(navigator.userAgent)
  && !/Chrome/.test(navigator.userAgent);

let dbInstance;
try {
  const firestoreSettings = (isWebKitUA && useEmulator)
    ? {
        experimentalAutoDetectLongPolling: false,
        experimentalForceLongPolling: true,
        experimentalLongPollingOptions: { timeoutSeconds: 5 },
      }
    : {
        experimentalAutoDetectLongPolling: true,
        experimentalForceLongPolling: useEmulator,
      };
  dbInstance = initializeFirestore(app, firestoreSettings);
} catch (e) {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const functions = getFunctions(app);

// Initialize Zero-Knowledge Library.
//
// charproof always runs the real WebCrypto provider. The only exception is E2E on
// WebKit/Firefox, which can't use a real/virtual WebAuthn authenticator: when the
// E2E build flag is set AND the harness opts in at runtime, we inject charproof's
// supported `prfProvider` override with a device-scoped mock. `__E2E_HOOKS__` is a
// compile-time constant (false in production), so this entire branch — and the
// MockPrfProvider import — is dead-code-eliminated from production builds. There is
// no runtime mock switch shipped to users.
const useMockPrf =
  __E2E_HOOKS__ &&
  typeof window !== "undefined" &&
  (window as Window & { __E2E_MOCK_PRF__?: string }).__E2E_MOCK_PRF__ === "true";

initializeZK(useMockPrf ? { db, auth, prfProvider: new MockPrfProvider() } : { db, auth });


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
