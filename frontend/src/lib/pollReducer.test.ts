import { describe, it, expect } from 'vitest';
import { calculatePollState } from './pollReducer';
import type { PollMetadata, VoteData } from '../types';
import type { DecryptedLedgerEvent } from 'charproof';

describe('Poll Reducer', () => {
  const adminPub = 'mock-admin-pubkey';
  const voterPub = 'mock-voter-pubkey';

  const mockMetadata: PollMetadata = {
    title: "Test Poll",
    location: "Online",
    organizerName: "Alice",
    schedulingMode: "EXACT",
    timeSlots: [{ id: 't1', startTime: '...', endTime: '...' }]
  };

  function createEvent(pubKey: string, action: any): DecryptedLedgerEvent {
    return { signerPublicKey: pubKey, action };
  }

  it('should reconstruct state from a valid genesis event', () => {
    const genesis = createEvent(adminPub, { type: 'POLL_CREATED', payload: mockMetadata });
    const state = calculatePollState([genesis]);

    expect(state.adminPublicKey).toBe(adminPub);
    expect(state.metadata?.title).toBe("Test Poll");
    expect(state.votes.size).toBe(0);
  });

  it('should allow admin to update poll metadata', () => {
    const genesis = createEvent(adminPub, { type: 'POLL_CREATED', payload: mockMetadata });
    const update = createEvent(adminPub, { type: 'POLL_UPDATED', payload: { title: "Updated Title" } });
    
    const state = calculatePollState([genesis, update]);
    expect(state.metadata?.title).toBe("Updated Title");
  });

  it('should reject updates from non-admins', () => {
    const genesis = createEvent(adminPub, { type: 'POLL_CREATED', payload: mockMetadata });
    const maliciousUpdate = createEvent(voterPub, { type: 'POLL_UPDATED', payload: { title: "Hacked" } });
    
    const state = calculatePollState([genesis, maliciousUpdate]);
    expect(state.metadata?.title).toBe("Test Poll");
  });

  it('should process votes correctly', () => {
    const genesis = createEvent(adminPub, { type: 'POLL_CREATED', payload: mockMetadata });
    const voteData: VoteData = { 
      responseId: "r1",
      participantName: "Bob", 
      selections: { t1: "YES" }, 
      clientTimestamp: Date.now() 
    };
    const vote = createEvent(voterPub, { type: 'VOTE_UPSERT', payload: voteData });
    
    const state = calculatePollState([genesis, vote]);
    expect(state.votes.size).toBe(1);
    expect(state.votes.get(`${voterPub}:r1`)?.participantName).toBe("Bob");
  });

  it('should allow voters to retract their votes', () => {
    const genesis = createEvent(adminPub, { type: 'POLL_CREATED', payload: mockMetadata });
    const vote = createEvent(voterPub, { type: 'VOTE_UPSERT', payload: { responseId: "r1", participantName: "Bob" } as any });
    const retract = createEvent(voterPub, { type: 'VOTE_RETRACTED', payload: { responseId: "r1" } });
    
    const state = calculatePollState([genesis, vote, retract]);
    expect(state.votes.size).toBe(0);
  });

  it('should reject votes after finalization', () => {
    const genesis = createEvent(adminPub, { type: 'POLL_CREATED', payload: mockMetadata });
    const finalize = createEvent(adminPub, { type: 'POLL_FINALIZED', payload: { finalizedSlotId: 't1' } });
    const lateVote = createEvent(voterPub, { type: 'VOTE_UPSERT', payload: { responseId: "r1", participantName: "Bob" } as any });
    
    const state = calculatePollState([genesis, finalize, lateVote]);
    expect(state.isFinalized).toBe(true);
    expect(state.votes.size).toBe(0);
  });

  it('should ignore subsequent POLL_CREATED events', () => {
    const genesis1 = createEvent(adminPub, { type: 'POLL_CREATED', payload: mockMetadata });
    const genesis2 = createEvent(voterPub, { type: 'POLL_CREATED', payload: { ...mockMetadata, title: "Takeover" } });
    
    const state = calculatePollState([genesis1, genesis2]);
    expect(state.adminPublicKey).toBe(adminPub);
    expect(state.metadata?.title).toBe("Test Poll");
  });
});
