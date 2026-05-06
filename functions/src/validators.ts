import { z } from "zod";

export const createPollSchema = z.object({
  title: z.string().min(1).max(200),
  location: z.string().max(500).optional(),
  schedulingMode: z.enum(["EXACT"]),
  timeSlots: z.array(z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  })).min(1).refine((slots) => {
    return slots.every(slot => new Date(slot.endTime) > new Date(slot.startTime));
  }, "End time must be after start time"),
});

export const submitVoteSchema = z.object({
  pollId: z.string().min(1),
  participantName: z.string().min(1).max(100),
  participantEmail: z.string().email().optional().or(z.literal("")),
  selections: z.record(z.enum(["YES", "NO", "IF_NEED_BE"])),
});
