import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as pollService from '@/lib/pollService';

vi.mock('@/lib/pollService');

describe('DashboardPage performance', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('measures the time to process keystoreEntries', async () => {
    // Generate a large number of dummy entries
    const numEntries = 1000;
    const keystoreEntries = Array.from({ length: numEntries }).map((_, i) => ({
      ledgerId: `p${i}`,
      amkId: 'amk_v1',
      encryptedData: 'ciphertext',
      iv: 'iv',
      updatedAt: Date.now()
    }));

    vi.mocked(pollService.getLedgerSession).mockImplementation(async (ledgerId) => {
      // simulate async delay of 1ms
      await new Promise(r => setTimeout(r, 1));
      return {
        appendEvent: vi.fn(),
        subscribe: vi.fn(),
        getGenesisEvent: vi.fn().mockResolvedValue({
          signerPublicKey: 'pub',
          action: {
            type: 'POLL_CREATED',
            payload: {
              title: `Mock ZK Meeting ${ledgerId}`,
              location: 'Virtual',
              schedulingMode: 'EXACT',
              organizerName: 'Test User',
              timeSlots: []
            }
          }
        }),
        exportSessionKey: vi.fn().mockReturnValue('YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
        getSignerPublicKey: vi.fn().mockReturnValue('pub'),
      } as any;
    });

    const start = performance.now();
    const decryptedEntries = [];

    // The loop from the dashboard code:
    for (const entry of keystoreEntries) {
      try {
        const session = await pollService.getLedgerSession(entry.ledgerId as any);
        const genesis = await session.getGenesisEvent();
        if (genesis?.action?.type === "POLL_CREATED") {
          decryptedEntries.push({
            pollId: entry.ledgerId,
            symmetricKey: session.exportSessionKey(),
            metadata: genesis.action.payload
          });
        }
      } catch (e) {
        console.warn("Failed to decrypt dashboard entry", entry.ledgerId, e);
      }
    }
    const end = performance.now();
    const duration = end - start;
    console.log(`Processing ${numEntries} entries sequentially took ${duration.toFixed(2)} ms`);
    expect(decryptedEntries.length).toBe(numEntries);
  });

  it('measures the time to process keystoreEntries in parallel', async () => {
    // Generate a large number of dummy entries
    const numEntries = 1000;
    const keystoreEntries = Array.from({ length: numEntries }).map((_, i) => ({
      ledgerId: `p${i}`,
      amkId: 'amk_v1',
      encryptedData: 'ciphertext',
      iv: 'iv',
      updatedAt: Date.now()
    }));

    vi.mocked(pollService.getLedgerSession).mockImplementation(async (ledgerId) => {
      // simulate async delay of 1ms
      await new Promise(r => setTimeout(r, 1));
      return {
        appendEvent: vi.fn(),
        subscribe: vi.fn(),
        getGenesisEvent: vi.fn().mockResolvedValue({
          signerPublicKey: 'pub',
          action: {
            type: 'POLL_CREATED',
            payload: {
              title: `Mock ZK Meeting ${ledgerId}`,
              location: 'Virtual',
              schedulingMode: 'EXACT',
              organizerName: 'Test User',
              timeSlots: []
            }
          }
        }),
        exportSessionKey: vi.fn().mockReturnValue('YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE='),
        getSignerPublicKey: vi.fn().mockReturnValue('pub'),
      } as any;
    });

    const start = performance.now();

    // The optimized loop:
    const decryptedEntriesList = await Promise.all(
      keystoreEntries.map(async (entry) => {
        try {
          const session = await pollService.getLedgerSession(entry.ledgerId as any);
          const genesis = await session.getGenesisEvent();
          if (genesis?.action?.type === "POLL_CREATED") {
            return {
              pollId: entry.ledgerId,
              symmetricKey: session.exportSessionKey(),
              metadata: genesis.action.payload
            };
          }
        } catch (e) {
          console.warn("Failed to decrypt dashboard entry", entry.ledgerId, e);
        }
        return null;
      })
    );

    const decryptedEntries = decryptedEntriesList.filter((e): e is NonNullable<typeof e> => e !== null);

    const end = performance.now();
    const duration = end - start;
    console.log(`Processing ${numEntries} entries in parallel took ${duration.toFixed(2)} ms`);

    expect(decryptedEntries.length).toBe(numEntries);
  });
});
