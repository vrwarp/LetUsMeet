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

### 2.2 Refactor `revokeDevice` (The "Purge" Logic)
*   Generate new AMK.
*   Update all active device wrappers (Level 3D).
*   **Purge all recovery entries** in the new `amkId` slot of the keyring.
*   This forces a "Security Gap" that the user must explicitly close by re-authenticating with their recovery method.

### 2.3 Implement `enableRecoveryMethod(type: 'prf')`
*   New function in `deviceService.ts`.
*   Authenticates via PRF.
*   Wraps the **current active AMK** with the derived PRF key.
*   Updates the `AccountKeysDocument` to restore the recovery entry in the `keyring`.

### 2.4 Update `getActiveAmk` Fallback
*   If device keys are missing, check `recoveryMethods` and the `keyring` for any `__recovery_` entries.
*   If found, trigger the existing `tryRecoverAmkWithPrf` logic.

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
By purging recovery on rotation, we ensure that a compromised recovery key cannot be used to unlock data generated *after* a security event (revocation), unless the user (the true owner) re-authorizes it.
