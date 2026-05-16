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
  DecryptedKeystorePayload
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

// === INDEXED DB HELPERS ===

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

// === AMK MANAGEMENT ===

let cachedAmk: CryptoKey | null = null;
let cachedAmkId: string | null = null;

export async function getActiveAmk(): Promise<{ amk: CryptoKey, amkId: string }> {
  if (cachedAmk && cachedAmkId) return { amk: cachedAmk, amkId: cachedAmkId };

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
    // Attempt PRF Recovery
    const recovered = await tryRecoverAmkWithPrf(data);
    if (recovered) return recovered;

    if (!wrappedAmkBase64) {
      throw new Error("Device not authorized. Please authorize this device from an existing one.");
    }
    throw new Error("Device private key missing. IndexedDB might have been cleared.");
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

  return { amk: cachedAmk, amkId: cachedAmkId as string };
}

async function tryRecoverAmkWithPrf(data: AccountKeysDocument): Promise<{ amk: CryptoKey, amkId: string } | null> {
  const amkId = data.activeAmkId;
  const wrappedAmk = data.keyring[amkId]?.["__recovery_prf"];
  if (!wrappedAmk) return null;

  try {
    const prfKey = await derivePrfMasterKey();
    const { ciphertext, iv } = JSON.parse(atob(wrappedAmk));
    const amkBufferB64 = await decrypt(prfKey, ciphertext, iv);
    const amkBuffer = Uint8Array.from(atob(amkBufferB64), c => c.charCodeAt(0));

    const amk = await window.crypto.subtle.importKey(
      "raw",
      amkBuffer,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );

    // Re-register this device since we lost its keys
    const deviceKeyPair = await generateDeviceKeyPair();
    const privB64 = await exportDevicePrivateKey(deviceKeyPair.privateKey);
    const pubB64 = await exportDevicePublicKey(deviceKeyPair.publicKey);
    await saveDeviceKeysToIndexedDB({ privateKey: privB64, publicKey: pubB64 });

    const deviceId = getDeviceId();
    const rawAmk = await window.crypto.subtle.exportKey("raw", amk);
    const wrappedForNewDevice = await wrapAmk(deviceKeyPair.publicKey, rawAmk);

    // Update Firestore with the new device info
    const user = auth.currentUser;
    if (user) {
      const accountKeysRef = doc(db, "users", user.uid, "account_keys", "default");
      data.devices[deviceId] = {
        deviceId,
        deviceName: `${getDeviceName()} (Recovered ${new Date().toISOString().slice(0, 10)})`,
        publicKey: pubB64,
        createdAt: Date.now()
      };
      data.keyring[amkId][deviceId] = wrappedForNewDevice;
      await setDoc(accountKeysRef, data);
    }

    cachedAmk = amk;
    cachedAmkId = amkId;
    return { amk, amkId };
  } catch (e) {
    console.error("PRF Recovery failed:", e);
    return null;
  }
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
  const prfKey = await derivePrfMasterKey();
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
    keyring: {
      [amkId]: {
        [deviceId]: wrappedAmk,
        "__recovery_prf": wrappedForPrf
      }
    }
  };

  await setDoc(doc(db, "users", uid, "account_keys", "default"), accountKeysDoc);

  cachedAmk = amk;
  cachedAmkId = amkId;


  return { amk, amkId };
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

    // Wrap new AMK for all remaining devices
    for (const deviceId in data.devices) {
      const devicePubB64 = data.devices[deviceId].publicKey;
      const devicePubKey = await importDevicePublicKey(devicePubB64);
      const wrapped = await wrapAmk(devicePubKey, rawNewAmk);
      data.keyring[newAmkId][deviceId] = wrapped;
    }

    // Wrap new AMK for PRF Recovery
    try {
      const prfKey = await derivePrfMasterKey();
      const amkB64 = btoa(String.fromCharCode(...new Uint8Array(rawNewAmk)));
      const { ciphertext: prfCipher, iv: prfIv } = await encrypt(prfKey, amkB64);
      data.keyring[newAmkId]["__recovery_prf"] = btoa(JSON.stringify({ ciphertext: prfCipher, iv: prfIv }));
    } catch (e) {
      console.warn("Could not wrap AMK for PRF during rotation. PRF recovery may be unavailable.", e);
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
