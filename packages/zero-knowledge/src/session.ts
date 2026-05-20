import { collection, doc, setDoc, onSnapshot, query, orderBy, getDocs, limit, serverTimestamp } from "firebase/firestore";
import { getDb, getAuth } from "./config";
import { generateSymmetricKey, exportSymmetricKey, importSymmetricKey, encryptPayload, decryptPayload,
  generateIdentityKeyPair, exportPrivateKey, exportPublicKey, importPrivateKey, importPublicKey,
  signAction, verifySignature, deriveKeyFromPassword } from "./crypto";
import { saveToKeystore, loadFromKeystore } from "./deviceService";
import { openDB, STORE_IDENTITIES } from "./idb";
import type { EncryptedData, LedgerSession, DecryptedLedgerEvent, LedgerCredentials, CreateLedgerResult } from "./types";

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15);
}

export class DefaultLedgerSession implements LedgerSession {
  private pendingOwnerRecovery: EncryptedData | null;

  constructor(
    private ledgerId: string,
    private symmetricKey: CryptoKey,
    private signingPrivateKey: CryptoKey,
    private signingPublicKey: CryptoKey,
    private symmetricKeyB64: string,
    private signingPublicKeyB64: string,
    ownerRecovery: EncryptedData | null = null
  ) {
    this.pendingOwnerRecovery = ownerRecovery;
  }

  async appendEvent(action: any): Promise<void> {
    const signature = await signAction(this.signingPrivateKey, action);
    const envelope: any = {
      publicKey: this.signingPublicKeyB64,
      signature,
      action
    };
    // Embed owner recovery data in the genesis event only
    if (this.pendingOwnerRecovery) {
      envelope.__ownerRecovery = this.pendingOwnerRecovery;
      this.pendingOwnerRecovery = null;
    }
    const json = JSON.stringify(envelope);
    const encrypted = await encryptPayload(this.symmetricKey, json);
    const eventId = generateId();
    await setDoc(doc(getDb(), "polls", this.ledgerId, "events", eventId), {
      eventId,
      createdAt: serverTimestamp(),
      ...encrypted
    });
  }

  subscribe(onUpdate: (events: DecryptedLedgerEvent[]) => void): () => void {
    const eventsRef = collection(getDb(), "polls", this.ledgerId, "events");
    const q = query(eventsRef, orderBy("createdAt", "asc"));
    return onSnapshot(q, async (snapshot) => {
      const events: DecryptedLedgerEvent[] = [];
      for (const d of snapshot.docs) {
        try {
          const data = d.data();
          const encrypted: EncryptedData = {
            encryptedData: data.encryptedData,
            iv: data.iv
          };
          const json = await decryptPayload(this.symmetricKey, encrypted);
          const envelope = JSON.parse(json);
          const isValid = await verifySignature(envelope.publicKey, envelope.signature, envelope.action);
          if (isValid) {
            events.push({ signerPublicKey: envelope.publicKey, action: envelope.action });
          } else {
            console.warn("Dropping event due to invalid signature", d.id);
          }
        } catch (e) {
          console.warn("Failed to decrypt event", d.id, e);
        }
      }
      onUpdate(events);
    });
  }

  async getGenesisEvent(): Promise<DecryptedLedgerEvent | null> {
    const eventsRef = collection(getDb(), "polls", this.ledgerId, "events");
    const q = query(eventsRef, orderBy("createdAt", "asc"), limit(1));
    for (let i = 0; i < 10; i++) {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        try {
          const data = snapshot.docs[0].data();
          const encrypted: EncryptedData = {
            encryptedData: data.encryptedData,
            iv: data.iv
          };
          const json = await decryptPayload(this.symmetricKey, encrypted);
          const envelope = JSON.parse(json);
          return { signerPublicKey: envelope.publicKey, action: envelope.action };
        } catch (e) {
          console.error("Error decrypting genesis:", e);
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }

  exportSessionKey(): string { return this.symmetricKeyB64; }
  getSignerPublicKey(): string { return this.signingPublicKeyB64; }
}

// === FACTORY: Create new ledger ===
export async function createLedgerSession(): Promise<CreateLedgerResult> {
  const ledgerId = generateId();
  const symmetricKey = await generateSymmetricKey();
  const keyPair = await generateIdentityKeyPair();
  const b64Key = await exportSymmetricKey(symmetricKey);
  const privB64 = await exportPrivateKey(keyPair.privateKey);
  const pubB64 = await exportPublicKey(keyPair.publicKey);

  // Generate ownership recovery token
  const ownershipToken = generateId();
  const tokenKey = await deriveKeyFromPassword(ownershipToken);
  const ownerRecovery = await encryptPayload(tokenKey, privB64);

  // Persist credentials
  const creds: LedgerCredentials = { symmetricKey: b64Key, signingPrivateKey: privB64, signingPublicKey: pubB64 };
  const auth = getAuth();
  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    await saveToKeystore(ledgerId, creds);
  } else {
    const idb = await openDB();
    const tx = idb.transaction(STORE_IDENTITIES, "readwrite");
    await new Promise<void>((resolve, reject) => {
      const req = tx.objectStore(STORE_IDENTITIES).put({ privateKey: privB64, publicKey: pubB64 }, ledgerId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Create empty poll doc
  await setDoc(doc(getDb(), "polls", ledgerId), { pollId: ledgerId });

  const session = new DefaultLedgerSession(ledgerId, symmetricKey, keyPair.privateKey, keyPair.publicKey, b64Key, pubB64, ownerRecovery);
  return { session, ownershipToken, ledgerId };
}

// === FACTORY: Restore existing ledger ===
export async function getLedgerSession(
  ledgerId: string,
  options?: { shareableKey?: string; ownershipToken?: string }
): Promise<LedgerSession> {
  // 1. Try Firestore keystore (authenticated users)
  const auth = getAuth();
  const user = auth.currentUser;
  if (user && !user.isAnonymous) {
    const creds = await loadFromKeystore(ledgerId);
    if (creds) {
      return new DefaultLedgerSession(
        ledgerId,
        await importSymmetricKey(creds.symmetricKey),
        await importPrivateKey(creds.signingPrivateKey),
        await importPublicKey(creds.signingPublicKey),
        creds.symmetricKey,
        creds.signingPublicKey
      );
    }
  }

  // 2. Try IndexedDB (local identity)
  const idb = await openDB();
  const tx = idb.transaction(STORE_IDENTITIES, "readonly");
  const stored: any = await new Promise(resolve => {
    const req = tx.objectStore(STORE_IDENTITIES).get(ledgerId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
  if (stored && options?.shareableKey) {
    return new DefaultLedgerSession(
      ledgerId,
      await importSymmetricKey(options.shareableKey),
      await importPrivateKey(stored.privateKey),
      await importPublicKey(stored.publicKey),
      options.shareableKey,
      stored.publicKey
    );
  }

  // 3. Ownership token recovery (admin claiming)
  if (options?.ownershipToken && options?.shareableKey) {
    const symKey = await importSymmetricKey(options.shareableKey);
    const eventsRef = collection(getDb(), "polls", ledgerId, "events");
    const q = query(eventsRef, orderBy("createdAt", "asc"), limit(1));
    for (let i = 0; i < 10; i++) {
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        try {
          const data = snapshot.docs[0].data();
          const encrypted: EncryptedData = {
            encryptedData: data.encryptedData,
            iv: data.iv
          };
          const json = await decryptPayload(symKey, encrypted);
          const envelope = JSON.parse(json);
          if (envelope.__ownerRecovery) {
            const tokenKey = await deriveKeyFromPassword(options.ownershipToken);
            const privB64 = await decryptPayload(tokenKey, envelope.__ownerRecovery);
            const pubB64 = envelope.publicKey;
            // Save recovered credentials
            const creds: LedgerCredentials = { symmetricKey: options.shareableKey, signingPrivateKey: privB64, signingPublicKey: pubB64 };
            if (user && !user.isAnonymous) {
              await saveToKeystore(ledgerId, creds);
            } else {
              const idb2 = await openDB();
              const tx2 = idb2.transaction(STORE_IDENTITIES, "readwrite");
              await new Promise<void>((resolve, reject) => {
                const req2 = tx2.objectStore(STORE_IDENTITIES).put({ privateKey: privB64, publicKey: pubB64 }, ledgerId);
                req2.onsuccess = () => resolve();
                req2.onerror = () => reject(req2.error);
              });
            }
            return new DefaultLedgerSession(ledgerId, symKey, await importPrivateKey(privB64), await importPublicKey(pubB64), options.shareableKey, pubB64);
          }
        } catch (e) {
          console.error("Owner recovery failed:", e);
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // 4. New participant (shareableKey only, generate fresh identity)
  if (options?.shareableKey) {
    const keyPair = await generateIdentityKeyPair();
    const privB64 = await exportPrivateKey(keyPair.privateKey);
    const pubB64 = await exportPublicKey(keyPair.publicKey);
    // Save identity locally
    const idb2 = await openDB();
    const tx2 = idb2.transaction(STORE_IDENTITIES, "readwrite");
    await new Promise<void>((resolve, reject) => {
      const req2 = tx2.objectStore(STORE_IDENTITIES).put({ privateKey: privB64, publicKey: pubB64 }, ledgerId);
      req2.onsuccess = () => resolve();
      req2.onerror = () => reject(req2.error);
    });
    // Also save to keystore if authenticated
    if (user && !user.isAnonymous) {
      const creds: LedgerCredentials = { symmetricKey: options.shareableKey, signingPrivateKey: privB64, signingPublicKey: pubB64 };
      await saveToKeystore(ledgerId, creds);
    }
    return new DefaultLedgerSession(ledgerId, await importSymmetricKey(options.shareableKey), keyPair.privateKey, keyPair.publicKey, options.shareableKey, pubB64);
  }

  throw new Error("Access Denied: No credentials found and no shareable key provided.");
}
