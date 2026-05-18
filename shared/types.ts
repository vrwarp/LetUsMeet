// Enums
export type SchedulingMode = "EXACT" | "FUZZY";
export type VoteValue = "YES" | "NO" | "IF_NEED_BE" | "BLANK";
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

export interface EncryptedData {
  encryptedData: string; // AES-GCM ciphertext (Base64)
  iv: string;            // AES-GCM IV (Base64)
}

export interface BlindPoll {
  pollId: string;
}

export interface BlindEvent extends EncryptedData {
  eventId: string;
  createdAt: any; // Firestore serverTimestamp()
}

export interface KeystoreEntry extends EncryptedData {
  pollId: string;
  amkId: string; // NEW: Explicitly declare which AMK encrypted this payload
  updatedAt: number;
}

export interface DevicePublicKey {
  deviceId: string;
  encryptedDeviceName: EncryptedData;
  publicKey: string; // Base64 SPKI (RSA-OAEP)
  createdAt: number;
}

export interface RecoveryMethod {
  type: 'prf' | 'phrase';
  encryptedLabel: EncryptedData;
  publicKey?: string; // Optional: For asymmetric recovery (e.g., RSA Public Key for phrases)
  credentialId?: string; // Optional: For PRF recovery (WebAuthn credential ID)
  createdAt: number;
}

export interface AccountKeysDocument {
  activeAmkId: string; // e.g., "amk_v1"
  devices: Record<string, DevicePublicKey>; // Keyed by deviceId
  recoveryMethods: Record<string, RecoveryMethod>; // Keyed by methodId (e.g., "__recovery_prf")
  keyring: Record<string, Record<string, string>>;
  // Map of amkId -> { (deviceId | recoveryMethodId): "wrapped_amk_base64" }
}

export interface PendingDevice {
  deviceId: string;
  encryptedDeviceName: EncryptedData & {
    wrappedKeys: Record<string, string>; // Maps sponsorDeviceId -> wrappedEphemeralKeyB64
  };
  publicKey: string; // Base64 SPKI
  status: 'pending' | 'authorized' | 'rejected';
  createdAt: number;
  expiresAt?: number;
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
  adminPublicKey?: string; // NEW: Store public key in genesis to allow recovery from token
  encryptedAdminPriv?: EncryptedData;
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
