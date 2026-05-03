import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import type { CreatePollRequest, CreatePollResponse, SubmitVoteRequest, GetPollResponse } from "../types/index";

export const createPollApi = httpsCallable<CreatePollRequest, CreatePollResponse>(
  functions,
  "createPoll"
);

export const getPollApi = httpsCallable<{ pollId: string }, GetPollResponse>(
  functions,
  "getPoll"
);

export const submitVoteApi = httpsCallable<SubmitVoteRequest, { success: true }>(
  functions,
  "submitVote"
);
