# Cryptographic Specification: Asymmetric Recovery Phrase (AIRK)

To implement the Asymmetric Recovery Phrase model while maintaining deterministic derivation and browser compatibility, we will use **ECDH (Elliptic Curve Diffie-Hellman)** on the **P-256** curve.

## 1. Key Derivation (Phrase to Private Key)
1.  **Mnemonic:** Generate a 24-word BIP39 mnemonic.
2.  **Seed:** Convert mnemonic to a 64-byte seed (BIP39).
3.  **Entropy:** Use the first 32 bytes of the seed as the raw private key material.
4.  **Import:** Use `crypto.subtle.importKey` with format `jwk` to create a deterministic **ECDH P-256 Private Key**.

## 2. Public Key Registration (Setup)
1.  Derive the **ECDH Public Key** from the Private Key.
2.  Export as **SubjectPublicKeyInfo (SPKI)** and store in `recoveryMethods` in Firestore.

## 3. AMK Wrapping (Rotation/Setup)
Active devices (which don't have the phrase) wrap the AMK using only the **AIRK Public Key**:
1.  Generate an **Ephemeral ECDH P-256 Key Pair**.
2.  Compute **Shared Secret** using `deriveBits` with (Ephemeral Private Key + AIRK Public Key).
3.  Derive **Symmetric Wrapping Key** (AES-GCM 256) from Shared Secret using HKDF or simple SHA-256.
4.  Encrypt **AMK** with Symmetric Wrapping Key.
5.  **Keyring Storage:** Store `{ ephemeralPublicKey: B64, ciphertext: B64, iv: B64 }`.

## 4. Recovery Flow
1.  User inputs phrase -> Derives **AIRK Private Key**.
2.  Fetch `{ ephemeralPublicKey, ciphertext, iv }` from keyring.
3.  Import **Ephemeral Public Key**.
4.  Compute **Shared Secret** using `deriveBits` with (AIRK Private Key + Ephemeral Public Key).
5.  Derive the same **Symmetric Wrapping Key**.
6.  Decrypt **AMK**.

## Advantages:
*   **Deterministic:** The same phrase always generates the same AIRK Public Key.
*   **Asymmetric:** Active devices can perform "Seal" operations without ever knowing the recovery secret.
*   **Standardized:** Uses Web Crypto API for all heavy lifting except the initial BIP39 mnemonic handling.
