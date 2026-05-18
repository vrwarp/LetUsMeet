# Implementation Plan: Multi-Device Keystore & Envelope Encryption (Part 4/4)

## Phase 4: Core Workflows (Service Layer)

Create a new file `frontend/src/lib/deviceService.ts` or add to `pollService.ts` to handle device authorization flows.

### Flow A: Initial Setup (The Genesis Device)
Triggered when a user logs in and `account_keys/default` does not exist.
1. Generate `device_key_pair` (RSA-OAEP). Save the Private Key securely to IndexedDB.
2. Generate a new `amk_v1` (AES-GCM, 256-bit). Export it to a raw buffer.
3. Wrap `amk_v1` using `device_key_pair.publicKey`.
4. Write to `users/{uid}/account_keys/default`:
   - Set `devices`: Add the device public key.
   - Set `activeAmkId: 'amk_v1'`.
   - Set `keyring.amk_v1[deviceId]` to the wrapped key.

### Flow B: Authorizing a New Device
Requires an existing device online to sponsor.
1. **New Device:** Generates RSA-OAEP keys, saves private key locally, writes public key to temporary Firestore doc (e.g., `pending_devices/{deviceId}`).
2. **Sponsor Device:** Reads the pending public key. Uses a **Firestore Transaction** on `account_keys/default`.
3. **Sponsor Device:** Unwraps the active AMK using its local private key.
4. **Sponsor Device:** Wraps the AMK using the *New Device's* public key.
5. **Sponsor Device:** Appends the New Device to `devices` and the wrapped key to `keyring`. Commits transaction.

### Flow C: Device Revocation & Data Migration
When revoking an old device, all data must be re-encrypted.

**Part 1: Key Rotation (Transaction)**
1. Read `account_keys/default` via Firestore Transaction.
2. Generate `amk_v2`.
3. Iterate `devices` map, **skipping the revoked device**.
4. Wrap `amk_v2` for all remaining devices.
5. Update `activeAmkId` to `amk_v2`, append to `keyring.amk_v2`, delete revoked device from `devices`. Commit.

**Part 2: Data Migration (Batch Write)**
1. Fetch all docs in `users/{uid}/keystore`.
2. Init Firestore `writeBatch`.
3. Iterate docs:
   - Skip if `amkId == 'amk_v2'`.
   - Decrypt `wrappedPayload` using `amk_v1`.
   - Re-encrypt with `amk_v2`.
   - Queue update: `{ wrappedPayload: newCipher, amkId: 'amk_v2' }`.
4. `batch.commit()`. (Chunk to 500 ops if necessary).

---

## Phase 5: Implementation Directives
1. **Never skip transactions:** Use `runTransaction` for Flow C Part 1 to prevent race conditions.
2. **Orphaned Migrations:** Do not delete old AMKs from the keyring until `amkId == 'old_amk'` returns zero results. If migration fails halfway, initialization logic must detect orphaned entries and resume.
3. **Strict Error Handling:** If `unwrapAmk` fails, the user lost their local device key. Catch this and trigger a "Fatal Recovery" UI prompting for their Recovery Phrase. Do not swallow crypto exceptions.
