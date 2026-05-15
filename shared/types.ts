// Enums
export type SchedulingMode = "EXACT" | "FUZZY";
export type VoteValue = "YES" | "NO" | "IF_NEED_BE";
export type PollStatus = "OPEN" | "FINALIZED";

// Time slot for exact scheduling
export interface ExactTimeSlot {
  id: string;
  startTime: string;  // ISO 8601
  endTime: string;    // ISO 8601
}

// Time slot for fuzzy scheduling
export interface FuzzyTimeSlot {
  id: string;
  date: string; // YYYY-MM-DD
  label: string; // Free text, e.g., "Dinner", "After work", "Morning"
  time?: string; // Optional time string, e.g., "18:00" or "09:00"
}

export type TimeSlot = ExactTimeSlot | FuzzyTimeSlot;

// === FIRESTORE SCHEMA (server-visible ciphertext) ===

export interface BlindPoll {
  pollId: string;
}

export interface BlindEvent {
  eventId: string;
  createdAt: any; // Firestore serverTimestamp()
  encryptedData: string; // AES-GCM ciphertext (Base64)
  iv: string; // AES-GCM IV (Base64)
}

export interface KeystoreEntry {
  pollId: string;
  wrappedPayload: string; // PRF-encrypted ciphertext
  iv: string;
  updatedAt: number;
}

// === CLIENT-SIDE DECRYPTED SCHEMA ===

export type PollAction =
  | { type: "POLL_CREATED"; payload: PollMetadata }
  | { type: "POLL_UPDATED"; payload: Partial<PollMetadata> }
  | { type: "POLL_FINALIZED"; payload: { finalizedSlotId: string } }
  | { type: "POLL_UNFINALIZED"; payload: null }
  | { type: "VOTE_UPSERT"; payload: VoteData }
  | { type: "VOTE_RETRACTED"; payload: { responseId: string } };

export interface DecryptedSignedEvent {
  publicKey: string;  // Base64 ECDSA SPKI
  signature: string;  // Base64 ECDSA signature
  action: PollAction;
}

export interface PollMetadata {
  title: string;
  description?: string;
  location: string;
  organizerName: string;
  schedulingMode: SchedulingMode;
  timeSlots: TimeSlot[];
}

export interface VoteData {
  responseId: string;
  participantName: string;
  email?: string;
  selections: Record<string, VoteValue>;
  clientTimestamp: number;
}

export interface DecryptedKeystorePayload {
  symmetricPollKey: string;
  ecdsaPrivateKey: string;
  ecdsaPublicKey: string;
}

// === REDUCER OUTPUT ===

export interface PollState {
  adminPublicKey: string | null;
  metadata: PollMetadata | null;
  votes: Map<string, VoteData>;
  isFinalized: boolean;
  finalizedSlotId?: string;
}

// Legacy interfaces (to be deleted after migration)
export interface Poll {
  pollId: string;
  organizerUid?: string | null;
  title: string;
  location: string;
  schedulingMode: SchedulingMode;
  timeSlots: TimeSlot[];
  status: PollStatus;
  finalizedSlotId?: string;
  createdAt: string;  // ISO 8601
}

export interface Vote {
  voteId: string;
  participantName: string;
  selections: Record<string, VoteValue>;
  createdAt: string;
  updatedAt: string;
}
