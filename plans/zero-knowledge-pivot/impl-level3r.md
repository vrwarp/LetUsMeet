# Implementation Plan: Level 3R (Recovery) Model

This plan outlines the steps to transition from the hybrid Level 3 model to a parallel Level 3R (Recovery) architecture. This ensures that recovery methods are explicitly managed and protected during key rotations.

## Phase 1: Data Model Refactoring

### 1.1 Update `AccountKeysDocument`
We will formalize the separation between devices (Level 3D) and recovery methods (Level 3R).

```typescript
// shared/types.ts
export interface RecoveryMethod {
  type: 'prf' | 'phrase';
  label: string; // e.g. "Google Passkey", "Primary Recovery Phrase"
  createdAt: number;
}

export interface AccountKeysDocument {
  activeAmkId: string;
  devices: { [deviceId: string]: DevicePublicKey };
  recoveryMethods: { [methodId: string]: RecoveryMethod }; // New field
  keyring: {
    [amkId: string]: {
      [id: string]: string; // id can be a deviceId or a recovery methodId (prefixed)
    }
  };
}
```

## Phase 2: Core Service Updates

### 2.1 Update `setupGenesisDevice`
*   Register the initial device in `devices`.
*   Register the PRF method in `recoveryMethods`.
*   Wrap the AMK for both and store in the `keyring`.

### 2.2 Refactor `revokeDevice` (The "Persistence" Logic)
*   Generate new AMK.
*   Update all active device wrappers (Level 3D).
*   **Update Asymmetric Recovery wrappers** (like Phrases) by using their **Public Key** to re-wrap the new AMK. 
*   **Attempt Symmetric Recovery re-wrapping** (like PRF):
    *   Attempt to derive the `prfKey` silently (using IndexedDB cache).
    *   If available, re-wrap the new AMK for all PRF methods in `recoveryMethods`.
*   This ensures recovery stays valid across rotations without user intervention.

### 2.3 Implement `enableRecoveryMethod(type: 'prf')`
*   Authenticates via PRF and derives `prfKey`.
*   Generate a deterministic **Method ID** by hashing the `prfKey` (e.g., `SHA-256` of the raw key bytes).
*   Wraps the **current active AMK** with the `prfKey`.
*   Updates `recoveryMethods` with the label (e.g., "Passkey on MacBook") and `credentialId`.
*   Updates the `keyring` for the current `amkId` using the hash-based Method ID.
*   **Opportunistic Check**: On every sign-in/action, if a `prfKey` is in the session, check if its hash-based Method ID exists in the `keyring` for the current AMK. If not, auto-enable it.

### 2.4 Update `getActiveAmk` Fallback
*   If device keys are missing, check `recoveryMethods`.
*   For `prf`: Try `tryRecoverAmkWithPrf` (uses existing symmetric logic).
*   For `phrase`: Prompt for phrase -> derive RSA Private Key -> unwrap AMK.

## Phase 3: UI & UX Integration

### 3.1 Dashboard Status
*   Add a "Security & Recovery" section to the Dashboard.
*   Show a green checkmark if at least one recovery method is "Sealed" (present in the current AMK keyring).
*   Show a red warning ("Recovery Disabled") if the keyring for the current AMK has no recovery entries.

### 3.2 Recovery Setup Modal
*   Provide a button to "Enable Passkey Recovery."
*   Triggers the PRF flow and `enableRecoveryMethod`.

## Phase 4: Verification

### 4.1 Unit Tests
*   Test that `revokeDevice` correctly deletes `__recovery_prf` from the new `amkId` slot.
*   Test that `getActiveAmk` throws if the device is lost AND recovery was purged.
*   Test that calling `enableRecoveryMethod` restores access.

---

## 5. Security Note
By automatically re-wrapping recovery keys during rotation, we prioritize availability and low friction. Since revocation events are user-initiated, we assume the session performing the revocation is trusted and can safely propagate the security update to the recovery layer.
