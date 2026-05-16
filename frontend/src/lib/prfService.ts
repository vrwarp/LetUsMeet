import { auth } from "../firebase";

import {
  openDB,
  STORE_MASTER_KEYS
} from "./idb";

async function saveMasterKeyToIndexedDB(uid: string, key: CryptoKey) {
  const db = await openDB();
  const tx = db.transaction(STORE_MASTER_KEYS, "readwrite");
  tx.objectStore(STORE_MASTER_KEYS).put(key, uid);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

export async function loadMasterKeyFromIndexedDB(uid: string): Promise<CryptoKey | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_MASTER_KEYS, "readonly");
  const request = tx.objectStore(STORE_MASTER_KEYS).get(uid);
  return new Promise((resolve) => {
    request.onsuccess = () => {
      const key = request.result as CryptoKey | null;
      if (key && !key.extractable) {
        resolve(null); // Treat non-extractable keys as missing to force a fresh derivation
      } else {
        resolve(key);
      }
    };
    request.onerror = () => resolve(null);
  });
}

let prfPromise: Promise<{ masterKey: CryptoKey, usedCredentialId: string }> | null = null;
let globalPrfLock: Promise<any> = Promise.resolve();

export async function derivePrfMasterKey(credentialIds?: string[]): Promise<{ masterKey: CryptoKey, usedCredentialId: string }> {
  // If we already have a successful derivation in this session, return it immediately
  if (prfPromise) return prfPromise;

  // Use the lock to ensure sequential execution of ANY WebAuthn request
  const resultPromise = (async () => {
    await globalPrfLock;

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Must be signed in to derive PRF key.");

      // For silent check (no IDs provided), check IndexedDB
      if (!credentialIds || credentialIds.length === 0) {
        const cachedKey = await loadMasterKeyFromIndexedDB(user.uid);
        if (cachedKey) {
          return { masterKey: cachedKey, usedCredentialId: "cached" };
        }
      }

      const storageKey = `prf_cred_${user.uid}`;
      const effectiveIds = (credentialIds && credentialIds.length > 0)
        ? credentialIds
        : [localStorage.getItem(storageKey)].filter(Boolean) as string[];

      if (effectiveIds.length === 0) {
        // Create new credential logic
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
              { alg: -7, type: "public-key" },
              { alg: -257, type: "public-key" }
            ],
            authenticatorSelection: { userVerification: "discouraged" },
            extensions: {
              prf: { eval: { first: new TextEncoder().encode("LetUsMeet-PRF-Salt-v1") } }
            } as any
          }
        };

        const credential = (await navigator.credentials.create(createOptions)) as any;
        if (!credential) throw new Error("Failed to create PRF credential.");

        const newId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        localStorage.setItem(storageKey, newId);
        effectiveIds.push(newId);
      }

      const getOptions: CredentialRequestOptions = {
        publicKey: {
          challenge: window.crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: effectiveIds.map(id => ({
            id: Uint8Array.from(atob(id), c => c.charCodeAt(0)),
            type: "public-key" as const
          })),
          userVerification: "discouraged",
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
        true,
        ["encrypt", "decrypt"]
      );

      const usedId = btoa(String.fromCharCode(...new Uint8Array(assertion.rawId)));

      // Always update local storage and IndexedDB with the successfully used credential
      localStorage.setItem(storageKey, usedId);
      await saveMasterKeyToIndexedDB(user.uid, masterKey);

      return { masterKey, usedCredentialId: usedId };
    } catch (e) {
      // If derivation fails, we'll clear the promise cache below
      throw e;
    }
  })();

  globalPrfLock = resultPromise.catch(() => { }).then(() => { });

  // Cache the promise for the session
  prfPromise = resultPromise;
  resultPromise.catch(() => {
    // If the derivation fails (e.g. user cancels), clear the cache so they can try again
    if (prfPromise === resultPromise) prfPromise = null;
  });

  return resultPromise;
}
