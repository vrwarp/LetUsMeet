import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { submitVoteSchema } from "./validators";
import { SubmitVoteRequest, Vote } from "./types";

export const submitVote = functions.https.onCall<SubmitVoteRequest>(async (request) => {
  // 1. Validate auth
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  // 2. Parse & validate body
  const validation = submitVoteSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { pollId, participantName, participantEmail, selections } = validation.data;

  // 3. Verify poll exists and is OPEN
  const pollRef = admin.firestore().collection("polls").doc(pollId);
  const pollDoc = await pollRef.get();
  if (!pollDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Poll not found.");
  }

  const pollData = pollDoc.data();
  if (pollData?.status !== "OPEN") {
    throw new functions.https.HttpsError("failed-precondition", "Poll is not open for voting.");
  }

  // 4. Verify selections match poll time slots
  const validSlotIds = new Set(pollData.timeSlots.map((s: any) => s.id));
  const selectionIds = Object.keys(selections);
  if (!selectionIds.every(id => validSlotIds.has(id))) {
    throw new functions.https.HttpsError("invalid-argument", "One or more time slot IDs are invalid.");
  }

  // 5. Write vote document (using UID as doc ID to enforce one-vote-per-user)
  const voteRef = pollRef.collection("votes").doc(request.auth.uid);
  const now = new Date().toISOString();
  
  const voteData: Vote & { participantUid: string } = {
    voteId: request.auth.uid,
    participantUid: request.auth.uid,
    participantName,
    participantEmail: participantEmail || undefined,
    selections,
    createdAt: pollDoc.exists ? (await voteRef.get()).data()?.createdAt || now : now,
    updatedAt: now,
  };

  await voteRef.set(voteData, { merge: true });

  return { success: true };
});
