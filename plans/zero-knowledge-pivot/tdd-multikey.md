Technical Design Document: Multi-Device Keystore & Envelope Encryption (LetUsMeet)
==================================================================================

**Status:** Ready for Implementation

**Target Audience:** Junior Backend/Frontend Engineer

1\. Objective & Rationale
-------------------------

The previous architecture relying exclusively on the WebAuthn PRF extension for cross-device sync was flawed. It locked users into a single authenticator ecosystem (e.g., Apple iCloud Keychain), making cross-platform usage (e.g., Mac to Windows) or cold-storage recovery impossible.

This document defines the implementation of **Envelope Encryption** and an **Append-Only Keyring**. This decouples device authentication from poll decryption.

**Core Invariant:** LetUsMeet is a zero-knowledge application. A Firebase Cloud Function must **never** process or migrate plaintext keys. All key rotation, wrapping, and migration must happen client-side in the browser.

* * * * *

2\. Terminology & Architecture
------------------------------

You must understand these three layers before writing code:

1.  **Poll Keys (Level 1):** The AES-GCM symmetric key (in the URL) and the ECDSA identity key pair (in the keystore). These *never* rotate.

2.  **Account Master Key / AMK (Level 2):** A new AES-GCM 256-bit symmetric key. Its only job is to encrypt the user's `KeystoreEntry` for each poll.

3.  **Key Encrypting Keys / KEKs (Level 3):** Asymmetric RSA-OAEP key pairs generated for *each device*. The Public Key is stored in Firestore. The Private Key is stored locally on the device (in IndexedDB) or derived from a Recovery Phrase. The KEK Public Key encrypts the AMK.

* * * * *

Phase 1: Data Model Updates
---------------------------

Modify `shared/types.ts`. We need a new collection for the account keyring and an update to the existing keystore entry.

TypeScript

```
// Add to shared/types.ts

export interface DevicePublicKey {
  deviceId: string;
  deviceName: string; // e.g., "Benson's MacBook"
  publicKey: string; // Base64 SPKI (RSA-OAEP)
  createdAt: number;
}

export interface AccountKeysDocument {
  activeAmkId: string; // e.g., "amk_v1"
  devices: Record<string, DevicePublicKey>; // Keyed by deviceId
  keyring: Record<string, Record<string, string>>;
  // Map of amkId -> { deviceId: "wrapped_amk_base64" }
}

// Modify existing KeystoreEntry
export interface KeystoreEntry {
  pollId: string;
  amkId: string; // NEW: Explicitly declare which AMK encrypted this payload
  wrappedPayload: string;
  iv: string;
  updatedAt: number;
}

```

* * * * *

Phase 2: Cryptographic Primitives
---------------------------------

Update `frontend/src/lib/crypto.ts`. You must add functions to handle the RSA-OAEP device keys. Do not use third-party libraries. Stick to `window.crypto.subtle`.

TypeScript

```
// Add to frontend/src/lib/crypto.ts

// === DEVICE KEYS (RSA-OAEP) ===

export async function generateDeviceKeyPair(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // Extractable so we can save it
    ["encrypt", "decrypt"]
  );
}

// Re-use your existing exportPublicKey/importPublicKey functions but adapt them to support RSA-OAEP if they are hardcoded to ECDSA.
// Create specific versions if necessary: exportDevicePublicKey, importDevicePublicKey.

export async function wrapAmk(devicePublicKey: CryptoKey, rawAmkBuffer: ArrayBuffer): Promise<string> {
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    devicePublicKey,
    rawAmkBuffer
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

export async function unwrapAmk(devicePrivateKey: CryptoKey, wrappedAmkBase64: string): Promise<ArrayBuffer> {
  const bin = atob(wrappedAmkBase64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);

  return await window.crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    devicePrivateKey,
    buf
  );
}

```

* * * * *

Phase 3: Firestore Rules
------------------------

Update `firestore.rules` to secure the new `account_keys` collection.

JavaScript

```
// Add to firestore.rules

match /users/{userId}/account_keys/default {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if request.auth != null && request.auth.uid == userId
    && request.resource.data.keys().hasAll(['activeAmkId', 'devices', 'keyring']);
}

```

* * * * *

Phase 4: Core Workflows (Service Layer)
---------------------------------------

Create a new service file or update `frontend/src/lib/pollService.ts` to handle these workflows.

### Flow A: Initial Setup (The Genesis Device)

When a user logs in for the very first time:

1.  Generate `device_key_pair` (RSA-OAEP). Save the Private Key securely to IndexedDB.

2.  Generate a new `amk_v1` (AES-GCM, 256-bit). Export it to a raw buffer.

3.  Wrap `amk_v1` using the `device_key_pair.publicKey`.

4.  Write to `users/{uid}/account_keys/default`:

    -   Add the device public key to `devices`.

    -   Set `activeAmkId: 'amk_v1'`.

    -   Set `keyring.amk_v1[deviceId]` to the wrapped key.

### Flow B: Authorizing a New Device

*Note: This requires an existing device to be online to act as a sponsor.*

1.  **New Device:** Generates a new RSA-OAEP key pair. Saves the private key to IndexedDB. Writes the public key to a temporary Firestore document (e.g., `users/{uid}/pending_devices/{deviceId}`).

2.  **Sponsor Device:** Reads the pending public key.

3.  **Sponsor Device:** Uses a **Firestore Transaction** to read `users/{uid}/account_keys/default`.

4.  **Sponsor Device:** Unwraps the active AMK using its own local private key.

5.  **Sponsor Device:** Wraps the AMK using the *New Device's* public key.

6.  **Sponsor Device:** Appends the New Device to the `devices` map and the wrapped key to the `keyring`. Commits transaction.

### Flow C: The Hard Path --- Device Revocation & Data Migration

If a user clicks "Revoke" on an old device, you must permanently lock that device out of future data.

**Part 1: The Transaction (Key Rotation)**

1.  Read `users/{uid}/account_keys/default` via Firestore Transaction.

2.  Generate a completely new `amk_v2`.

3.  Iterate through the `devices` map. **Skip the revoked device.**

4.  For every remaining safe device, import its RSA-OAEP public key and wrap `amk_v2`.

5.  Update `activeAmkId` to `amk_v2`. Append the new wrapping map to `keyring.amk_v2`. Delete the revoked device from the `devices` map.

6.  Commit the transaction.

**Part 2: The Batch Write (Data Migration)**

The user now has a new AMK, but all their `users/{uid}/keystore/{pollId}` entries are still encrypted with `amk_v1`. You must migrate them.

1.  Fetch *all* documents in `users/{uid}/keystore`.

2.  Initialize a Firestore `writeBatch`.

3.  Iterate through the documents:

    -   If `amkId` is already `amk_v2`, skip it.

    -   Decrypt `wrappedPayload` using `amk_v1`.

    -   Re-encrypt `wrappedPayload` using `amk_v2`.

    -   Queue a batch update: `{ wrappedPayload: newCipher, amkId: 'amk_v2' }`.

4.  Execute `batch.commit()`. *(Note: Firestore batches limit to 500 ops. If the user has >500 polls, chunk the array and run multiple batches sequentially).*

* * * * *

5\. Implementation Directives for the Junior Engineer
-----------------------------------------------------

1.  **Do not skip the transaction in Flow C.** If two devices attempt a rotation simultaneously, one must fail and retry. `runTransaction` handles this automatically.

2.  **Do not delete `amk_v1` from the keyring immediately.** If the user closes the browser during Part 2 of Flow C, the migration stops halfway. The next time they log in, your initialization logic must detect orphaned keystore entries (where `amkId !== activeAmkId`) and resume the batch migration. You can only delete `amk_v1` from the keyring when a query for `amkId == 'amk_v1'` returns zero results.

3.  **Strict Error Handling:** If `unwrapAmk` fails, the user's IndexedDB was wiped, and they lost their device private key. Catch this exception and immediately redirect them to a `Fatal Recovery` screen demanding their cold-storage Recovery Phrase. Do not swallow cryptographic exceptions.