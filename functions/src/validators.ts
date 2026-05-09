import { z } from "zod";

const exactTimeSlotSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
}).refine((slot) => new Date(slot.endTime) > new Date(slot.startTime), {
  message: "End time must be after start time",
});

const fuzzyTimeSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  label: z.string().min(1, "Label is required").max(50, "Label is too long"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format").optional().nullable().or(z.literal("")),
});

export const createPollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(500).optional().or(z.literal("")),
  schedulingMode: z.enum(["EXACT", "FUZZY"]),
  timeSlots: z.array(z.any()).min(1),
  organizerName: z.string().min(1).max(100),
  organizerEmail: z.string().email(),
}).superRefine((data, ctx) => {
  if (data.schedulingMode === "EXACT") {
    const result = z.array(exactTimeSlotSchema).safeParse(data.timeSlots);
    if (!result.success) {
      result.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["timeSlots", ...issue.path] }));
    }
  } else {
    const result = z.array(fuzzyTimeSlotSchema).safeParse(data.timeSlots);
    if (!result.success) {
      result.error.issues.forEach((issue) => ctx.addIssue({ ...issue, path: ["timeSlots", ...issue.path] }));
    }
  }
});

export const submitVoteSchema = z.object({
  pollId: z.string().min(1),
  voteId: z.string().nullable().optional(),
  participantName: z.string().min(1).max(100),
  participantEmail: z.string().email().optional().or(z.literal("")),
  selections: z.record(z.enum(["YES", "NO", "IF_NEED_BE"])),
});

export const deleteVoteSchema = z.object({
  pollId: z.string().min(1),
  voteId: z.string().min(1),
});

export const updatePollSchema = z.object({
  pollId: z.string().min(1),
  adminToken: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(500).optional().or(z.literal("")),
  timeSlots: z.array(z.any()).min(1),
});

export const finalizePollSchema = z.object({
  pollId: z.string().min(1),
  selectedTimeSlotId: z.string().min(1),
});

