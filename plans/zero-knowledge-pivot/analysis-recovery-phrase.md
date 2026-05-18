# Analysis: Recovery Phrases vs. AMK Rotations

Introducing a **Recovery Phrase** (e.g., 24-word mnemonic) as a Level 3R key creates a conflict between our security model ("Purge on Rotation") and the user's expectation of "Cold Storage" persistence.

## 1. The Current Conflict

In the current **Purge-on-Rotation** model:
1.  **Rotation:** A device revocation triggers an AMK rotation.
2.  **Purge:** The system deletes all `__recovery_*` wrappers for the new AMK.
3.  **Result:** The Recovery Phrase (which is usually stored in a physical safe or cold storage) becomes **instantly invalid** for the new AMK.

**The Risk:** If a user revokes a lost phone from their laptop, and then the laptop breaks the next day, their "Cold Storage" recovery phrase will fail to unlock the vault. This creates a "Security Trap" where the user believes they are backed up when they are not.

---

## 2. Proposed Solutions

### Solution A: The "Active Re-Seal" (Current Implementation)
The system treats the Recovery Phrase like a Passkey. After every rotation, the user is prompted to "Re-Seal" their recovery methods.
*   **Pros:** Maximum security; ensures the user still has the phrase; consistent with the PRF flow.
*   **Cons:** Terrible UX for cold storage. Users will not want to dig their phrase out of a safe every time they buy a new phone or revoke an old one.

### Solution B: Persistent Recovery (The "Exemption" Model)
We modify `revokeDevice` to **not** purge the Recovery Phrase wrapper if we have the necessary keys in the current session to update it.
*   **Mechanism:** If the user has their recovery phrase "loaded" in the session (unlikely for cold storage) or if we use an intermediate **Recovery Key Encryption Key (RKEK)**.
*   **Pros:** High persistence.
*   **Cons:** Weakens the "Clean Break" principle. If the Recovery Phrase itself is what was compromised, the rotation doesn't stop the attacker.

### Solution C: Asymmetric Intermediate Recovery Key (AIRK)
We introduce an asymmetric intermediate layer between Level 3R and Level 2 (AMK).
1.  **AIRK:** An RSA-OAEP key pair derived from the Recovery Phrase.
2.  **Public Key Storage:** The **AIRK Public Key** is stored in Firestore (`recoveryMethods`).
3.  **AMK Wrapper:** The AMK is wrapped with the **AIRK Public Key** (stored in the `keyring`).
4.  **Rotation:** When the AMK rotates, any active device (which can see the AIRK Public Key in Firestore) simply re-wraps the **new AMK** with that same public key.
*   **Pros:** The Recovery Phrase stays valid forever across all rotations. Active devices **never** see the private recovery secret; they only use the public key to "seal" the new AMK.
*   **Cons:** If the AIRK Private Key is compromised (e.g., the user loses their physical sheet of paper), rotations are useless against that specific compromise.

---

## 3. Recommendation: Solution C (Asymmetric IRK)

For "Cold Storage" methods like phrases, we should move toward an **Asymmetric Intermediate Recovery Key (AIRK)** model.

1.  **Setup:** 
    *   Recovery Phrase derives an **RSA-OAEP Private Key**.
    *   The **RSA Public Key** is saved in Firestore.
2.  **Rotation:** 
    *   When the `AMK` rotates to `AMK_v2`, any active device fetches the **AIRK Public Key**.
    *   It wraps the new `AMK_v2` with that Public Key.
3.  **Recovery:** 
    *   The user provides the phrase -> derives the **RSA Private Key**.
    *   Unwraps the latest `AMK` from the keyring.

**Verdict:** This is the most elegant solution. It maintains the "Clean Break" principle for devices while allowing cold storage to remain valid indefinitely without decreasing the security of active devices.
