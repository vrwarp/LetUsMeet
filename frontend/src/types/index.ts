import type {
  SchedulingMode,
  VoteValue,
  PollStatus,
  TimeSlot,
  ExactTimeSlot,
  FuzzyTimeSlot,
  PollMetadata,
  VoteData,
  PollState,
  BlindPoll,
  BlindEvent,
  KeystoreEntry,
  DecryptedSignedEvent,
  PollAction,
  DecryptedKeystorePayload,
  Poll,
  Vote,
  DevicePublicKey,
  AccountKeysDocument,
  PendingDevice,
  EncryptedData
} from '../../../shared/types';

export type {
  SchedulingMode,
  VoteValue,
  PollStatus,
  TimeSlot,
  ExactTimeSlot,
  FuzzyTimeSlot,
  PollMetadata,
  VoteData,
  PollState,
  BlindPoll,
  BlindEvent,
  KeystoreEntry,
  DecryptedSignedEvent,
  PollAction,
  DecryptedKeystorePayload,
  Poll,
  Vote,
  DevicePublicKey,
  AccountKeysDocument,
  PendingDevice,
  EncryptedData
};

// API request/response shapes (mostly legacy, will be removed)
export type CreateTimeSlotPayload =
  | Omit<ExactTimeSlot, "id">
  | Omit<FuzzyTimeSlot, "id">;

export interface CreatePollRequest {
  title: string;
  description?: string;
  location: string;
  schedulingMode: SchedulingMode;
  timeSlots: CreateTimeSlotPayload[];
  organizerName: string;
  organizerEmail: string;
}

export interface UpdatePollRequest {
  pollId: string;
  adminToken?: string;
  title: string;
  description?: string;
  location: string;
  timeSlots: (CreateTimeSlotPayload & { id?: string })[];
}

export interface CreatePollResponse {
  pollId: string;
  adminToken: string;
}

export interface SubmitVoteRequest {
  pollId: string;
  voteId?: string;
  participantName: string;
  participantEmail?: string;
  selections: Record<string, VoteValue>;
}

export interface GetPollResponse {
  poll: Poll;
  votes: Vote[];
  voteCounts: Record<string, { YES: number, NO: number, IF_NEED_BE: number }>;
}
