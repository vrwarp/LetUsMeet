import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";
import { setCryptoProvider } from "./core/crypto";
import { WebCryptoProvider } from "./browser/WebCryptoProvider";

let db: Firestore | null = null;
let auth: Auth | null = null;

export function initializeZK(config: { db: Firestore; auth: Auth }) {
  db = config.db;
  auth = config.auth;
  // Automatically initialize browser-based WebCryptoProvider
  setCryptoProvider(new WebCryptoProvider());
}

export function getDb(): Firestore {
  if (!db) {
    throw new Error("ZeroKnowledge library has not been initialized. Call initializeZK({ db, auth }) first.");
  }
  return db;
}

export function getAuth(): Auth {
  if (!auth) {
    throw new Error("ZeroKnowledge library has not been initialized. Call initializeZK({ db, auth }) first.");
  }
  return auth;
}
