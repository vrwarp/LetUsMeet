# Implementation Plan: Multi-Device Keystore & Envelope Encryption (Part 1/4)

This is a step-by-step implementation guide based on the `tdd-multikey.md` design document. It is broken down into parts for clarity.

## Overview
We are shifting away from relying solely on WebAuthn PRF for cross-device sync. Instead, we are implementing **Envelope Encryption** and an **Append-Only Keyring**. This decouples device authentication from poll decryption, allowing for true cross-platform usage and cold-storage recovery.

**Core Rule:** Firebase Cloud Functions must NEVER process or migrate plaintext keys. All cryptographic operations must occur client-side in the browser.

## Terminology
Before starting, ensure you understand the three layers of keys:
1. **Poll Keys (Level 1):** The AES-GCM symmetric key (URL) and ECDSA identity key pair (Keystore). These *never* rotate.
2. **Account Master Key / AMK (Level 2):** An AES-GCM 256-bit symmetric key. Its purpose is to encrypt the user's `KeystoreEntry` for each poll.
3. **Key Encrypting Keys / KEKs (Level 3):** Asymmetric RSA-OAEP key pairs generated *per device*. The public key is in Firestore; the private key is in IndexedDB (or a Recovery Phrase). The KEK Public Key encrypts the AMK.

---

## Phase 1: Data Model Updates

Your first task is to update the shared types to support the new multi-device architecture.

### Task 1.1: Update `shared/types.ts`
Add the new device and account key structures, and modify the existing `KeystoreEntry`.

1. Open `shared/types.ts`.
2. Add the `DevicePublicKey` interface:
   ```typescript
   export interface DevicePublicKey {
     deviceId: string;
     deviceName: string; // e.g., "Benson's MacBook"
     publicKey: string; // Base64 SPKI (RSA-OAEP)
     createdAt: number;
   }
   ```
3. Add the `AccountKeysDocument` interface:
   ```typescript
   export interface AccountKeysDocument {
     activeAmkId: string; // e.g., "amk_v1"
     devices: Record<string, DevicePublicKey>; // Keyed by deviceId
     keyring: Record<string, Record<string, string>>;
     // Map of amkId -> { deviceId: "wrapped_amk_base64" }
   }
   ```
4. Modify the existing `KeystoreEntry` interface to include the `amkId`:
   ```typescript
   export interface KeystoreEntry {
     pollId: string;
     amkId: string; // NEW: Explicitly declare which AMK encrypted this payload
     wrappedPayload: string;
     iv: string;
     updatedAt: number;
   }
   ```

**Definition of Done (Part 1):**
- `shared/types.ts` is updated with the new interfaces.
- TypeScript compiler passes without errors regarding these new types.

*Proceed to Part 2 for Cryptographic Primitives.*
