Technical Design Document: Zero-Knowledge Event Sourcing Architecture
=====================================================================

1\. Architectural Paradigm Shift
--------------------------------

LetUsMeet is migrating from a traditional CRUD (Create, Read, Update, Delete) database model to a **Zero-Knowledge, Append-Only Event Sourcing** model.

In this architecture, the Firestore database is completely blind. It does not know the title of a meeting, who is attending, or even who the organizer is. It functions strictly as a dumb, immutable ledger.

**Key Concepts for Implementation:**

1.  **Cryptography over Authentication:** Firebase Auth is no longer used for authorization on the `polls` collection. Identity and ownership are proven entirely through client-side ECDSA (Elliptic Curve Digital Signature Algorithm) signatures.

2.  **Event Sourcing:** The state of a poll is not stored in the database. Instead, the database stores a sequential log of encrypted events. The React client downloads this log, decrypts it, verifies the cryptographic signatures, and calculates the current state locally (the "Reducer").

3.  **The Genesis Block:** The public key that signs the very first event in a poll's ledger (the `POLL_CREATED` event) is permanently recognized by the client application as the "Admin" for that poll.

* * * * *

2\. The Data Model
------------------

The data model is split into two halves: the **Firestore Schema** (what the database sees) and the **Decrypted Schema** (what the client processes in memory).

### 2.1 The Firestore Schema (Publicly Readable Ciphertext)

These interfaces define the exact shape of documents stored in Firestore. No sensitive data exists here.

TypeScript

```
// Path: polls/{pollId}
// The Poll document is merely an empty namespace container for the events subcollection.
export interface BlindPoll {
  pollId: string;
}

// Path: polls/{pollId}/events/{eventId}
// This is the immutable ledger entry.
export interface BlindEvent {
  eventId: string;
  createdAt: number;     // MUST be a Firebase FieldValue.serverTimestamp()
  encryptedData: string; // AES-GCM Ciphertext (Base64)
  iv: string;            // AES-GCM Initialization Vector (Base64)
}

// Path: users/{userId}/keystore/{pollId}
// The synchronized keystore encrypted by the WebAuthn PRF Master Key.
export interface KeystoreEntry {
  pollId: string;
  wrappedPayload: string; // PRF-encrypted ciphertext
  iv: string;             // PRF Initialization Vector
  updatedAt: number;      // FieldValue.serverTimestamp()
}

```

### 2.2 The Decrypted Schema (Client-Side Memory)

When the client decrypts `BlindEvent.encryptedData` using the symmetric AES Poll Key (obtained from the URL fragment or Keystore), it yields a `DecryptedSignedEvent`.

TypeScript

```
// The JSON structure inside the decrypted event blob.
export interface DecryptedSignedEvent {
  publicKey: string;     // Base64 ECDSA Public Key. This IS the user's identity.
  signature: string;     // ECDSA signature of the stringified `action`
  action: PollAction;    // The actual state mutation
}

// The comprehensive list of permitted mutations
export type PollAction =
  | { type: "POLL_CREATED"; payload: PollMetadata }
  | { type: "POLL_UPDATED"; payload: Partial<PollMetadata> }
  | { type: "POLL_FINALIZED"; payload: { finalizedSlotId: string } }
  | { type: "VOTE_UPSERT"; payload: VoteData }
  | { type: "VOTE_RETRACTED"; payload: null };

export interface PollMetadata {
  title: string;
  location: string;
  schedulingMode: "EXACT" | "FUZZY";
  timeSlots: TimeSlot[];
}

export interface VoteData {
  participantName: string;
  selections: Record<string, "YES" | "NO" | "IF_NEED_BE">;
  clientTimestamp: number;
}

```

When the client decrypts `KeystoreEntry.wrappedPayload` using their biometric PRF key, it yields the cryptographic material necessary to view and interact with the poll.

TypeScript

```
// The JSON structure inside the decrypted keystore blob.
export interface DecryptedKeystorePayload {
  symmetricPollKey: string; // Base64 AES-GCM key (For decrypting events)
  ecdsaPrivateKey: string;  // Base64 PKCS8 key (For signing outgoing actions)
  ecdsaPublicKey: string;   // Base64 SPKI key (The user's identity)
}

```

* * * * *

3\. Firestore Security Rules
----------------------------

Because Firestore is blind to the business logic, the security rules are aggressively simple. They exist solely to enforce schema structure and chronological immutability. The client application is entirely responsible for ignoring unauthorized or forged events.

JavaScript

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ----------------------------------------------------------------------
    // 1. THE UNIFIED KEYSTORE
    // This is the only collection that uses Firebase Auth. It is strictly
    // isolated per user. A user can only access their own cryptographic keys.
    // ----------------------------------------------------------------------
    match /users/{userId}/keystore/{pollId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.data.keys().hasAll(['pollId', 'wrappedPayload', 'iv', 'updatedAt']);
    }

    // ----------------------------------------------------------------------
    // 2. THE EVENT SOURCING LEDGER
    // The polls collection acts as a trustless, decentralized state machine.
    // ----------------------------------------------------------------------
    match /polls/{pollId} {
      // The poll document acts purely as a namespace.
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;

      match /events/{eventId} {
        // Anyone who knows the pollId (via the URL) can fetch the encrypted ledger.
        allow read: if true;

        // APPEND ONLY LOGIC
        // We do not check Firebase Auth. We only check that the payload is formatted
        // correctly and that the client cannot spoof the chronological order.
        allow create: if request.resource.data.keys().hasAll(['eventId', 'createdAt', 'encryptedData', 'iv'])
          // CRITICAL: The client MUST use Firebase FieldValue.serverTimestamp().
          // This prevents an attacker from backdating an event to manipulate state.
          && request.resource.data.createdAt == request.time;

        // IMMUTABILITY GUARANTEE
        // Events can never be altered or destroyed once logged. To "edit" a vote,
        // the user must append a new VOTE_UPSERT event. To "delete" a vote, they
        // append a VOTE_RETRACTED event.
        allow update, delete: if false;
      }
    }
  }
}

```

* * * * *

4\. Implementation Directives for Client Integration
----------------------------------------------------

When building the React client around this data model, adhere to the following rules:

1.  **Serialization Strictness:** When generating the ECDSA signature for the `action` object, ensure the JSON stringification is deterministic (keys sorted consistently). If the stringification differs between the signing phase and the verification phase, the signature will fail.

2.  **Handling Forged Events:** Because the `events` collection allows unauthenticated creates, attackers can append garbage ciphertext. The client-side reducer must wrap the AES decryption and ECDSA verification in a `try/catch`. If an event fails decryption or signature validation, log a warning to the console and cleanly drop the event from the reducer loop. Do not crash the application.

3.  **The Admin Key Check:** During the reducer loop, capture the `publicKey` of the very first `POLL_CREATED` event. If any subsequent `POLL_UPDATED` or `POLL_FINALIZED` events are encountered, drop them immediately unless their `publicKey` strictly matches the captured Admin Key.