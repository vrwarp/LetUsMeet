# Analysis: Device-Centric vs. Identity-Centric Level 3 Keys

## 1. The Current Model (Device-Centric)
Every "Device" (browser instance + origin) generates a random RSA-OAEP key pair.
*   **Storage:** Private key in IndexedDB; Public key in Firestore.
*   **Revocation:** Removing a `deviceId` from Firestore and rotating the AMK immediately excludes that browser.
*   **Friction:** Clearing cookies/site data destroys the Private Key, requiring "Recovery" or "Re-registration".

## 2. The Proposed Model (Identity-Centric / PRF-Derived)
Instead of random keys, we derive Level 3 keys from the **WebAuthn PRF**.
*   **Concept:** PRF Output -> Seed -> Deterministic Key Pair (or Symmetric Key wrapping a persistent Key Pair).
*   **Behavior:** If a user has a synced Passkey (i.e., iCloud Keychain), any device they sign into *automatically* becomes an "authorized device" without explicit registration.

## 3. Comparison of Models

| Feature | Device-Centric (Current) | Identity-Centric (Proposed) |
| :--- | :--- | :--- |
| **Trust Boundary** | The physical hardware/browser instance. | The Passkey (Credential ID). |
| **User Experience** | High friction (must register every browser). | Low friction (sign in and "it just works"). |
| **Revocation** | Granular (can kick off "Work Laptop"). | Coarse (must revoke the whole Passkey). |
| **Persistence** | Volatile (lost on "Clear Site Data"). | Persistent (survives site data clearing). |
| **Security** | Hardware-bound (if using platform TPM). | Identity-bound (shared across synced devices). |

## 4. The "Hybrid" Reality
Actually, our current **Level 3R (Recovery)** *is* the Identity-Centric model.
*   `__recovery_prf` is an identity-bound key.
*   `__recovery_phrase` is an identity-bound key.

**The real question is: Why do we have Level 3D (Device) keys at all?**
If we only used Level 3R, then:
1.  User signs in.
2.  User provides PRF.
3.  Client unwraps AMK.
4.  **No local keys are stored.**

**Why we have Level 3D today:**
*   **Background Sync:** If we want the app to sync in the background (e.g., push notifications or service workers) without the user interacting with a hardware key every time, we need a "Device Key" that doesn't require a biometric prompt.
*   **Non-PRF Browsers:** Some browsers support WebAuthn but not the `prf` extension. Level 3D allows them to function after an initial "Verification" step.

## 5. Recommendation: The "Shadow Device" Model
We should keep the **Device Keys**, but change how they are initialized:
1.  **Silent Registration:** If a user signs in with a PRF-enabled Passkey, the client uses the PRF to unwrap the AMK and *silently* generates a random Device Key for that session.
2.  **Passkey-as-Primary:** We treat the Passkey as the "Primary Level 3" and the Device Key as an "Ephemeral Level 3" for performance and background access.

## Conclusion
Pivoting to derive *everything* from PRF is tempting for UX, but it loses the ability to **revoke a specific stolen laptop** without also revoking the passkey from the user's phone. 

**Proposed Action:**
*   **Keep Device IDs:** They are the unit of revocation.
*   **Improve UX:** Use the "Symmetric-Wrapped RSA" (AIRK) pattern to make the PRF recovery feel like a primary login. If a device is "unrecognized" but the PRF is valid, we should **auto-register** it as a new device rather than showing a "Mismatch" error.
