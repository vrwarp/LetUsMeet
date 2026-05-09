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

// Poll document
export interface Poll {
  pollId: string;
  organizerUid?: string | null;
  organizerName: string;
  organizerEmail?: string;
  adminToken?: string;
  title: string;
  description?: string;
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
  participantUid?: string | null;
  participantName: string;
  participantEmail?: string | null;
  selections: Record<string, VoteValue>;  // timeSlotId → vote
  createdAt: string;
  updatedAt: string;
}

// API request/response shapes
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
