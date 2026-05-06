import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPollHandler, getPollHandler, pingHandler } from "./polls.js";
import { makeCallableRequest } from "./test/setup.js";

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

describe("Polls Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCollection.mockReturnValue({
      doc: mockDoc.mockReturnValue({
        id: "mock-poll-id",
        set: mockSet,
        get: mockGet,
      }),
    });
  });

  describe("pingHandler", () => {
    it("should return pong: true", async () => {
      const result = await pingHandler();
      expect(result).toEqual({ pong: true });
    });
  });

  describe("createPollHandler", () => {
    it("should throw unauthenticated error if no auth", async () => {
      await expect(createPollHandler(makeCallableRequest({} as any))).rejects.toThrow(
        expect.objectContaining({ code: "unauthenticated" })
      );
    });

    it("should throw invalid-argument if data is invalid", async () => {
      const data = { title: "" };
      const request = makeCallableRequest(data as any, "user123");
      await expect(createPollHandler(request as any)).rejects.toThrow(
        expect.objectContaining({ code: "invalid-argument" })
      );
    });

    it("should create a poll and return pollId", async () => {
      const data = {
        title: "Test Poll",
        location: "Test Location",
        schedulingMode: "EXACT" as const,
        timeSlots: [
          { startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }
        ]
      };
      const request = makeCallableRequest(data, "user123");
      mockSet.mockResolvedValue({} as any);

      const result = await createPollHandler(request);

      expect(result).toEqual({ pollId: "mock-poll-id" });
      expect(mockCollection).toHaveBeenCalledWith("polls");
      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        title: "Test Poll",
        organizerUid: "user123",
        status: "OPEN"
      }));
    });

    it("should assign sequential IDs to time slots and set createdAt", async () => {
      const data = {
        title: "Test Poll",
        location: "",
        schedulingMode: "EXACT" as const,
        timeSlots: [
          { startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" },
          { startTime: "2026-01-01T12:00:00Z", endTime: "2026-01-01T13:00:00Z" }
        ]
      };
      const request = makeCallableRequest(data, "user123");
      mockSet.mockResolvedValue({} as any);

      await createPollHandler(request);

      const savedData = mockSet.mock.calls[0][0];
      expect(savedData.timeSlots[0].id).toBe("t1");
      expect(savedData.timeSlots[1].id).toBe("t2");
      expect(savedData.createdAt).toBeDefined();
      expect(new Date(savedData.createdAt).toISOString()).toBe(savedData.createdAt);
    });
  });

  describe("getPollHandler", () => {
    it("should throw invalid-argument if pollId is missing", async () => {
      await expect(getPollHandler(makeCallableRequest({} as any))).rejects.toThrow(
        expect.objectContaining({ code: "invalid-argument" })
      );
    });

    it("should throw not-found if poll does not exist", async () => {
      mockGet.mockResolvedValue({ exists: false });
      await expect(getPollHandler(makeCallableRequest({ pollId: "missing" }))).rejects.toThrow(
        expect.objectContaining({ code: "not-found" })
      );
    });

    it("should return poll data and aggregates", async () => {
      const pollData = {
        pollId: "p1",
        title: "Test",
        timeSlots: [{ id: "t1", startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }]
      };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => pollData });
      
      const mockVotesSnapshot = {
        docs: [
          { data: () => ({ selections: { t1: "YES" } }) },
          { data: () => ({ selections: { t1: "IF_NEED_BE" } }) }
        ]
      };
      
      const mockSubCollection = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(mockVotesSnapshot)
      });

      mockDoc.mockReturnValue({
        id: "p1",
        get: mockGet,
        collection: mockSubCollection
      });

      const result = await getPollHandler(makeCallableRequest({ pollId: "p1" }));

      expect(result.poll).toEqual(pollData);
      expect(result.voteCounts.t1).toEqual({ YES: 1, NO: 0, IF_NEED_BE: 1 });
    });

    it("should initialize voteCounts to zeros when no votes exist", async () => {
      const pollData = {
        pollId: "p1",
        title: "Test",
        timeSlots: [{ id: "t1", startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }]
      };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => pollData });
      mockDoc.mockReturnValue({
        id: "p1",
        get: mockGet,
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: [] })
        })
      });

      const result = await getPollHandler(makeCallableRequest({ pollId: "p1" }));
      expect(result.voteCounts.t1).toEqual({ YES: 0, NO: 0, IF_NEED_BE: 0 });
    });

    it("should ignore vote selections for slot IDs not in the poll", async () => {
      const pollData = {
        pollId: "p1",
        title: "Test",
        timeSlots: [{ id: "t1", startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }]
      };
      mockGet.mockResolvedValueOnce({ exists: true, data: () => pollData });
      
      const mockVotesSnapshot = {
        docs: [
          { data: () => ({ selections: { t1: "YES", invalid_slot: "YES" } }) }
        ]
      };
      
      mockDoc.mockReturnValue({
        id: "p1",
        get: mockGet,
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockVotesSnapshot)
        })
      });

      const result = await getPollHandler(makeCallableRequest({ pollId: "p1" }));
      expect(result.voteCounts.t1).toEqual({ YES: 1, NO: 0, IF_NEED_BE: 0 });
      expect(result.voteCounts.invalid_slot).toBeUndefined();
    });
  });
});
