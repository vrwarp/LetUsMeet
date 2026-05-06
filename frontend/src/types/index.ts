// Enums
export type SchedulingMode = "EXACT";  // Phase 1 only; "FUZZY" added in Phase 2
export type VoteValue = "YES" | "NO" | "IF_NEED_BE";
export type PollStatus = "OPEN" | "FINALIZED";

// Time slot for exact scheduling
export interface ExactTimeSlot {
  id: string;
  startTime: string;  // ISO 8601
  endTime: string;    // ISO 8601
}

export type TimeSlot = ExactTimeSlot;  // Union grows in Phase 2

// Poll document
export interface Poll {
  pollId: string;
  organizerUid?: string | null;
  organizerName: string;
  organizerEmail: string;
  adminToken: string;
  title: string;
  location: string;
  schedulingMode: SchedulingMode;
  timeSlots: TimeSlot[];
  status: PollStatus;
  finalizedSlotId?: string;
  createdAt: string;  // ISO 8601
}

// Vote document
export interface Vote {
  voteId: string;
  participantName: string;
  participantEmail?: string;
  selections: Record<string, VoteValue>;  // timeSlotId → vote
  createdAt: string;
  updatedAt: string;
}

// API request/response shapes
export interface CreatePollRequest {
  title: string;
  location: string;
  schedulingMode: SchedulingMode;
  timeSlots: Omit<ExactTimeSlot, "id">[];
  organizerName: string;
  organizerEmail: string;
}

export interface CreatePollResponse {
  pollId: string;
  adminToken: string;
}

export interface SubmitVoteRequest {
  pollId: string;
  participantName: string;
  participantEmail?: string;
  selections: Record<string, VoteValue>;
}

export interface GetPollResponse {
  poll: Poll;
  votes: Vote[];
  voteCounts: Record<string, { YES: number, NO: number, IF_NEED_BE: number }>;
}
