# Evaluation: Parallel Level 3R (Recovery) Key Model

This document evaluates the proposal to introduce a parallel "Level 3R" (Recovery) layer to the LetUsMeet cryptographic architecture, specifically focusing on the behavior of symmetric recovery keys (like WebAuthn PRF) during Account Master Key (AMK) rotation.

## 1. Current Architecture vs. Proposed Model

### Current Architecture (Hybrid L3)
*   **Level 3 (Device):** Asymmetric RSA-OAEP pairs (Public in Firestore, Private in IDB).
*   **Level 3 (Recovery):** Symmetric AES-GCM (Derived from PRF, wraps AMK in Firestore as `__recovery_prf`).
*   **Rotation Behavior:** When AMK rotates, the system attempts to re-wrap the new AMK with the `prfKey` automatically if available in the session.

### Proposed Model (Explicit L3R)
*   **Level 3D (Device):** Asymmetric pairs, strictly for active devices.
*   **Level 3R (Recovery):** Symmetric keys (PRF, Recovery Phrase), treated as a separate "recovery set."
*   **Proposed Rotation Behavior:** When AMK rotates (e.g., during revocation), **all Level 3R wrappers are cleared**. Recovery remains disabled until a user explicitly re-authenticates with their recovery method to "re-seal" the new AMK.

---

## 2. Security Analysis

### Pros
1.  **Forward Secrecy for Recovery:** If a PRF key were somehow compromised, a single AMK rotation (revocation) would terminate that compromise's access to future data. The attacker would not be able to "follow" the rotation because the recovery wrapper is deleted, not updated.
2.  **Explicit Consent:** Forcing the user to re-enable recovery after a major security event (like revoking a device) ensures that the recovery "path" is actively maintained and verified.
3.  **Platform Independence:** Decoupling 3R from the active device set makes it easier to support multiple recovery methods (e.g., PRF + a 24-word recovery phrase) without treating them like "ghost devices."

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
