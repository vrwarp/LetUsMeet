import type { Firestore } from "firebase/firestore";
import type { Auth } from "firebase/auth";

let db: Firestore | null = null;
let auth: Auth | null = null;

export function initializeZK(config: { db: Firestore; auth: Auth }) {
  db = config.db;
  auth = config.auth;
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
