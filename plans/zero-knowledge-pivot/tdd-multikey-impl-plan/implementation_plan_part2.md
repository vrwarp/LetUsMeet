# Implementation Plan: Multi-Device Keystore & Envelope Encryption (Part 2/4)

## Phase 2: Cryptographic Primitives

In this phase, you will extend the client-side cryptographic library to support RSA-OAEP keys, which serve as the Level 3 Key Encrypting Keys (KEKs) for devices.

**Rule:** Do not use third-party libraries. Stick to `window.crypto.subtle`.

### Task 2.1: Update `frontend/src/lib/crypto.ts`
Add functions to generate, export, import, wrap, and unwrap device keys.

1. Open `frontend/src/lib/crypto.ts`.
2. Add the `generateDeviceKeyPair` function:
   ```typescript
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
     ) as { publicKey: CryptoKey; privateKey: CryptoKey };
   }
   ```

3. Add import/export functions specifically for RSA-OAEP if your current ones are bound to ECDSA. It is safest to create explicit `exportDevicePublicKey`, `importDevicePublicKey`, `exportDevicePrivateKey`, `importDevicePrivateKey`. (See `exportPublicKey` in `crypto.ts` for reference, but change the `name` to `"RSA-OAEP"`).

4. Add `wrapAmk` to encrypt the symmetric AMK with a device's public key:
   ```typescript
   export async function wrapAmk(devicePublicKey: CryptoKey, rawAmkBuffer: ArrayBuffer): Promise<string> {
     const encrypted = await window.crypto.subtle.encrypt(
       { name: "RSA-OAEP" },
       devicePublicKey,
       rawAmkBuffer
     );
     return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
   }
   ```

5. Add `unwrapAmk` to decrypt the AMK using a device's private key:
   ```typescript
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

### Task 2.2: Add Tests
1. Open `frontend/src/lib/crypto.test.ts`.
2. Add a `describe('RSA-OAEP Device Keys', ...)` block.
3. Test key generation, exporting, and importing.
4. Test wrapping a dummy AMK buffer and successfully unwrapping it with the private key.

**Definition of Done (Part 2):**
- `crypto.ts` contains RSA-OAEP primitives.
- `crypto.test.ts` has passing tests for wrapping and unwrapping AMKs.
