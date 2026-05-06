import * as functions from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { createPollSchema } from "./validators.js";
import { CreatePollRequest, Poll, TimeSlot } from "./types.js";

export const createPollHandler = async (request: functions.https.CallableRequest<CreatePollRequest>) => {
  console.log("createPoll triggered", { data: request.data, auth: request.auth?.uid });
  try {
  // 1. Validate auth
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  // 2. Parse & validate body
  const validation = createPollSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { title, location, schedulingMode, timeSlots: rawSlots } = validation.data;

  // 3. Generate sequential IDs for time slots
  const timeSlots: TimeSlot[] = rawSlots.map((slot, index) => ({
    id: `t${index + 1}`,
    ...slot,
  }));

  // 4. Create poll document
  const pollRef = getFirestore().collection("polls").doc();
  const poll: Poll = {
    pollId: pollRef.id,
    organizerUid: request.auth.uid,
    title,
    location: location || "",
    schedulingMode,
    timeSlots,
    status: "OPEN",
    createdAt: new Date().toISOString(),
  };

  await pollRef.set(poll);

  return { pollId: pollRef.id };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Error in createPoll:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create poll");
  }
};

export const createPoll = functions.https.onCall<CreatePollRequest>(createPollHandler);

export const getPollHandler = async (request: functions.https.CallableRequest<{ pollId: string }>) => {
  const { pollId } = request.data;
  console.log(`getPoll triggered for pollId: ${pollId}`);
  
  if (!pollId) {
    throw new functions.https.HttpsError("invalid-argument", "pollId is required.");
  }

  const pollDoc = await getFirestore().collection("polls").doc(pollId).get();
  if (!pollDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Poll not found.");
  }

  const pollData = pollDoc.data() as Poll;

  // Fetch votes
  const votesSnapshot = await getFirestore().collection("polls").doc(pollId).collection("votes").get();
  const votes = votesSnapshot.docs.map(doc => doc.data());

  // Aggregate vote counts
  const voteCounts: Record<string, { YES: number, NO: number, IF_NEED_BE: number }> = {};
  pollData.timeSlots.forEach(slot => {
    voteCounts[slot.id] = { YES: 0, NO: 0, IF_NEED_BE: 0 };
  });

  votes.forEach(vote => {
    const selections = vote.selections || {};
    Object.entries(selections).forEach(([slotId, value]) => {
      if (voteCounts[slotId]) {
        voteCounts[slotId][value as "YES" | "NO" | "IF_NEED_BE"]++;
      }
    });
  });

  return {
    poll: pollData,
    votes,
    voteCounts,
  };
};

export const getPoll = functions.https.onCall<{ pollId: string }>(getPollHandler);

export const pingHandler = async () => {
  return { pong: true };
};

export const ping = functions.https.onCall(pingHandler);
