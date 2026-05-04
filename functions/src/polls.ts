import * as functions from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { createPollSchema } from "./validators.js";
import { CreatePollRequest, Poll, TimeSlot } from "./types.js";

export const createPoll = functions.https.onCall<CreatePollRequest>({ cors: true }, async (request) => {
  console.log("createPoll triggered", request.data);
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
    location,
    schedulingMode,
    timeSlots,
    status: "OPEN",
    createdAt: new Date().toISOString(),
  };

  await pollRef.set(poll);

  return { pollId: pollRef.id };
});

export const getPoll = functions.https.onCall<{ pollId: string }>({ cors: true }, async (request) => {
  const { pollId } = request.data;
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
});
