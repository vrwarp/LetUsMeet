# Technical Design Document: The Client-Side Cryptographic Reducer

## 1. System Objective

In a Zero-Knowledge Event Sourcing architecture, the backend database (Firestore) is mathematically blind and enforces zero business logic. It merely acts as a chronological message broker for ciphertext.

Therefore, the **Client-Side Reducer** is the absolute source of truth and the primary security enforcer of the LetUsMeet application. Its job is to ingest the raw event ledger, verify the cryptographic integrity of every entry, silently drop malicious or forged data, and calculate the current UI state of the meeting.

If the reducer logic is flawed, an attacker can manipulate the perceived state of the poll for anyone viewing it.

---

## 2. The Input and Output Data Structures

The reducer operates as a pure function (or a predictable async function, due to the Web Crypto API) that takes an array of events and outputs a state object.

### 2.1 The Input

The input is an array of `DecryptedSignedEvent` objects. The React application must decrypt the Firestore `BlindEvent` array using the AES Symmetric Poll Key *before* passing the data to the reducer.

**CRITICAL PREREQUISITE:** The input array **must** be sorted chronologically by the `createdAt` server timestamp before it enters the reducer. Processing out of order will result in a corrupted state.

```typescript
export interface DecryptedSignedEvent {
  publicKey: string;  // Base64 ECDSA Public Key
  signature: string;  // Base64 ECDSA Signature
  action: PollAction; // The JSON payload of the mutation
}

```

### 2.2 The Output State

The output is the `PollState` object, which directly drives the React UI (e.g., rendering the voting grid, disabling inputs if finalized, showing the title).

```typescript
export interface PollState {
  adminPublicKey: string | null; // The absolute owner of the poll
  metadata: PollMetadata | null; // Title, Location, TimeSlots
  votes: Map<string, VoteData>;  // Keyed by the participant's ECDSA Public Key
  isFinalized: boolean;
}

```

---

## 3. The Core Reducer Implementation

This is the exact implementation structure required for the reducer. It must evaluate every event strictly in sequence.

```typescript
import { verifySignature } from './crypto';

export const calculatePollState = async (
  events: DecryptedSignedEvent[]
): Promise<PollState> => {
  
  // Initialize the empty state
  const state: PollState = {
    adminPublicKey: null,
    metadata: null,
    votes: new Map(),
    isFinalized: false,
  };

  // Process chronologically
  for (const event of events) {
    
    // ==========================================
    // PHASE 1: CRYPTOGRAPHIC VERIFICATION
    // ==========================================
    
    // If the signature fails, the event is forged. Drop it entirely.
    const isValid = await verifySignature(event.publicKey, event.signature, event.action);
    if (!isValid) {
      console.warn("Invalid signature detected. Dropping forged event.");
      continue; 
    }

    // ==========================================
    // PHASE 2: STATE APPLICATION & AUTHORIZATION
    // ==========================================
    
    switch (event.action.type) {
      
      // --- THE GENESIS BLOCK ---
      case "POLL_CREATED":
        if (!state.adminPublicKey) {
          // The public key of the first valid event becomes the immutable Admin Key
          state.adminPublicKey = event.publicKey;
          state.metadata = event.action.payload;
        }
        break;

      // --- ADMIN ACTIONS ---
      case "POLL_UPDATED":
        // Authorization: Only the Admin Key can update metadata
        if (event.publicKey !== state.adminPublicKey) {
          console.warn("Unauthorized attempt to update metadata.");
          continue;
        }
        // Merge the partial updates
        if (state.metadata) {
          state.metadata = { ...state.metadata, ...event.action.payload };
        }
        break;

      case "POLL_FINALIZED":
        // Authorization: Only the Admin Key can finalize the poll
        if (event.publicKey !== state.adminPublicKey) {
          console.warn("Unauthorized attempt to finalize poll.");
          continue;
        }
        state.isFinalized = true;
        // In a real implementation, you might also store the finalizedSlotId in the state here
        break;

      // --- PARTICIPANT ACTIONS ---
      case "VOTE_UPSERT":
        // Business Logic: Reject votes that occur after the poll is finalized
        if (state.isFinalized) {
           console.info("Vote submitted after finalization. Ignoring.");
           continue;
        }
        // State Update: The Map naturally handles overwrites. 
        // If the same public key submits a new vote, it replaces the old one.
        state.votes.set(event.publicKey, event.action.payload);
        break;

      case "VOTE_RETRACTED":
        // Business Logic: Cannot retract after finalization
        if (state.isFinalized) continue;
        
        // Remove the user's vote from the state
        state.votes.delete(event.publicKey);
        break;
    }
  }

  return state;
};

```

---

## 4. Security Vectors & Mitigation

The reducer is the only line of defense against malicious data. It must be resilient against the following specific attack vectors.

### 4.1 The Sybil / Masquerade Attack

* **Attack:** User B wants to change User A's vote. User B constructs a `VOTE_UPSERT` payload with User A's name and encrypts it with the URL fragment key.
* **Mitigation:** User B does not possess User A's ECDSA Private Key. User B is forced to sign the payload with their *own* private key. When the reducer processes the event, it uses User B's public key for the Map insertion. User A's original vote remains untouched in the state. User B merely created a new row in the grid with User A's display name.

### 4.2 The Admin Takeover

* **Attack:** An attacker appends a `POLL_UPDATED` event to change the meeting location to a malicious link.
* **Mitigation:** The reducer's `POLL_CREATED` case locks the `state.adminPublicKey`. When the reducer evaluates the attacker's `POLL_UPDATED` event, it checks `if (event.publicKey !== state.adminPublicKey)`. The check fails, and the reducer drops the malicious event.

### 4.3 The Time Travel Attack

* **Attack:** An attacker attempts to submit a vote after the organizer has finalized the poll by forging the `clientTimestamp` in the payload.
* **Mitigation:** The reducer relies on the chronological sequence of events as dictated by the Firestore `createdAt` server timestamp, *not* the client-provided timestamp. If a `VOTE_UPSERT` event appears in the array *after* the `POLL_FINALIZED` event, the `if (state.isFinalized)` check triggers and drops the vote, regardless of what the payload's internal clock claims.# Technical Design Document: The Client-Side Cryptographic Reducer

## 1. System Objective

In a Zero-Knowledge Event Sourcing architecture, the backend database (Firestore) is mathematically blind and enforces zero business logic. It merely acts as a chronological message broker for ciphertext.

Therefore, the **Client-Side Reducer** is the absolute source of truth and the primary security enforcer of the LetUsMeet application. Its job is to ingest the raw event ledger, verify the cryptographic integrity of every entry, silently drop malicious or forged data, and calculate the current UI state of the meeting.

If the reducer logic is flawed, an attacker can manipulate the perceived state of the poll for anyone viewing it.

---

## 2. The Input and Output Data Structures

The reducer operates as a pure function (or a predictable async function, due to the Web Crypto API) that takes an array of events and outputs a state object.

### 2.1 The Input

The input is an array of `DecryptedSignedEvent` objects. The React application must decrypt the Firestore `BlindEvent` array using the AES Symmetric Poll Key *before* passing the data to the reducer.

**CRITICAL PREREQUISITE:** The input array **must** be sorted chronologically by the `createdAt` server timestamp before it enters the reducer. Processing out of order will result in a corrupted state.

```typescript
export interface DecryptedSignedEvent {
  publicKey: string;  // Base64 ECDSA Public Key
  signature: string;  // Base64 ECDSA Signature
  action: PollAction; // The JSON payload of the mutation
}

```

### 2.2 The Output State

The output is the `PollState` object, which directly drives the React UI (e.g., rendering the voting grid, disabling inputs if finalized, showing the title).

```typescript
export interface PollState {
  adminPublicKey: string | null; // The absolute owner of the poll
  metadata: PollMetadata | null; // Title, Location, TimeSlots
  votes: Map<string, VoteData>;  // Keyed by the participant's ECDSA Public Key
  isFinalized: boolean;
}

```

---

## 3. The Core Reducer Implementation

This is the exact implementation structure required for the reducer. It must evaluate every event strictly in sequence.

```typescript
import { verifySignature } from './crypto';

export const calculatePollState = async (
  events: DecryptedSignedEvent[]
): Promise<PollState> => {
  
  // Initialize the empty state
  const state: PollState = {
    adminPublicKey: null,
    metadata: null,
    votes: new Map(),
    isFinalized: false,
  };

  // Process chronologically
  for (const event of events) {
    
    // ==========================================
    // PHASE 1: CRYPTOGRAPHIC VERIFICATION
    // ==========================================
    
    // If the signature fails, the event is forged. Drop it entirely.
    const isValid = await verifySignature(event.publicKey, event.signature, event.action);
    if (!isValid) {
      console.warn("Invalid signature detected. Dropping forged event.");
      continue; 
    }

    // ==========================================
    // PHASE 2: STATE APPLICATION & AUTHORIZATION
    // ==========================================
    
    switch (event.action.type) {
      
      // --- THE GENESIS BLOCK ---
      case "POLL_CREATED":
        if (!state.adminPublicKey) {
          // The public key of the first valid event becomes the immutable Admin Key
          state.adminPublicKey = event.publicKey;
          state.metadata = event.action.payload;
        }
        break;

      // --- ADMIN ACTIONS ---
      case "POLL_UPDATED":
        // Authorization: Only the Admin Key can update metadata
        if (event.publicKey !== state.adminPublicKey) {
          console.warn("Unauthorized attempt to update metadata.");
          continue;
        }
        // Merge the partial updates
        if (state.metadata) {
          state.metadata = { ...state.metadata, ...event.action.payload };
        }
        break;

      case "POLL_FINALIZED":
        // Authorization: Only the Admin Key can finalize the poll
        if (event.publicKey !== state.adminPublicKey) {
          console.warn("Unauthorized attempt to finalize poll.");
          continue;
        }
        state.isFinalized = true;
        // In a real implementation, you might also store the finalizedSlotId in the state here
        break;

      // --- PARTICIPANT ACTIONS ---
      case "VOTE_UPSERT":
        // Business Logic: Reject votes that occur after the poll is finalized
        if (state.isFinalized) {
           console.info("Vote submitted after finalization. Ignoring.");
           continue;
        }
        // State Update: The Map naturally handles overwrites. 
        // If the same public key submits a new vote, it replaces the old one.
        state.votes.set(event.publicKey, event.action.payload);
        break;

      case "VOTE_RETRACTED":
        // Business Logic: Cannot retract after finalization
        if (state.isFinalized) continue;
        
        // Remove the user's vote from the state
        state.votes.delete(event.publicKey);
        break;
    }
  }

  return state;
};

```

---

## 4. Security Vectors & Mitigation

The reducer is the only line of defense against malicious data. It must be resilient against the following specific attack vectors.

### 4.1 The Sybil / Masquerade Attack

* **Attack:** User B wants to change User A's vote. User B constructs a `VOTE_UPSERT` payload with User A's name and encrypts it with the URL fragment key.
* **Mitigation:** User B does not possess User A's ECDSA Private Key. User B is forced to sign the payload with their *own* private key. When the reducer processes the event, it uses User B's public key for the Map insertion. User A's original vote remains untouched in the state. User B merely created a new row in the grid with User A's display name.

### 4.2 The Admin Takeover

* **Attack:** An attacker appends a `POLL_UPDATED` event to change the meeting location to a malicious link.
* **Mitigation:** The reducer's `POLL_CREATED` case locks the `state.adminPublicKey`. When the reducer evaluates the attacker's `POLL_UPDATED` event, it checks `if (event.publicKey !== state.adminPublicKey)`. The check fails, and the reducer drops the malicious event.

### 4.3 The Time Travel Attack

* **Attack:** An attacker attempts to submit a vote after the organizer has finalized the poll by forging the `clientTimestamp` in the payload.
* **Mitigation:** The reducer relies on the chronological sequence of events as dictated by the Firestore `createdAt` server timestamp, *not* the client-provided timestamp. If a `VOTE_UPSERT` event appears in the array *after* the `POLL_FINALIZED` event, the `if (state.isFinalized)` check triggers and drops the vote, regardless of what the payload's internal clock claims.