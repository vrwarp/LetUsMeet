import { describe, it, expect, vi, beforeEach } from "vitest";
import { getOrganizerCalendar, finalizePoll } from "./calendar.js";
import { makeCallableRequest } from "./test/setup.js";
import { CallableRequest } from "firebase-functions/v2/https";
import { GetOrganizerCalendarRequest, FinalizePollRequest, GetOrganizerCalendarResponse, FinalizePollResponse } from "./types.js";

// Mock firebase-admin
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
}));

const mockGet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("firebase-admin/firestore", () => {
  return {
    getFirestore: vi.fn().mockImplementation(() => ({
      collection: (name: string) => {
        return {
          doc: (id: string) => {
            return {
               get: mockGet,
               update: mockUpdate,
               collection: (sub: string) => ({
                 get: vi.fn().mockResolvedValue({ docs: [] })
               })
            }
          },
          get: vi.fn(),
        }
      },
    })),
  };
});

// Mock googleapis
const mockFreeBusyQuery = vi.fn();
const mockEventsInsert = vi.fn();

vi.mock("googleapis", () => {
  class MockOAuth2 {
    setCredentials = vi.fn();
    on = vi.fn();
  }
  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      calendar: vi.fn().mockImplementation(() => ({
        freebusy: {
          query: mockFreeBusyQuery,
        },
        events: {
          insert: mockEventsInsert,
        },
      })),
    },
  };
});

describe("Calendar Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganizerCalendar", () => {
    it("should throw unauthenticated if not logged in", async () => {
      const request = makeCallableRequest({} as any) as CallableRequest<GetOrganizerCalendarRequest>;
      await expect(getOrganizerCalendar.run(request)).rejects.toThrow(
        expect.objectContaining({ code: "unauthenticated" })
      );
    });

    it("should return busy slots", async () => {
      const data = { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-01-02T00:00:00Z" };
      const request = makeCallableRequest(data, "user123") as CallableRequest<GetOrganizerCalendarRequest>;

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          uid: "user123",
          googleTokens: { accessToken: "at", refreshToken: "rt", expiryDate: 123 },
        }),
      });

      mockFreeBusyQuery.mockResolvedValueOnce({
        data: {
          calendars: {
            primary: {
              busy: [{ start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }],
            },
          },
        },
      });

      const result = await getOrganizerCalendar.run(request) as GetOrganizerCalendarResponse;
      expect(result.busy).toHaveLength(1);
      expect(result.busy[0].start).toBe("2026-01-01T10:00:00Z");
    });
  });

  describe("finalizePoll", () => {
    it("should throw unauthenticated if not logged in", async () => {
      const request = makeCallableRequest({} as any) as CallableRequest<FinalizePollRequest>;
      await expect(finalizePoll.run(request)).rejects.toThrow(
        expect.objectContaining({ code: "unauthenticated" })
      );
    });

    it("should finalize poll and create calendar event", async () => {
      const data = { pollId: "p1", selectedTimeSlotId: "t1" };
      const request = makeCallableRequest(data, "user123") as CallableRequest<FinalizePollRequest>;

      const pollData = {
        organizerUid: "user123",
        title: "Test Meeting",
        location: "Test Location",
        timeSlots: [{ id: "t1", startTime: "2026-01-01T10:00:00Z", endTime: "2026-01-01T11:00:00Z" }],
      };

      // Call 1: poll doc
      mockGet.mockResolvedValueOnce({ exists: true, data: () => pollData });

      // Call 2: user doc for OAuth
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          uid: "user123",
          googleTokens: { accessToken: "at", refreshToken: "rt", expiryDate: 123 },
        }),
      });

      mockEventsInsert.mockResolvedValueOnce({ data: { id: "event123" } });

      const result = await finalizePoll.run(request) as FinalizePollResponse;
      expect(result.success).toBe(true);
      expect(result.calendarEventId).toBe("event123");
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "FINALIZED",
        finalizedSlotId: "t1",
      });
    });
  });
});
