import {
  doc,
  getDoc,
  setDoc,
  runTransaction
} from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  generateDeviceKeyPair,
  exportDevicePublicKey,
  exportDevicePrivateKey,
  importDevicePrivateKey,
  importDevicePublicKey,
  generateSymmetricKey,
  wrapAmk,
  unwrapAmk,
  encrypt,
  decrypt
} from "./crypto";
import { derivePrfMasterKey } from "./prfService";
import type {
  AccountKeysDocument,
  DevicePublicKey,
  KeystoreEntry,
  DecryptedKeystorePayload,
  PendingDevice
} from "../types";

import {
  openDB,
  STORE_DEVICE_KEYS
} from "./idb";

/**
 * Gets or generates a unique device ID for this browser.
 */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

/**
 * Gets or generates a human-readable device name.
 */
export function getDeviceName(): string {
  return localStorage.getItem("deviceName") || "Unknown Device";
}

export function setDeviceName(name: string) {
  localStorage.setItem("deviceName", name);
}

// === PRF HELPERS ===

async function getPrfMethodId(prfKey: CryptoKey): Promise<string> {
  const rawKey = await window.crypto.subtle.exportKey("raw", prfKey);
  const hash = await window.crypto.subtle.digest("SHA-256", rawKey);
  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `__recovery_prf_${hashHex.slice(0, 16)}`;
}

// openDB is now imported from idb.ts

async function saveDeviceKeysToIndexedDB(keys: { privateKey: string, publicKey: string }) {
  const db = await openDB();
  const tx = db.transaction(STORE_DEVICE_KEYS, "readwrite");
  tx.objectStore(STORE_DEVICE_KEYS).put(keys, "current_device");
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadDeviceKeysFromIndexedDB(): Promise<{ privateKey: string, publicKey: string } | null> {
  const db = await openDB();
  const tx = db.transaction(STORE_DEVICE_KEYS, "readonly");
  const request = tx.objectStore(STORE_DEVICE_KEYS).get("current_device");
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalPublicKey(): Promise<string | null> {
  const keys = await loadDeviceKeysFromIndexedDB();
  return keys?.publicKey || null;
}

// === AMK MANAGEMENT ===

let cachedAmk: CryptoKey | null = null;
let cachedAmkId: string | null = null;
let verificationPromise: Promise<{ amk: CryptoKey, amkId: string }> | null = null;

export async function getActiveAmk(): Promise<{ amk: CryptoKey, amkId: string }> {
  if (cachedAmk && cachedAmkId) return { amk: cachedAmk, amkId: cachedAmkId };
  
  // Deduplicate concurrent verification requests
  if (verificationPromise) return verificationPromise;

  verificationPromise = (async () => {
    try {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) throw new Error("Must be signed in to access AMK.");

      const deviceId = getDeviceId();
      const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
      const snap = await getDoc(accountKeysRef);

      if (!snap.exists()) {
        // Flow A: Initial Setup (Genesis Device)
        return await setupGenesisDevice(user.uid);
      }

      const data = snap.data() as AccountKeysDocument;
      const wrappedAmkBase64 = data.keyring[data.activeAmkId]?.[deviceId];

      // Check device keys
      const deviceKeysB64 = await loadDeviceKeysFromIndexedDB();

      if (!wrappedAmkBase64 || !deviceKeysB64) {
        // Attempt Silent PRF Recovery & Auto-Registration
        const recovered = await tryRecoverAmkWithPrf(data);
        if (recovered) {
          console.log("Silent recovery successful. Auto-registering device...");
          await registerCurrentDevice(recovered.amk, recovered.amkId);
          return recovered;
        }

        // Fallback: If no PRF recovery possible, we throw to trigger the mismatch UI.
        // We use a specific prefix to help the UI differentiate.
        if (!wrappedAmkBase64) {
          throw new Error("UNRECOGNIZED_DEVICE: This browser instance has not been authorized to access your encrypted data.");
        }
        throw new Error("IDENTITY_MISMATCH: The passkey used does not match the one registered for this device.");
      }

      const privateKey = await importDevicePrivateKey(deviceKeysB64.privateKey);
      const amkBuffer = await unwrapAmk(privateKey, wrappedAmkBase64);

      cachedAmk = await window.crypto.subtle.importKey(
        "raw",
        amkBuffer,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
      );
      cachedAmkId = data.activeAmkId;

      const result = { amk: cachedAmk, amkId: cachedAmkId as string };
      
      // Opportunistic Recovery: If we have a session, check if PRF recovery needs re-enabling
      // We do this in the background to not block the main AMK access
      opportunisticallyEnableRecovery().catch(e => console.warn("Opportunistic recovery check failed:", e));

      return result;
    } finally {
      verificationPromise = null;
    }
  })();

  return verificationPromise;
}

/**
 * Checks if PRF recovery is missing for the current AMK and re-enables it if a PRF key is available.
 */
async function opportunisticallyEnableRecovery() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const { isCurrentPrfSealed } = await getRecoveryStatus();
  
  // If the current device has a PRF key but it hasn't been used to seal the current AMK,
  // we do it automatically in the background.
  if (!isCurrentPrfSealed) {
    const { loadMasterKeyFromIndexedDB } = await import("./prfService");
    const cachedPrfKey = await loadMasterKeyFromIndexedDB(user.uid);
    if (cachedPrfKey) {
      console.log("Current PRF key is available but not sealed for this AMK. Re-enabling...");
      await enablePrfRecovery();
    }
  }
}

/**
 * Checks if the current AMK is "sealed" with a recovery method.
 */
export async function getRecoveryStatus(): Promise<{ 
  isSealed: boolean, 
  methods: string[], 
  isCurrentPrfSealed: boolean 
}> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return { isSealed: false, methods: [] };

  const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
  const snap = await getDoc(accountKeysRef);
  if (!snap.exists()) return { isSealed: false, methods: [] };

  const data = snap.data() as AccountKeysDocument;
  const amkId = data.activeAmkId;
  const keyring = data.keyring[amkId] || {};
  
  const registeredMethodIds = Object.keys(data.recoveryMethods || {});
  const activeMethodIds = registeredMethodIds.filter(id => !!keyring[id]);
  const methods = activeMethodIds.map(id => data.recoveryMethods[id].label);

  // Check if current PRF key is sealed
  const { loadMasterKeyFromIndexedDB } = await import("./prfService");
  const cachedPrfKey = await loadMasterKeyFromIndexedDB(user.uid);
  let isCurrentPrfSealed = false;
  if (cachedPrfKey) {
    const methodId = await getPrfMethodId(cachedPrfKey);
    isCurrentPrfSealed = !!keyring[methodId];
  }

  return {
    isSealed: activeMethodIds.length > 0,
    methods,
    isCurrentPrfSealed
  };
}

async function tryRecoverAmkWithPrf(data: AccountKeysDocument): Promise<{ amk: CryptoKey, amkId: string } | null> {
  const amkId = data.activeAmkId;
  const keyring = data.keyring[amkId] || {};
  
  // Find all recovery methods of type 'prf' that have a credentialId
  const prfMethods = Object.values(data.recoveryMethods || {}).filter(
    m => m.type === 'prf' && m.credentialId
  );
  const credentialIds = prfMethods.map(m => m.credentialId as string);

  if (credentialIds.length === 0) return null;

  try {
    // Attempt to derive the PRF key using ALL known credentials in a single browser prompt
    const { masterKey, usedCredentialId } = await derivePrfMasterKey(credentialIds);
    
    // Find the methodId for the credential that was actually used
    const usedMethodId = await getPrfMethodId(masterKey);
    const wrappedAmk = keyring[usedMethodId];

    if (!wrappedAmk) {
      console.warn(`PRF key derived for ${usedCredentialId} but no wrapper found for method ${usedMethodId}`);
      return null;
    }

    const { ciphertext, iv } = JSON.parse(atob(wrappedAmk));
    const amkBufferB64 = await decrypt(masterKey, ciphertext, iv);
    const amkBuffer = Uint8Array.from(atob(amkBufferB64), c => c.charCodeAt(0));

    const amk = await window.crypto.subtle.importKey(
      "raw",
      amkBuffer,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );

    cachedAmk = amk;
    cachedAmkId = amkId;
    return { amk, amkId };
  } catch (e) {
    console.warn("PRF Recovery failed:", e);
    return null;
  }
}

/**
 * Registers the current device with an existing AMK.
 * Used during recovery flows (PRF or Phrase).
 */
export async function registerCurrentDevice(amk: CryptoKey, amkId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Must be signed in.");

  const deviceKeyPair = await generateDeviceKeyPair();
  const privB64 = await exportDevicePrivateKey(deviceKeyPair.privateKey);
  const pubB64 = await exportDevicePublicKey(deviceKeyPair.publicKey);
  await saveDeviceKeysToIndexedDB({ privateKey: privB64, publicKey: pubB64 });

  const deviceId = getDeviceId();
  const rawAmk = await window.crypto.subtle.exportKey("raw", amk);
  const wrappedForNewDevice = await wrapAmk(deviceKeyPair.publicKey, rawAmk);

  const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(accountKeysRef);
    if (!snap.exists()) throw new Error("Account keys doc missing.");
    
    const data = snap.data() as AccountKeysDocument;
    data.devices[deviceId] = {
      deviceId,
      deviceName: `${getDeviceName()} (Recovered ${new Date().toISOString().slice(0, 10)})`,
      publicKey: pubB64,
      createdAt: Date.now()
    };
    data.keyring[amkId][deviceId] = wrappedForNewDevice;
    transaction.set(accountKeysRef, data);
  });

  cachedAmk = amk;
  cachedAmkId = amkId;
}

async function setupGenesisDevice(uid: string): Promise<{ amk: CryptoKey, amkId: string }> {
  // 1. Generate device key pair
  const deviceKeyPair = await generateDeviceKeyPair();
  const privB64 = await exportDevicePrivateKey(deviceKeyPair.privateKey);
  const pubB64 = await exportDevicePublicKey(deviceKeyPair.publicKey);
  await saveDeviceKeysToIndexedDB({ privateKey: privB64, publicKey: pubB64 });

  // 2. Generate initial AMK (amk_v1)
  const amk = await generateSymmetricKey(256);
  const amkId = "amk_v1";
  const rawAmk = await window.crypto.subtle.exportKey("raw", amk);

  // 3. Wrap AMK for this device
  const deviceId = getDeviceId();
  const wrappedAmk = await wrapAmk(deviceKeyPair.publicKey, rawAmk);

  // 4. Wrap for PRF Recovery
  const { masterKey: prfKey } = await derivePrfMasterKey();
  const methodId = await getPrfMethodId(prfKey);

  const storageKey = `prf_cred_${uid}`;
  const credentialId = localStorage.getItem(storageKey) || "default_prf";

  const amkB64 = btoa(String.fromCharCode(...new Uint8Array(rawAmk)));
  const { ciphertext: prfCipher, iv: prfIv } = await encrypt(prfKey, amkB64);
  const wrappedForPrf = btoa(JSON.stringify({ ciphertext: prfCipher, iv: prfIv }));

  // 5. Write to Firestore
  const accountKeysDoc: AccountKeysDocument = {
    activeAmkId: amkId,
    devices: {
      [deviceId]: {
        deviceId,
        deviceName: getDeviceName(),
        publicKey: pubB64,
        createdAt: Date.now()
      }
    },
    recoveryMethods: {
      [methodId]: {
        type: 'prf',
        label: `Passkey on ${getDeviceName()}`,
        credentialId: credentialId,
        createdAt: Date.now()
      }
    },
    keyring: {
      [amkId]: {
        [deviceId]: wrappedAmk,
        [methodId]: wrappedForPrf
      }
    }
  };

  await setDoc(doc(db, "users", uid, "account_keys", "default"), accountKeysDoc);

  cachedAmk = amk;
  cachedAmkId = amkId;

  return { amk, amkId };
}

/**
 * Re-enables PRF recovery for the current AMK.
 * This should be called by the user after a revocation event to "close the security gap".
 */
export async function enablePrfRecovery(): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) throw new Error("Must be signed in.");

  const { amk, amkId } = await getActiveAmk();
  const rawAmk = await window.crypto.subtle.exportKey("raw", amk);
  
  const { masterKey: prfKey } = await derivePrfMasterKey();
  const methodId = await getPrfMethodId(prfKey);
  
  const storageKey = `prf_cred_${user.uid}`;
  const credentialId = localStorage.getItem(storageKey) || "default_prf";

  const amkB64 = btoa(String.fromCharCode(...new Uint8Array(rawAmk)));
  const { ciphertext: prfCipher, iv: prfIv } = await encrypt(prfKey, amkB64);
  const wrappedForPrf = btoa(JSON.stringify({ ciphertext: prfCipher, iv: prfIv }));

  const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(accountKeysRef);
    if (!snap.exists()) throw new Error("Account keys doc missing.");
    
    const data = snap.data() as AccountKeysDocument;
    data.recoveryMethods[methodId] = {
      type: 'prf',
      label: `Passkey on ${getDeviceName()}`,
      credentialId: credentialId,
      createdAt: Date.now()
    };
    data.keyring[amkId][methodId] = wrappedForPrf;
    transaction.set(accountKeysRef, data);
  });
}

// === DEVICE AUTHORIZATION ===

export async function registerPendingDevice() {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const deviceId = getDeviceId();
  const deviceKeyPair = await generateDeviceKeyPair();
  const privB64 = await exportDevicePrivateKey(deviceKeyPair.privateKey);
  const pubB64 = await exportDevicePublicKey(deviceKeyPair.publicKey);
  await saveDeviceKeysToIndexedDB({ privateKey: privB64, publicKey: pubB64 });

  const pendingRef = doc(db, "users", user.uid, "pending_devices", deviceId);
  await setDoc(pendingRef, {
    deviceId,
    deviceName: getDeviceName(),
    publicKey: pubB64,
    createdAt: Date.now()
  });
}

export async function authorizeDevice(pendingDeviceId: string) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const pendingRef = doc(db, "users", user.uid, "pending_devices", pendingDeviceId);
  const pendingSnap = await getDoc(pendingRef);
  if (!pendingSnap.exists()) throw new Error("Pending device not found.");

  const pendingDevice = pendingSnap.data() as DevicePublicKey;
  const { amk } = await getActiveAmk();
  const rawAmk = await window.crypto.subtle.exportKey("raw", amk);

  const pendingPublicKey = await importDevicePublicKey(pendingDevice.publicKey);
  const wrappedAmk = await wrapAmk(pendingPublicKey, rawAmk);

  await runTransaction(db, async (transaction) => {
    const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
    const accountKeysSnap = await transaction.get(accountKeysRef);
    if (!accountKeysSnap.exists()) throw new Error("Account keys doc missing.");

    const data = accountKeysSnap.data() as AccountKeysDocument;
    data.devices[pendingDeviceId] = pendingDevice;
    data.keyring[data.activeAmkId][pendingDeviceId] = wrappedAmk;

    transaction.set(accountKeysRef, data);
    transaction.delete(pendingRef);
  });
}

// === REVOCATION & ROTATION ===

export async function revokeDevice(revokedDeviceId: string) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  await getActiveAmk();
  const newAmk = await generateSymmetricKey(256);
  const newAmkId = `amk_${Date.now()}`;
  const rawNewAmk = await window.crypto.subtle.exportKey("raw", newAmk);

  // 1. Update Account Keys (Transaction)
  await runTransaction(db, async (transaction) => {
    const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
    const accountKeysSnap = await transaction.get(accountKeysRef);
    if (!accountKeysSnap.exists()) throw new Error("Account keys doc missing.");

    const data = accountKeysSnap.data() as AccountKeysDocument;

    // Remove revoked device
    delete data.devices[revokedDeviceId];

    // Create new keyring entry for the new AMK
    data.keyring[newAmkId] = {};

    // 2. Wrap only for active, verified devices (Level 3D)
    for (const deviceId in data.devices) {
      const devicePubB64 = data.devices[deviceId].publicKey;
      const devicePubKey = await importDevicePublicKey(devicePubB64);
      const wrapped = await wrapAmk(devicePubKey, rawNewAmk);
      data.keyring[newAmkId][deviceId] = wrapped;
    }

    // 3. Update Asymmetric Recovery wrappers (Level 3R)
    // Methods with a publicKey (like phrases) can be re-wrapped without user intervention.
    if (data.recoveryMethods) {
      for (const methodId in data.recoveryMethods) {
        const method = data.recoveryMethods[methodId];
        if (method.type === 'phrase' && method.publicKey) {
          try {
            const recoveryPubKey = await importDevicePublicKey(method.publicKey);
            const wrapped = await wrapAmk(recoveryPubKey, rawNewAmk);
            data.keyring[newAmkId][methodId] = wrapped;
          } catch (e) {
            console.error(`Failed to re-wrap recovery method ${methodId}:`, e);
          }
        }
      }
    }

    // 4. Update Symmetric Recovery wrappers (Level 3R - PRF)
    // We attempt to re-wrap PRF methods automatically if the PRF key is available.
    try {
      const { masterKey: prfKey } = await derivePrfMasterKey(); // This will use the cache if available
      const rawAmkB64 = btoa(String.fromCharCode(...new Uint8Array(rawNewAmk)));
      const { ciphertext, iv } = await encrypt(prfKey, rawAmkB64);
      const wrappedForPrf = btoa(JSON.stringify({ ciphertext, iv }));

      if (data.recoveryMethods) {
        for (const methodId in data.recoveryMethods) {
          if (data.recoveryMethods[methodId].type === 'prf') {
            data.keyring[newAmkId][methodId] = wrappedForPrf;
          }
        }
      }
    } catch (e) {
      console.warn("Could not automatically re-wrap PRF recovery methods during revocation:", e);
      // If PRF isn't available, we just don't add those wrappers to the new AMK.
      // The user will see a "Recovery Disabled" warning on the dashboard and can re-enable it.
    }

    data.activeAmkId = newAmkId;
    transaction.set(accountKeysRef, data);
  });

  cachedAmk = newAmk;
  cachedAmkId = newAmkId;

  // 2. Data Migration removed
}


// === KEYSTORE (Authenticated Storage) ===

export async function saveToKeystore(pollId: string, payload: DecryptedKeystorePayload) {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return;

  const { amk, amkId } = await getActiveAmk();
  const json = JSON.stringify(payload);
  const { ciphertext, iv } = await encrypt(amk, json);

  const entryRef = doc(db, "users", user.uid, "keystore", pollId);
  await setDoc(entryRef, {
    pollId,
    amkId,
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
  const { amk } = await getActiveAmk();
  const json = await decrypt(amk, data.wrappedPayload, data.iv);
  return JSON.parse(json);
}

export async function verifyAmk(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return true;

  try {
    await getActiveAmk();
    return true;
  } catch (e) {
    console.error("AMK verification failed:", e);
    return false;
  }
}

/**
 * Flow B: Request authorization from an existing device.
 */
export async function requestDeviceAuthorization(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Must be signed in.");

  const deviceId = getDeviceId();
  const deviceKeyPair = await generateDeviceKeyPair();
  const pubB64 = await exportDevicePublicKey(deviceKeyPair.publicKey);
  const privB64 = await exportDevicePrivateKey(deviceKeyPair.privateKey);

  // Save private key locally - it's useless until authorized.
  await saveDeviceKeysToIndexedDB({ privateKey: privB64, publicKey: pubB64 });

  const pendingRef = doc(db, "users", user.uid, "pending_devices", deviceId);
  const pendingData: PendingDevice = {
    deviceId,
    deviceName: getDeviceName(),
    publicKey: pubB64,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes TTL
  };

  await setDoc(pendingRef, pendingData);
}

/**
 * Flow B: Approve a pending device request.
 */
export async function approveDeviceAuthorization(pendingDevice: PendingDevice): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Must be signed in.");

  const { amk, amkId } = await getActiveAmk();
  const rawAmk = await window.crypto.subtle.exportKey("raw", amk);
  
  const targetPubKey = await importDevicePublicKey(pendingDevice.publicKey);
  const wrappedForNewDevice = await wrapAmk(targetPubKey, rawAmk);

  const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
  const pendingRef = doc(db, "users", user.uid, "pending_devices", pendingDevice.deviceId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(accountKeysRef);
    if (!snap.exists()) throw new Error("Account keys missing.");
    
    const data = snap.data() as AccountKeysDocument;
    data.devices[pendingDevice.deviceId] = {
      deviceId: pendingDevice.deviceId,
      deviceName: pendingDevice.deviceName,
      publicKey: pendingDevice.publicKey,
      createdAt: Date.now()
    };
    data.keyring[amkId][pendingDevice.deviceId] = wrappedForNewDevice;
    
    transaction.set(accountKeysRef, data);
    transaction.update(pendingRef, { status: 'authorized' });
  });
}
