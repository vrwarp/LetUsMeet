import { describe, it, expect, beforeAll } from 'vitest';
import { calculatePollState } from './pollReducer';
import {
  generateIdentityKeyPair,
  signAction,
  exportPublicKey
} from './crypto';
import { DecryptedSignedEvent, PollMetadata, VoteData } from '../types';

describe('Poll Reducer', () => {
  let adminKeys: { publicKey: CryptoKey; privateKey: CryptoKey };
  let adminPub: string;
  let voterKeys: { publicKey: CryptoKey; privateKey: CryptoKey };
  let voterPub: string;

  const mockMetadata: PollMetadata = {
    title: "Test Poll",
    location: "Online",
    organizerName: "Alice",
    schedulingMode: "EXACT",
    timeSlots: [{ id: 't1', startTime: '...', endTime: '...' }]
  };

  beforeAll(async () => {
    adminKeys = await generateIdentityKeyPair();
    adminPub = await exportPublicKey(adminKeys.publicKey);
    voterKeys = await generateIdentityKeyPair();
    voterPub = await exportPublicKey(voterKeys.publicKey);
  });

  async function createEvent(keys: { privateKey: CryptoKey; publicKey: CryptoKey }, action: any): Promise<DecryptedSignedEvent> {
    const signature = await signAction(keys.privateKey, action);
    const publicKey = await exportPublicKey(keys.publicKey);
    return { publicKey, signature, action };
  }

  it('should reconstruct state from a valid genesis event', async () => {
    const genesis = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const state = await calculatePollState([genesis]);

    expect(state.adminPublicKey).toBe(adminPub);
    expect(state.metadata?.title).toBe("Test Poll");
    expect(state.votes.size).toBe(0);
  });

  it('should allow admin to update poll metadata', async () => {
    const genesis = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const update = await createEvent(adminKeys, { type: 'POLL_UPDATED', payload: { title: "Updated Title" } });
    
    const state = await calculatePollState([genesis, update]);
    expect(state.metadata?.title).toBe("Updated Title");
  });

  it('should reject updates from non-admins', async () => {
    const genesis = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const maliciousUpdate = await createEvent(voterKeys, { type: 'POLL_UPDATED', payload: { title: "Hacked" } });
    
    const state = await calculatePollState([genesis, maliciousUpdate]);
    expect(state.metadata?.title).toBe("Test Poll");
  });

  it('should process votes correctly', async () => {
    const genesis = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const voteData: VoteData = { participantName: "Bob", selections: { t1: "YES" }, clientTimestamp: Date.now() };
    const vote = await createEvent(voterKeys, { type: 'VOTE_UPSERT', payload: voteData });
    
    const state = await calculatePollState([genesis, vote]);
    expect(state.votes.size).toBe(1);
    expect(state.votes.get(voterPub)?.participantName).toBe("Bob");
  });

  it('should allow voters to retract their votes', async () => {
    const genesis = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const vote = await createEvent(voterKeys, { type: 'VOTE_UPSERT', payload: { participantName: "Bob" } as any });
    const retract = await createEvent(voterKeys, { type: 'VOTE_RETRACTED', payload: null });
    
    const state = await calculatePollState([genesis, vote, retract]);
    expect(state.votes.size).toBe(0);
  });

  it('should reject votes after finalization', async () => {
    const genesis = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const finalize = await createEvent(adminKeys, { type: 'POLL_FINALIZED', payload: { finalizedSlotId: 't1' } });
    const lateVote = await createEvent(voterKeys, { type: 'VOTE_UPSERT', payload: { participantName: "Bob" } as any });
    
    const state = await calculatePollState([genesis, finalize, lateVote]);
    expect(state.isFinalized).toBe(true);
    expect(state.votes.size).toBe(0);
  });

  it('should drop events with invalid signatures', async () => {
    const genesis = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const invalidEvent = await createEvent(voterKeys, { type: 'VOTE_UPSERT', payload: { participantName: "Evil" } as any });
    // Tamper with the action but keep the signature
    invalidEvent.action = { ...invalidEvent.action, type: 'POLL_UPDATED' } as any;
    
    const state = await calculatePollState([genesis, invalidEvent]);
    expect(state.votes.size).toBe(0);
    expect(state.metadata?.title).toBe("Test Poll");
  });

  it('should ignore subsequent POLL_CREATED events', async () => {
    const genesis1 = await createEvent(adminKeys, { type: 'POLL_CREATED', payload: mockMetadata });
    const genesis2 = await createEvent(voterKeys, { type: 'POLL_CREATED', payload: { ...mockMetadata, title: "Takeover" } });
    
    const state = await calculatePollState([genesis1, genesis2]);
    expect(state.adminPublicKey).toBe(adminPub);
    expect(state.metadata?.title).toBe("Test Poll");
  });
});
