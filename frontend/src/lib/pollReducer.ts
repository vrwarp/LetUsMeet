import type { DecryptedLedgerEvent } from "@letusmeet/zero-knowledge";
import type { PollState, VoteData } from "../types";

export function calculatePollState(events: DecryptedLedgerEvent[]): PollState {
  const state: PollState = {
    adminPublicKey: null,
    metadata: null,
    votes: new Map<string, VoteData>(),
    isFinalized: false
  };

  for (const { signerPublicKey, action } of events) {
    switch (action.type) {
      case "POLL_CREATED":
        if (state.adminPublicKey === null) {
          state.adminPublicKey = signerPublicKey;
          state.metadata = action.payload;
        }
        break;
      case "POLL_UPDATED":
        if (signerPublicKey === state.adminPublicKey && state.metadata) {
          state.metadata = { ...state.metadata, ...action.payload };
        }
        break;
      case "POLL_FINALIZED":
        if (signerPublicKey === state.adminPublicKey) {
          state.isFinalized = true;
          state.finalizedSlotId = action.payload.finalizedSlotId;
        }
        break;
      case "POLL_UNFINALIZED":
        if (signerPublicKey === state.adminPublicKey) {
          state.isFinalized = false;
          state.finalizedSlotId = undefined;
        }
        break;
      case "VOTE_UPSERT":
        if (!state.isFinalized) {
          state.votes.set(`${signerPublicKey}:${action.payload.responseId}`, action.payload);
        }
        break;
      case "VOTE_RETRACTED":
        if (!state.isFinalized) {
          state.votes.delete(`${signerPublicKey}:${action.payload.responseId}`);
        }
        break;
    }
  }
  return state;
}
