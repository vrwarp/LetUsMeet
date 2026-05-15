import type {
  PollState,
  DecryptedSignedEvent,
  PollMetadata,
  VoteData
} from '../types';
import { verifySignature } from './crypto';

/**
 * Reducer that reconstructs the authoritative poll state from an encrypted ledger.
 * It enforces cryptographic security and business logic invariants.
 */
export async function calculatePollState(events: DecryptedSignedEvent[]): Promise<PollState> {
  const state: PollState = {
    adminPublicKey: null,
    metadata: null,
    votes: new Map<string, VoteData>(),
    isFinalized: false
  };

  for (const event of events) {
    const { publicKey, signature, action } = event;

    // 1. Cryptographic Signature Verification
    // Every event must be validly signed by the public key it claims to be from.
    const isValid = await verifySignature(publicKey, signature, action);
    if (!isValid) {
      console.warn("Dropping event due to invalid signature", event);
      continue;
    }

    // 2. State Transitions
    switch (action.type) {
      case "POLL_CREATED":
        // Genesis block: The first valid POLL_CREATED event defines the admin and initial metadata.
        // Subsequent POLL_CREATED events are ignored to prevent takeover.
        if (state.adminPublicKey === null) {
          state.adminPublicKey = publicKey;
          state.metadata = action.payload;
        }
        break;

      case "POLL_UPDATED":
        // Only the admin can update poll metadata.
        if (publicKey === state.adminPublicKey && state.metadata) {
          state.metadata = {
            ...state.metadata,
            ...action.payload
          };
        }
        break;

      case "POLL_FINALIZED":
        // Only the admin can finalize the poll.
        if (publicKey === state.adminPublicKey) {
          state.isFinalized = true;
          state.finalizedSlotId = action.payload.finalizedSlotId;
        }
        break;

      case "POLL_UNFINALIZED":
        // Only the admin can unfinalize the poll.
        if (publicKey === state.adminPublicKey) {
          state.isFinalized = false;
          state.finalizedSlotId = undefined;
        }
        break;

      case "VOTE_UPSERT":
        // Votes are accepted only if the poll is not finalized.
        // The vote is keyed by the signer's public key + responseId to allow multiple responses.
        if (!state.isFinalized) {
          const voteKey = `${publicKey}:${action.payload.responseId}`;
          state.votes.set(voteKey, action.payload);
        }
        break;

      case "VOTE_RETRACTED":
        // Only the voter can retract their own vote.
        if (!state.isFinalized) {
          const voteKey = `${publicKey}:${action.payload.responseId}`;
          state.votes.delete(voteKey);
        }
        break;

      default:
        console.warn("Unknown action type", (action as any).type);
    }
  }

  return state;
}
