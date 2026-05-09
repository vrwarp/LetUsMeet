import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitVoteHandler } from "./votes.js";
import { makeCallableRequest } from "./test/setup.js";
import { VoteValue } from "./types.js";

// Mock firebase-admin
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
}));

const mockSet = vi.fn();
const mockGet = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({
    collection: mockCollection,
  }),
}));

describe("Votes Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockImplementation((path) => {
      if (path === "polls") {
        return {
          doc: mockDoc.mockReturnValue({
            id: "poll123",
            get: mockGet,
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: false }),
                set: mockSet,
              }),
            }),
          }),
        };
      }
      return {};
    });
  });

  describe("submitVoteHandler", () => {
    it("should throw unauthenticated if no auth", async () => {
      await expect(submitVoteHandler(makeCallableRequest({} as any))).rejects.toThrow(
        expect.objectContaining({ code: "unauthenticated" })
      );
    });

    it("should throw not-found if poll does not exist", async () => {
      mockGet.mockResolvedValue({ exists: false });
      const data = {
        pollId: "missing",
        participantName: "Alice",
        selections: {},
      };
      await expect(submitVoteHandler(makeCallableRequest(data, "user123"))).rejects.toThrow(
        expect.objectContaining({ code: "not-found" })
      );
    });

    it("should throw failed-precondition if poll is not open", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "FINALIZED", timeSlots: [] }),
      });
      const data = {
        pollId: "poll123",
        participantName: "Alice",
        selections: {},
      };
      await expect(submitVoteHandler(makeCallableRequest(data, "user123"))).rejects.toThrow(
        expect.objectContaining({ code: "failed-precondition" })
      );
    });

    it("should throw invalid-argument if slot IDs are invalid", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "OPEN", timeSlots: [{ id: "t1" }] }),
      });
      const data = {
        pollId: "poll123",
        participantName: "Alice",
        selections: { "invalid-slot": "YES" } as Record<string, VoteValue>,
      };
      await expect(submitVoteHandler(makeCallableRequest(data, "user123"))).rejects.toThrow(
        expect.objectContaining({ code: "invalid-argument" })
      );
    });

    it("should submit a valid vote", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "OPEN", timeSlots: [{ id: "t1" }] }),
      });
      const data = {
        pollId: "poll123",
        participantName: "Alice",
        participantEmail: "alice@example.com",
        selections: { "t1": "YES" } as Record<string, VoteValue>,
      };
      const request = makeCallableRequest(data, "user123");
      mockSet.mockResolvedValue({} as any);

      const result = await submitVoteHandler(request);

      expect(result).toEqual({ success: true });
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        participantName: "Alice",
        participantEmail: "alice@example.com",
        participantUid: "user123",
      }), { merge: true });
    });

    it("should throw invalid-argument for invalid body (Stream B16)", async () => {
      const data = { pollId: "poll123", participantName: "" }; // Missing name
      await expect(submitVoteHandler(makeCallableRequest(data as any, "user123"))).rejects.toThrow(
        expect.objectContaining({ code: "invalid-argument" })
      );
    });

    it("should use caller UID as document ID (Stream B21)", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "OPEN", timeSlots: [{ id: "t1" }] }),
      });
      const data = {
        pollId: "poll123",
        participantName: "Alice",
        selections: { "t1": "YES" } as Record<string, VoteValue>,
      };

      const mockVoteDoc = { set: mockSet, get: vi.fn().mockResolvedValue({ exists: false }) };
      const mockVotesCollection = { doc: vi.fn().mockReturnValue(mockVoteDoc) };

      mockCollection.mockImplementation((path) => {
        if (path === "polls") {
          return {
            doc: vi.fn().mockReturnValue({
              id: "poll123",
              get: mockGet,
              collection: vi.fn().mockReturnValue(mockVotesCollection),
            }),
          };
        }
        return {};
      });

      await submitVoteHandler(makeCallableRequest(data, "user123"));
      expect(mockVotesCollection.doc).toHaveBeenCalledWith("user123");
    });

    it("should preserve createdAt on re-vote (Stream B22)", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "OPEN", timeSlots: [{ id: "t1" }] }),
      });
      const data = {
        pollId: "poll123",
        participantName: "Alice",
        selections: { "t1": "YES" } as Record<string, VoteValue>,
      };

      const existingVote = {
        exists: true,
        data: () => ({ createdAt: "2026-01-01T00:00:00Z" }),
      };

      const mockVoteDoc = { set: mockSet, get: vi.fn().mockResolvedValue(existingVote) };

      mockCollection.mockImplementation((path) => {
        if (path === "polls") {
          return {
            doc: vi.fn().mockReturnValue({
              id: "poll123",
              get: mockGet,
              collection: vi.fn().mockReturnValue({ doc: vi.fn().mockReturnValue(mockVoteDoc) }),
            }),
          };
        }
        return {};
      });

      await submitVoteHandler(makeCallableRequest(data, "user123"));
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: expect.any(String),
      }), { merge: true });
    });

    it("should set participantEmail to null when not provided (Stream B23)", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ status: "OPEN", timeSlots: [{ id: "t1" }] }),
      });
      const data = {
        pollId: "poll123",
        participantName: "Alice",
        selections: { "t1": "YES" } as Record<string, VoteValue>,
      };

      mockSet.mockResolvedValue({} as any);

      await submitVoteHandler(makeCallableRequest(data, "user123"));
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        participantEmail: null,
      }), { merge: true });
    });
  });
});
