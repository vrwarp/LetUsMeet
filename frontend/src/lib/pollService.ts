import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  where,
  limit,
  writeBatch,
  getDoc
} from "firebase/firestore";
import { db, auth } from "../firebase";
import type { 
  BlindPoll, 
  BlindEvent, 
  DecryptedSignedEvent, 
  PollState, 
  PollMetadata, 
  PollAction,
  KeystoreEntry,
  DecryptedKeystorePayload
} from "../types";
import { 
  generateSymmetricKey, 
  exportSymmetricKey, 
  importSymmetricKey, 
  encrypt, 
  decrypt, 
  generateIdentityKeyPair, 
  exportPrivateKey, 
  exportPublicKey, 
  signAction,
  importPrivateKey,
  importPublicKey
} from "./crypto";
import { calculatePollState } from "./pollReducer";

/**
 * Fallback for crypto.randomUUID() if not available.
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
}

// === FRAGMENT HANDLING ===

export function extractKeyFromFragment(): string | null {
  const hash = window.location.hash;
  const match = hash.match(/key=([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export function setKeyInFragment(key: string) {
  window.location.hash = `key=${key}`;
}

// === INDEXED DB (Anonymous Identity Storage) ===

const DB_NAME = "LetUsMeet_Keys";
const DB_VERSION = 2;
const STORE_IDENTITIES = "identities";
const STORE_MASTER_KEYS = "master_keys";

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_IDENTITIES)) {
        db.createObjectStore(STORE_IDENTITIES);
      }
      if (!db.objectStoreNames.contains(STORE_MASTER_KEYS)) {
        db.createObjectStore(STORE_MASTER_KEYS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToIndexedDB(pollId: string, keys: { privateKey: string, publicKey: string }) {
  const db = await openDB();
  const tx = db.transaction(STORE_IDENTITIES, "readwrite");
  tx.objectStore(STORE_IDENTITIES).put(keys, pollId);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFromIndexedDB(pollId: string): Promise<{ privateKey: string, publicKey: string } | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_IDENTITIES, "readonly");
  const request = tx.objectStore(STORE_IDENTITIES).get(pollId);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// === WEBAUTHN PRF (Master Key) ===

async function saveMasterKeyToIndexedDB(uid: string, key: CryptoKey) {
  const db = await openDB();
  const tx = db.transaction(STORE_MASTER_KEYS, "readwrite");
  tx.objectStore(STORE_MASTER_KEYS).put(key, uid);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

async function loadMasterKeyFromIndexedDB(uid: string): Promise<CryptoKey | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_MASTER_KEYS, "readonly");
  const request = tx.objectStore(STORE_MASTER_KEYS).get(uid);
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

/**
 * Derives a 256-bit transient master key using WebAuthn PRF extension.
 */
let prfPromise: Promise<CryptoKey> | null = null;

export async function derivePrfMasterKey(): Promise<CryptoKey> {
  if (prfPromise) return prfPromise;

  prfPromise = (async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Must be signed in to derive PRF key.");

      // 1. Check IndexedDB Cache
      const cachedKey = await loadMasterKeyFromIndexedDB(user.uid);
      if (cachedKey) return cachedKey;

      // 2. Browser Support Check
      const isPrfSupported = (window.PublicKeyCredential as any)?.isConditionalMediationAvailable;
      if (!isPrfSupported) {
        throw new Error("WebAuthn PRF not supported on this browser.");
      }

      const storageKey = `prf_cred_${user.uid}`;
      let credentialId = localStorage.getItem(storageKey);

      if (!credentialId) {
        // Registration Flow
        const challenge = window.crypto.getRandomValues(new Uint8Array(32));
        const createOptions: CredentialCreationOptions = {
          publicKey: {
            challenge,
            rp: { name: "LetUsMeet" },
            user: {
              id: new TextEncoder().encode(user.uid),
              name: user.email || user.uid,
              displayName: user.displayName || user.uid
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" },    // ES256
              { alg: -257, type: "public-key" }   // RS256
            ],
            authenticatorSelection: { userVerification: "required" },
            extensions: {
              prf: { eval: { first: new TextEncoder().encode("LetUsMeet-PRF-Salt-v1") } }
            } as any
          }
        };

        const credential = (await navigator.credentials.create(createOptions)) as any;
        if (!credential) throw new Error("Failed to create PRF credential.");
        
        credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        localStorage.setItem(storageKey, credentialId);
      }

      // Evaluation Flow
      const getOptions: CredentialRequestOptions = {
        publicKey: {
          challenge: window.crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{
            id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
            type: "public-key"
          }],
          userVerification: "required",
          extensions: {
            prf: { eval: { first: new TextEncoder().encode("LetUsMeet-PRF-Salt-v1") } }
          } as any
        }
      };

      const assertion = (await navigator.credentials.get(getOptions)) as any;
      const results = assertion.getClientExtensionResults();
      
      if (!results.prf || !results.prf.results || !results.prf.results.first) {
        throw new Error("PRF evaluation failed or not supported by authenticator.");
      }

      const prfResult = new Uint8Array(results.prf.results.first);
      
      const masterKey = await window.crypto.subtle.importKey(
        "raw",
        prfResult.slice(0, 16),
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      // 3. Cache in IndexedDB for future use
      await saveMasterKeyToIndexedDB(user.uid, masterKey);
      
      return masterKey;
    } finally {
      prfPromise = null;
    }
  })();

  return prfPromise;
}

/**
 * Loads or initializes the Master Keystore Key (MKK).
 * The MKK is a static key used to encrypt all keystore entries.
 * It is itself stored in Firestore, wrapped (encrypted) by the transient PRF key.
 */
let mkkPromise: Promise<CryptoKey> | null = null;

export async function getMasterKeystoreKey(): Promise<CryptoKey> {
  if (mkkPromise) return mkkPromise;

  mkkPromise = (async () => {
    try {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) throw new Error("Must be signed in to access MKK.");

      const prfKey = await derivePrfMasterKey();
      const mkkRef = doc(db, "users", user.uid, "keystore", "mkk_wrapped");
      const snap = await getDoc(mkkRef);

      if (!snap.exists()) {
        // Initialize MKK
        const newMkk = await generateSymmetricKey();
        const rawMkk = await window.crypto.subtle.exportKey("raw", newMkk);
        const mkkString = btoa(String.fromCharCode(...new Uint8Array(rawMkk)));
        
        const { ciphertext, iv } = await encrypt(prfKey, mkkString);
        await setDoc(mkkRef, {
          wrappedKey: ciphertext,
          iv,
          createdAt: Date.now()
        });
        
        return newMkk;
      }

      const data = snap.data();
      const decryptedMkkString = await decrypt(prfKey, data.wrappedKey, data.iv);
      const rawMkk = Uint8Array.from(atob(decryptedMkkString), c => c.charCodeAt(0));
      
      return await window.crypto.subtle.importKey(
        "raw",
        rawMkk,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    } finally {
      // We don't nullify mkkPromise here so it stays cached for the session
    }
  })();

  return mkkPromise;
}

// === KEYSTORE (Authenticated Storage) ===

export async function saveToKeystore(pollId: string, payload: DecryptedKeystorePayload) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return; 

  const mkk = await getMasterKeystoreKey();
  const json = JSON.stringify(payload);
  const { ciphertext, iv } = await encrypt(mkk, json);

  const entryRef = doc(db, "users", user.uid, "keystore", pollId);
  await setDoc(entryRef, {
    pollId,
    wrappedPayload: ciphertext,
    iv,
    updatedAt: Date.now()
  });
}

export async function loadFromKeystore(pollId: string): Promise<DecryptedKeystorePayload | null> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;

  const entryRef = doc(db, "users", user.uid, "keystore", pollId);
  const snap = await getDoc(entryRef);
  if (!snap.exists()) return null;

  const data = snap.data() as KeystoreEntry;
  const mkk = await getMasterKeystoreKey();
  const json = await decrypt(mkk, data.wrappedPayload, data.iv);
  return JSON.parse(json);
}

export async function verifyMasterKey(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return true;

  try {
    // Attempting to get the MKK effectively verifies the PRF key
    await getMasterKeystoreKey();
    
    // Also verify the secondary nonce as a sanity check
    const mkk = await getMasterKeystoreKey();
    const verifyRef = doc(db, "users", user.uid, "keystore", "identity_verification");
    const snap = await getDoc(verifyRef);

    if (!snap.exists()) {
      const nonce = Math.random().toString(36).substring(2, 15);
      const { ciphertext, iv } = await encrypt(mkk, nonce);
      await setDoc(verifyRef, { ciphertext, iv, nonce, version: 1 });
      return true;
    }

    const data = snap.data();
    const decrypted = await decrypt(mkk, data.ciphertext, data.iv);
    return decrypted === data.nonce;
  } catch (e) {
    console.error("Master key verification failed:", e);
    return false;
  }
}

export async function resetKeystore() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const keystoreRef = collection(db, "users", user.uid, "keystore");
  const snap = await getDocs(keystoreRef);
  
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  // Also clear IndexedDB
  const request = indexedDB.open("LetUsMeet-Identities", 2); // DB_NAME/VERSION
  request.onsuccess = () => {
    const db = request.result;
    const tx = db.transaction(["identities", "master_keys"], "readwrite");
    tx.objectStore("identities").clear();
    tx.objectStore("master_keys").clear();
  };
}

// === LEDGER SERVICE ===

/**
 * Creates a new blind poll and its genesis event.
 */
export async function createBlindPoll(metadata: PollMetadata) {
  const pollId = generateId();
  const symmetricKey = await generateSymmetricKey();
  const keyPair = await generateIdentityKeyPair();
  
  const b64Key = await exportSymmetricKey(symmetricKey);
  const privB64 = await exportPrivateKey(keyPair.privateKey);
  const pubB64 = await exportPublicKey(keyPair.publicKey);

  // 1. Create poll doc (empty shell)
  await setDoc(doc(db, "polls", pollId), { pollId });

  // 2. Create genesis event
  const action: PollAction = { type: "POLL_CREATED", payload: metadata };
  await appendSignedEvent(pollId, symmetricKey, keyPair.privateKey, keyPair.publicKey, action);

  // 3. Save keys
  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    await saveToKeystore(pollId, {
      symmetricPollKey: b64Key,
      ecdsaPrivateKey: privB64,
      ecdsaPublicKey: pubB64
    });
  } else {
    await saveToIndexedDB(pollId, { privateKey: privB64, publicKey: pubB64 });
  }

  return { pollId, key: b64Key };
}

/**
 * Loads the user's identity (ECDSA keys) for a specific poll.
 * Checks Keystore first, then IndexedDB.
 */
export async function loadIdentity(pollId: string): Promise<{ privateKey: CryptoKey, publicKey: CryptoKey } | null> {
  let keys: { privateKey: string, publicKey: string } | null = null;
  
  const keystoreData = await loadFromKeystore(pollId);
  if (keystoreData) {
    keys = { privateKey: keystoreData.ecdsaPrivateKey, publicKey: keystoreData.ecdsaPublicKey };
  } else {
    keys = await loadFromIndexedDB(pollId);
  }

  if (!keys) return null;

  return {
    privateKey: await importPrivateKey(keys.privateKey),
    publicKey: await importPublicKey(keys.publicKey)
  };
}

/**
 * Appends a signed, encrypted event to the poll ledger.
 */
export async function appendSignedEvent(
  pollId: string,
  symmetricKey: CryptoKey,
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  action: PollAction
) {
  const signature = await signAction(privateKey, action);
  const pubB64 = await exportPublicKey(publicKey);
  
  const decryptedSignedEvent: DecryptedSignedEvent = {
    publicKey: pubB64,
    signature,
    action
  };

  const json = JSON.stringify(decryptedSignedEvent);
  const { ciphertext, iv } = await encrypt(symmetricKey, json);

  const eventId = generateId();
  const eventRef = doc(db, "polls", pollId, "events", eventId);
  
  await setDoc(eventRef, {
    eventId,
    createdAt: serverTimestamp(),
    encryptedData: ciphertext,
    iv
  });
}

/**
 * Subscribes to the poll ledger, decrypts and reduces it into UI state.
 */
export function subscribeToLedger(
  pollId: string,
  symmetricKey: CryptoKey,
  onUpdate: (state: PollState | null, status: string) => void
) {
  const eventsRef = collection(db, "polls", pollId, "events");
  const q = query(eventsRef, orderBy("createdAt", "asc"));

  return onSnapshot(q, async (snapshot) => {
    onUpdate(null, "Decrypting ledger...");
    
    const events: DecryptedSignedEvent[] = [];
    for (const doc of snapshot.docs) {
      try {
        const blind = doc.data() as BlindEvent;
        const json = await decrypt(symmetricKey, blind.encryptedData, blind.iv);
        events.push(JSON.parse(json));
      } catch (e) {
        console.warn("Failed to decrypt event", doc.id, e);
      }
    }

    if (events.length === 0) {
      onUpdate(null, "No valid events found.");
      return;
    }

    onUpdate(null, "Verifying signatures...");
    const state = await calculatePollState(events);
    onUpdate(state, "Syncing...");
  });
}

/**
 * Subscribes to the user's keystore to find polls they have access to.
 */
export function subscribeToUserKeystore(
  uid: string,
  onUpdate: (entries: KeystoreEntry[]) => void
) {
  const keystoreRef = collection(db, "users", uid, "keystore");
  const q = query(keystoreRef, orderBy("updatedAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => doc.data() as KeystoreEntry);
    onUpdate(entries);
  });
}

// === LEGACY STUBS (to prevent breakage during migration) ===

export async function submitVote() { throw new Error("Deprecated: Use appendSignedEvent"); }
export async function finalizePoll() { throw new Error("Deprecated: Use appendSignedEvent"); }
export async function updatePoll() { throw new Error("Deprecated: Use appendSignedEvent"); }
export function subscribeToPoll() { throw new Error("Deprecated: Use subscribeToLedger"); }
export function subscribeToUserPolls() { throw new Error("Deprecated: Use Keystore query"); }

/**
 * Fetches and decrypts the genesis event (POLL_CREATED) for a poll.
 */
export async function getGenesisEvent(pollId: string, symmetricKey: CryptoKey): Promise<PollMetadata | null> {
  const eventsRef = collection(db, "polls", pollId, "events");
  const q = query(eventsRef, orderBy("createdAt", "asc"), limit(1));
  const snap = await getDocs(q);
  
  if (snap.empty) return null;
  
  const blind = snap.docs[0].data() as BlindEvent;
  const json = await decrypt(symmetricKey, blind.encryptedData, blind.iv);
  const decrypted = JSON.parse(json);
  
  if (decrypted.action && decrypted.action.type === "POLL_CREATED") {
    return decrypted.action.payload;
  }
  
  return null;
}
