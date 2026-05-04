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
        ]
      };
      const result = createPollSchema.safeParse(validPoll);
      expect(result.success).toBe(true);
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
        ]
      };
      const result = createPollSchema.safeParse(invalidPoll);
      expect(result.success).toBe(false);
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
  });
});
