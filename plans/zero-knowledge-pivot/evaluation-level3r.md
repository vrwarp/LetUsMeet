# Evaluation: Parallel Level 3R (Recovery) Key Model

This document evaluates the proposal to introduce a parallel "Level 3R" (Recovery) layer to the LetUsMeet cryptographic architecture, specifically focusing on the behavior of symmetric recovery keys (like WebAuthn PRF) during Account Master Key (AMK) rotation.

## 1. Current Architecture vs. Proposed Model

### Current Architecture (Hybrid L3)
*   **Level 3 (Device):** Asymmetric RSA-OAEP pairs (Public in Firestore, Private in IDB).
*   **Level 3 (Recovery):** Symmetric AES-GCM (Derived from PRF, wraps AMK in Firestore as `__recovery_prf`).
*   **Rotation Behavior:** When AMK rotates, the system attempts to re-wrap the new AMK with the `prfKey` automatically if available in the session.

### Chosen Model (Explicit L3R)
*   **Level 3D (Device):** Asymmetric pairs, strictly for active devices.
*   **Level 3R (Recovery):** A set of recovery methods (Passkeys, Phrases), each explicitly registered.
*   **Per-Credential PRF**: Instead of a single "recovery path," every unique PRF key (from different passkeys or devices) is registered as a separate recovery entry.
*   **Deterministic Identifiers**: PRF recovery methods are keyed by a stable identifier derived from the PRF key itself (e.g., `SHA-256` of the PRF key), ensuring that synced passkeys across devices map to the same recovery slot.
*   **Rotation Behavior**: When AMK rotates, the system attempts to re-wrap the new AMK with all recovery keys currently available in the session.

---

## 2. Security Analysis

### Pros
1.  **Low Friction:** Users don't need to manually "re-enable" recovery after every revocation. Access is maintained seamlessly if they have their passkey derived.
2.  **Platform Independence:** Decoupling 3R from the active device set makes it easier to support multiple recovery methods (e.g., PRF + a 24-word recovery phrase) without treating them like "ghost devices."
3.  **Persistence:** Ensures that "Cold Storage" (Phrases) stays valid even if the user isn't actively using the device that performs the revocation.

### Cons / Risks
1.  **Recovery Deadlock:** If a user revokes a stolen device from their only other laptop, and that laptop fails *before* they have re-enabled recovery, they are permanently locked out of their account keys.
2.  **UX Friction:** Users might find it annoying to have to "re-setup recovery" after revoking a device.

---

## 3. Implementation Logic

In the proposed model, the `revokeDevice` logic changes from **Updating** to **Purging**:

```typescript
// Proposed logic in revokeDevice
await runTransaction(db, async (transaction) => {
  const data = accountKeysSnap.data() as AccountKeysDocument;
  
  // 1. Clear ALL recovery wrappers (Level 3R)
  // This ensures no old recovery key can unlock the new AMK.
  Object.keys(data.keyring[newAmkId]).forEach(k => {
    if (k.startsWith("__recovery_")) delete data.keyring[newAmkId][k];
  });

  // 2. Wrap only for active, verified devices (Level 3D)
  for (const deviceId in data.devices) {
    // ... wrapping logic ...
  }
});
```

---

## 4. Verdict & Recommendation

The proposal for a **Parallel Level 3R** is a significantly more "paranoid" and secure approach than the current "Best Effort" PRF update. It aligns with the principle that a key rotation should be a "clean break" from the past.

**Recommendation:** 
Accept the proposal with one modification: **The UI must provide a clear "Recovery at Risk" warning** immediately after a device revocation, prompting the user to re-authenticate with WebAuthn to restore their recovery path.

**Action Plan:**
1.  Refactor `AccountKeysDocument` to explicitly separate `devices` (Level 3D) and `recoveryMethods` (Level 3R).
2.  Update `revokeDevice` to purge Level 3R entries.
3.  Add a `setupRecovery(type: 'prf' | 'phrase')` function to re-establish the Level 3R link.
