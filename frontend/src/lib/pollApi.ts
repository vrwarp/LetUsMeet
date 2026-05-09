import { httpsCallable, httpsCallableFromURL } from "firebase/functions";
import { functions } from "@/firebase";

function getCallable(name: string) {
  if (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
    return httpsCallable(functions, name);
  }
  // Use Next.js Rewrite proxy in production to bypass CORS entirely
  const url = `${window.location.origin}/api/functions/${name.toLowerCase()}`;
  return httpsCallableFromURL(functions, url);
}

export async function createPollAction(data: any) {
  if (process.env.NEXT_PUBLIC_IS_TESTING === "true") {
    return { data: { pollId: "mock-poll-id-123", adminToken: "mock-admin-token" } };
  }
  const fn = getCallable("createPoll");
  return fn(data);
}

export async function fetchPollAction(data: any) {
  if (process.env.NEXT_PUBLIC_IS_TESTING === "true") {
    return {
      data: {
        poll: {
          pollId: data?.pollId || "mock-poll-id-123",
          organizerUid: "user123",
          title: "Mock Meeting",
          location: "Virtual",
          status: "OPEN",
          timeSlots: [
            { id: "t1", startTime: "2026-10-10T10:00:00Z", endTime: "2026-10-10T11:00:00Z" },
          ],
        },
        votes: [],
        voteCounts: { t1: { YES: 0, NO: 0, IF_NEED_BE: 0 } },
      },
    };
  }
  const fn = getCallable("getPoll");
  return fn(data);
}

export async function submitVoteAction(data: any) {
  if (process.env.NEXT_PUBLIC_IS_TESTING === "true") {
    return { data: { success: true } };
  }
  const fn = getCallable("submitVote");
  return fn(data);
}

export async function finalizePollAction(data: any) {
  if (process.env.NEXT_PUBLIC_IS_TESTING === "true") {
    return { data: { success: true } };
  }
  const fn = getCallable("finalizePoll");
  return fn(data);
}

export async function updatePollAction(data: any) {
  if (process.env.NEXT_PUBLIC_IS_TESTING === "true") {
    return { data: { success: true } };
  }
  const fn = getCallable("updatePoll");
  return fn(data);
}

export async function deleteVoteAction(data: any) {
  if (process.env.NEXT_PUBLIC_IS_TESTING === "true") {
    return { data: { success: true } };
  }
  const fn = getCallable("deleteVote");
  return fn(data);
}
