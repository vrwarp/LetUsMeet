import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  query,
  orderBy,
  getDocs,
  limit,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../firebase";
import type { 
  BlindEvent, 
  DecryptedSignedEvent, 
  PollState, 
  PollMetadata, 
  PollAction,
  KeystoreEntry
} from "../types";
import { 
  generateSymmetricKey, 
  exportSymmetricKey, 
  encryptPayload, 
  decryptPayload, 
  generateIdentityKeyPair, 
  exportPrivateKey, 
  exportPublicKey, 
  signAction,
  importPrivateKey,
  importPublicKey,
  deriveKeyFromPassword
} from "./crypto";
import { calculatePollState } from "./pollReducer";
import { 
  saveToKeystore, 
  loadFromKeystore,
  clearAmkSessionCache
} from "./deviceService";
import { clearPrfSessionCache } from "./prfService";
export { 
  saveToKeystore, 
  loadFromKeystore,
  verifyAmk
} from "./deviceService";
import { 
  openDB, 
  STORE_IDENTITIES, 
  STORE_MASTER_KEYS, 
  STORE_DEVICE_KEYS 
} from "./idb";

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

export function getShareableUrl(urlStr: string = window.location.href): string {
  try {
    const url = new URL(urlStr);
    url.searchParams.delete("adminToken");
    return url.toString();
  } catch (e) {
    return urlStr;
  }
}

// openDB is now imported from idb.ts

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

export async function resetKeystore() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const keystoreRef = collection(db, "users", user.uid, "keystore");
  const snap = await getDocs(keystoreRef);
  
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  
  // Also delete account keys
  batch.delete(doc(db, "users", user.uid, "account_keys", "default"));
  
  await batch.commit();

  // Also clear IndexedDB
  const idb = await openDB();
  const tx = idb.transaction([STORE_IDENTITIES, STORE_MASTER_KEYS, STORE_DEVICE_KEYS], "readwrite");
  tx.objectStore(STORE_IDENTITIES).clear();
  tx.objectStore(STORE_MASTER_KEYS).clear();
  tx.objectStore(STORE_DEVICE_KEYS).clear();

  // Also clear session caches
  clearAmkSessionCache();
  clearPrfSessionCache();
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
  const adminToken = generateId();
  const adminTokenKey = await deriveKeyFromPassword(adminToken);
  const encryptedAdminPriv = await encryptPayload(adminTokenKey, privB64);
  
  const action: PollAction = { type: "POLL_CREATED", payload: { 
    ...metadata, 
    adminPublicKey: pubB64,
    encryptedAdminPriv: encryptedAdminPriv
  } };
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

  return { pollId, key: b64Key, adminToken };
}

/**
 * Recovers the admin identity from an adminToken by decrypting the private key
 * stored in the genesis event.
 */
export async function loadIdentityFromToken(pollId: string, adminToken: string, symmetricPollKey: CryptoKey): Promise<{ privateKey: CryptoKey, publicKey: CryptoKey } | null> {
  const metadata = await getGenesisEvent(pollId, symmetricPollKey);
  if (!metadata || !metadata.encryptedAdminPriv) return null;
  
  try {
    const adminTokenKey = await deriveKeyFromPassword(adminToken);
    const privB64 = await decryptPayload(adminTokenKey, metadata.encryptedAdminPriv);
    
    return {
      privateKey: await importPrivateKey(privB64),
      publicKey: await importPublicKey(metadata.adminPublicKey!)
    };
  } catch (e) {
    console.error("Failed to recover identity from token:", e);
    return null;
  }
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
  const encrypted = await encryptPayload(symmetricKey, json);

  const eventId = generateId();
  const eventRef = doc(db, "polls", pollId, "events", eventId);
  
  await setDoc(eventRef, {
    eventId,
    createdAt: serverTimestamp(),
    ...encrypted
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
        const json = await decryptPayload(symmetricKey, blind);
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
export async function submitPollUpdate() { throw new Error("Deprecated: Use appendSignedEvent"); }
export function subscribeToPoll() { throw new Error("Deprecated: Use subscribeToLedger"); }
export function subscribeToUserPolls() { throw new Error("Deprecated: Use Keystore query"); }

/**
 * Fetches and decrypts the genesis event (POLL_CREATED) for a poll.
 */
export async function getGenesisEvent(pollId: string, symmetricPollKey: CryptoKey): Promise<PollMetadata | null> {
  const eventsRef = collection(db, "polls", pollId, "events");
  const q = query(eventsRef, orderBy("createdAt", "asc"), limit(1));
  
  for (let i = 0; i < 10; i++) {
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      try {
        const blind = snapshot.docs[0].data() as BlindEvent;
        const json = await decryptPayload(symmetricPollKey, blind);
        const decrypted = JSON.parse(json);
        
        if (decrypted.action && decrypted.action.type === "POLL_CREATED") {
          console.log(`CLAIM DEBUG: Genesis event found and decrypted for poll ${pollId}`);
          return {
            ...decrypted.action.payload,
            adminPublicKey: decrypted.publicKey
          };
        }
      } catch (e) {
        console.error(`CLAIM DEBUG: Error decrypting genesis event for poll ${pollId}:`, e);
      }
    }
    console.log(`CLAIM DEBUG: Genesis event not found for poll ${pollId}, retrying... (${i + 1}/10)`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(`CLAIM DEBUG: Genesis event NOT found for poll ${pollId} after 10 retries`);
  
  return null;
}
