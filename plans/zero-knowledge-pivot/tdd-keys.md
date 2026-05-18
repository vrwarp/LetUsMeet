# Technical Design Document: Cryptographic Key Generation & Lifecycle

## 1. System Objective

This document defines the generation, storage, and execution lifecycles of the cryptographic primitives in the LetUsMeet Zero-Knowledge architecture.

The fundamental security invariant of this system is that **the server must never possess the raw key material required to decrypt a payload or forge a signature.** If a key touches a Cloud Function or is stored in plaintext in Firestore, the architecture has failed.

All cryptographic operations must use the native browser `window.crypto.subtle` API. Do not introduce third-party cryptography libraries.

---

## 2. The Cryptographic Primitives

You are responsible for managing three distinct types of keys. Each has a strict, mathematically isolated purpose.

### 2.1 The Symmetric Poll Key

* **Algorithm:** AES-GCM (128-bit).
* **Purpose:** Encrypts and decrypts the `encryptedData` payload of every event in a poll's ledger.
* **Format:** Exported as `raw` binary, encoded to a 22-character `Base64URL` string.
* **Generation Constraints:** Must be generated with `extractable: true` so it can be encoded into the URL fragment.
* **Usage Rule:** Always generate a new, random 96-bit (12-byte) Initialization Vector (IV) for *every* encryption operation using `crypto.getRandomValues`. Never reuse an IV.

### 2.2 The Identity Key Pair

* **Algorithm:** ECDSA (Curve P-256).
* **Purpose:** Proves ownership of an action without relying on Firebase Authentication.
* **Format:**
* **Public Key:** Exported as `spki`, encoded to standard `Base64`. This string acts as the user's absolute identifier within the poll.
* **Private Key:** Exported as `pkcs8`, encoded to standard `Base64`. Used to sign the SHA-256 hash of the `PollAction` JSON string.


* **Generation Constraints:** You must generate a *new* key pair for every single poll a user interacts with.
* **Usage Rule:** Never reuse an ECDSA key pair across different polls. Doing so leaks metadata linking a user's identity across distinct meetings.

### 2.3 The Master Sync Key

* **Algorithm:** AES-GCM (256-bit), derived via WebAuthn PRF (Pseudo-Random Function).
* **Purpose:** Encrypts the user's local keys (Symmetric + ECDSA Private) so they can be securely backed up to the Firestore Keystore for cross-device synchronization.
* **Format:** Transient byte array.
* **Usage Rule:** This key is strictly ephemeral. It must only exist in the browser's active memory (`sessionStorage` or a closure). **Never write this key to IndexedDB or localStorage.** It is derived from the hardware authenticator (e.g., TouchID) during an active session and destroyed when the tab closes.

---

## 3. Storage Architecture

Keys are distributed across three locations to balance zero-knowledge security with user experience.

1. **The URL Fragment (`#key={Base64URL_Symmetric_Key}`)**
* **Contains:** Only the Symmetric Poll Key.
* **Rule:** Fragments are never sent to the server in HTTP requests. The React router must intercept the fragment, extract the key, and hold it in memory.


2. **Firestore Keystore (`users/{uid}/keystore/{pollId}`)**
* **Contains:** A JSON blob containing the Symmetric Poll Key, ECDSA Public Key, and ECDSA Private Key.
* **Rule:** This entire JSON blob must be encrypted by the Master Sync Key *before* being written to Firestore.


3. **Local IndexedDB (`letusmeet_priv_{pollId}`)**
* **Contains:** The ECDSA Private Key.
* **Rule:** Used strictly as a fallback for anonymous (unauthenticated) participants who cannot utilize the Firestore Keystore.



---

## 4. Execution Lifecycles

Implement these precise sequences for the application's core flows. Deviating from these sequences introduces critical vulnerabilities.

### Flow A: Organizer Creates a Poll (The Genesis Block)

1. **Generate Symmetric Key:** Call `crypto.subtle.generateKey` for AES-GCM 128-bit.
2. **Generate Identity:** Call `crypto.subtle.generateKey` for ECDSA P-256.
3. **Sign Genesis Event:** Construct the `POLL_CREATED` action JSON. Sign it using the ECDSA Private Key.
4. **Encrypt Event:** Package the public key, signature, and action. Encrypt this package using the Symmetric Poll Key and a new IV. Write the resulting `BlindEvent` to Firestore.
5. **Persist to Keystore:** * Prompt the user for biometric authentication to derive the Master Sync Key via WebAuthn PRF.
* Package the Symmetric Key and ECDSA keys into a JSON object.
* Encrypt the JSON object with the Master Sync Key.
* Write the resulting `KeystoreEntry` to Firestore.


6. **Generate Share URL:** Export the Symmetric Poll Key to a Base64URL string and append it to the application URL as a fragment (e.g., `/p/12345#key=abc...`).

### Flow B: Authenticated Participant Votes

1. **Extract Decryption Key:** Parse `window.location.hash` to extract the Symmetric Poll Key. Do not proceed if missing.
2. **Check Keystore:** Query `users/{uid}/keystore/{pollId}`.
* *If an entry exists:* Derive the Master Sync Key via WebAuthn, decrypt the Keystore entry, and load the existing ECDSA keys into memory.
* *If no entry exists:* Generate a *new* ECDSA Key Pair. Derive the Master Sync Key, package the Symmetric Key (from the URL) and the new ECDSA keys, encrypt the package, and write the new `KeystoreEntry` to Firestore.


3. **Sign & Encrypt Vote:** Construct the `VOTE_UPSERT` action, sign it with the active ECDSA Private Key, encrypt it with the Symmetric Poll Key, and append the event to Firestore.

### Flow C: Anonymous Participant Votes

1. **Extract Decryption Key:** Parse the URL fragment for the Symmetric Poll Key.
2. **Check IndexedDB:** Look for an existing ECDSA Private Key for this specific `pollId`.
* *If found:* Load it into memory.
* *If not found:* Generate a new ECDSA Key Pair and save the Private Key to IndexedDB.


3. **Sign & Encrypt Vote:** Sign the action with the ECDSA Private Key, encrypt with the Symmetric Poll Key, and append the event.

---

## 5. Security Invariants (Do Not Violate)

* **No Fallback Decryption:** If a user navigates to a poll URL without the `#key=` fragment, you must immediately render a fatal error state. Do not attempt to load the poll metadata. You cannot decrypt it.
* **Strict Ephemerality:** Never write plaintext keys to `console.log()` during debugging. Remove all debug statements handling key material before committing code.
* **Signature Immutability:** The JSON stringification of the action payload must be deterministic (keys sorted consistently) before signing. If the JSON structure changes by a single byte or space between signing and verification, the signature check will fail, and the reducer will drop the event.