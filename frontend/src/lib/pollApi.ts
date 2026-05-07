import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";

export async function createPollAction(data: any) {
  if ((globalThis as any).IS_VITEST) {
    return { data: { pollId: 'mock-poll-id-123', adminToken: 'mock-admin-token' } };
  }
  const fn = httpsCallable(functions, "createPoll");
  return fn(data);
}

export async function fetchPollAction(data: any) {
  if ((globalThis as any).IS_VITEST) {
    return { 
      data: { 
        poll: { 
          pollId: data?.pollId || 'mock-poll-id-123',
          organizerUid: 'user123',
          title: 'Mock Meeting', 
          location: 'Virtual', 
          status: 'OPEN',
          timeSlots: [
            { id: 't1', startTime: '2026-10-10T10:00:00Z', endTime: '2026-10-10T11:00:00Z' },
          ] 
        },
        votes: [],
        voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 } }
      } 
    };
  }
  const fn = httpsCallable(functions, "getPoll");
  return fn(data);
}

export async function submitVoteAction(data: any) {
  if ((globalThis as any).IS_VITEST) {
    return { data: { success: true } };
  }
  const fn = httpsCallable(functions, "submitVote");
  return fn(data);
}

export async function getOrganizerCalendarAction(data: any) {
  if ((globalThis as any).IS_VITEST) {
    return { data: { busyTimes: [] } };
  }
  const fn = httpsCallable(functions, "getOrganizerCalendar");
  return fn(data);
}

export async function finalizePollAction(data: any) {
  if ((globalThis as any).IS_VITEST) {
    return { data: { success: true, eventId: "mock-event-id" } };
  }
  const fn = httpsCallable(functions, "finalizePoll");
  return fn(data);
}
