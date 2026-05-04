import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
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
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099");
  connectFirestoreEmulator(db, "127.0.0.1", 8081);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
