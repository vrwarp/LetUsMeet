import { describe, it, expect } from "vitest";
import { createPollSchema, submitVoteSchema } from "./validators.js";

describe("Validators", () => {
  describe("createPollSchema", () => {
    it("should validate a valid poll", () => {
      const validPoll = {
        title: "Team Sync",
        location: "Zoom",
        schedulingMode: "EXACT",
        timeSlots: [
          {
            startTime: new Date(Date.now() + 3600000).toISOString(),
            endTime: new Date(Date.now() + 7200000).toISOString(),
          }
        ],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(validPoll);
      expect(result.success).toBe(true);
    });

    it("should fail if title is empty", () => {
      const invalidPoll = {
        title: "",
        location: "Zoom",
        schedulingMode: "EXACT",
        timeSlots: [{ startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should fail if title exceeds 200 chars", () => {
      const invalidPoll = {
        title: "a".repeat(201),
        location: "Zoom",
        schedulingMode: "EXACT",
        timeSlots: [{ startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should fail if location exceeds 500 chars", () => {
      const invalidPoll = {
        title: "Meeting",
        location: "a".repeat(501),
        schedulingMode: "EXACT",
        timeSlots: [{ startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should fail if timeSlots is empty", () => {
      const invalidPoll = {
        title: "Meeting",
        location: "Zoom",
        schedulingMode: "EXACT",
        timeSlots: [],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should fail if startTime is not a valid ISO date", () => {
      const invalidPoll = {
        title: "Meeting",
        location: "Zoom",
        schedulingMode: "EXACT",
        timeSlots: [{ startTime: "invalid-date", endTime: "2026-01-01T11:00:00Z" }],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should fail if end time is before start time", () => {
      const invalidPoll = {
        title: "Invalid Poll",
        location: "Nowhere",
        schedulingMode: "EXACT",
        timeSlots: [
          {
            startTime: new Date(Date.now() + 7200000).toISOString(),
            endTime: new Date(Date.now() + 3600000).toISOString(),
          }
        ],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("End time must be after start time");
      }
    });

    it("should fail if end time is equal to start time", () => {
      const now = new Date().toISOString();
      const invalidPoll = {
        title: "Invalid Poll",
        location: "Nowhere",
        schedulingMode: "EXACT",
        timeSlots: [{ startTime: now, endTime: now }],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });
    it("should fail if schedulingMode is invalid", () => {
      const invalidPoll = {
        title: "Meeting",
        location: "Zoom",
        schedulingMode: "INVALID", 
        timeSlots: [{ startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should fail if organizerName is missing", () => {
      const invalidPoll = {
        title: "Meeting",
        location: "Zoom",
        schedulingMode: "EXACT",
        timeSlots: [{ startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }],
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should fail if organizerEmail is invalid", () => {
      const invalidPoll = {
        title: "Meeting",
        location: "Zoom",
        schedulingMode: "EXACT",
        timeSlots: [{ startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }],
        organizerName: "Jane Doe",
        organizerEmail: "not-an-email",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should validate a valid fuzzy poll", () => {
      const validPoll = {
        title: "Fuzzy Meeting",
        schedulingMode: "FUZZY",
        timeSlots: [
          { date: "2026-01-01", label: "Brunch", time: "11:00" },
          { date: "2026-01-02", label: "Dinner" }
        ],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(validPoll);
      expect(result.success).toBe(true);
    });

    it("should fail if fuzzy slot is missing label", () => {
      const invalidPoll = {
        title: "Fuzzy Meeting",
        schedulingMode: "FUZZY",
        timeSlots: [{ date: "2026-01-01" }],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
    });

    it("should validate a fuzzy poll with null time (Stream E24)", () => {
      const validPoll = {
        title: "Fuzzy Meeting",
        schedulingMode: "FUZZY",
        timeSlots: [
          { date: "2026-01-01", label: "Brunch", time: null },
        ],
        organizerName: "Jane Doe",
        organizerEmail: "jane@example.com",
      };
      const result = createPollSchema.safeParse(validPoll);
      expect(result.success).toBe(true);
    });
  });

  describe("submitVoteSchema", () => {
    it("should validate a valid vote", () => {
      const validVote = {
        pollId: "poll123",
        participantName: "Alice",
        selections: {
          "slot1": "YES",
          "slot2": "IF_NEED_BE"
        }
      };
      const result = submitVoteSchema.safeParse(validVote);
      expect(result.success).toBe(true);
    });

    it("should validate a vote with email", () => {
      const validVote = {
        pollId: "poll123",
        participantName: "Alice",
        participantEmail: "alice@example.com",
        selections: { "slot1": "YES" }
      };
      const result = submitVoteSchema.safeParse(validVote);
      expect(result.success).toBe(true);
    });

    it("should validate a vote with empty string email", () => {
      const validVote = {
        pollId: "poll123",
        participantName: "Alice",
        participantEmail: "",
        selections: { "slot1": "YES" }
      };
      const result = submitVoteSchema.safeParse(validVote);
      expect(result.success).toBe(true);
    });

    it("should fail if pollId is empty", () => {
      const invalidVote = {
        pollId: "",
        participantName: "Alice",
        selections: { "slot1": "YES" }
      };
      const result = submitVoteSchema.safeParse(invalidVote);
      expect(result.success).toBe(false);
    });

    it("should fail if participantName is empty", () => {
      const invalidVote = {
        pollId: "poll123",
        participantName: "",
        selections: { "slot1": "YES" }
      };
      const result = submitVoteSchema.safeParse(invalidVote);
      expect(result.success).toBe(false);
    });

    it("should fail if participantName exceeds 100 chars", () => {
      const invalidVote = {
        pollId: "poll123",
        participantName: "a".repeat(101),
        selections: { "slot1": "YES" }
      };
      const result = submitVoteSchema.safeParse(invalidVote);
      expect(result.success).toBe(false);
    });

    it("should fail if participantEmail is malformed", () => {
      const invalidVote = {
        pollId: "poll123",
        participantName: "Alice",
        participantEmail: "not-an-email",
        selections: { "slot1": "YES" }
      };
      const result = submitVoteSchema.safeParse(invalidVote);
      expect(result.success).toBe(false);
    });

    it("should fail with invalid vote value", () => {
      const invalidVote = {
        pollId: "poll123",
        participantName: "Alice",
        selections: {
          "slot1": "MAYBE" // Not in enum
        }
      };
      const result = submitVoteSchema.safeParse(invalidVote);
      expect(result.success).toBe(false);
    });

    it("should accept empty selections object", () => {
      const validVote = {
        pollId: "poll123",
        participantName: "Alice",
        selections: {}
      };
      const result = submitVoteSchema.safeParse(validVote);
      expect(result.success).toBe(true);
    });
  });
});
