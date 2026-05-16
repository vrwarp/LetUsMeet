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

async function loadMasterKeyFromIndexedDB(uid: string): Promise<CryptoKey | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_MASTER_KEYS, "readonly");
  const request = tx.objectStore(STORE_MASTER_KEYS).get(uid);
  return new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

let prfPromise: Promise<CryptoKey> | null = null;

export async function derivePrfMasterKey(): Promise<CryptoKey> {
  if (prfPromise) return prfPromise;

  prfPromise = (async () => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Must be signed in to derive PRF key.");

      const cachedKey = await loadMasterKeyFromIndexedDB(user.uid);
      if (cachedKey) return cachedKey;

      const isPrfSupported = (window.PublicKeyCredential as any)?.isConditionalMediationAvailable;
      if (!isPrfSupported) {
        throw new Error("WebAuthn PRF not supported on this browser.");
      }

      const storageKey = `prf_cred_${user.uid}`;
      let credentialId = localStorage.getItem(storageKey);

      if (!credentialId) {
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

      await saveMasterKeyToIndexedDB(user.uid, masterKey);
      
      return masterKey;
    } finally {
      prfPromise = null;
    }
  })();

  return prfPromise;
}
