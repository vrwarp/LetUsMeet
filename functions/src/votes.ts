import * as functions from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { deleteVoteSchema, submitVoteSchema } from "./validators.js";
import { DeleteVoteRequest, SubmitVoteRequest, Vote } from "./types.js";

export const submitVoteHandler = async (request: functions.https.CallableRequest<SubmitVoteRequest>) => {
  // 1. Validate auth
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  // 2. Parse & validate body
  const validation = submitVoteSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { pollId, voteId, participantName, participantEmail, selections } = validation.data;

  // 3. Verify poll exists and is OPEN
  const pollRef = getFirestore().collection("polls").doc(pollId);
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

  // 5. Write vote document
  let voteRef;
  let existingVoteData = null;

  if (voteId && voteId.trim() !== "") {
    // Editing an existing vote
    voteRef = pollRef.collection("votes").doc(voteId);
    const existingVote = await voteRef.get();
    if (!existingVote.exists) {
      throw new functions.https.HttpsError("not-found", "Vote not found.");
    }
    existingVoteData = existingVote.data();
    // Verify ownership
    if (existingVoteData?.participantUid !== request.auth.uid) {
      throw new functions.https.HttpsError("permission-denied", "You do not have permission to edit this vote.");
    }
  } else {
    // Creating a new vote
    // Note: We used to use UID as doc ID, so we should check if a vote with this UID exists 
    // to maintain the "edit" behavior for legacy votes if they don't provide a voteId.
    const legacyVoteRef = pollRef.collection("votes").doc(request.auth.uid);
    const legacyVote = await legacyVoteRef.get();
    
    if (legacyVote.exists) {
      voteRef = legacyVoteRef;
      existingVoteData = legacyVote.data();
    } else {
      voteRef = pollRef.collection("votes").doc();
    }
  }
  
  const now = new Date().toISOString();
  const createdAt = existingVoteData ? existingVoteData.createdAt : now;
  
  const voteData: Vote = {
    voteId: voteRef.id,
    participantUid: request.auth.uid,
    participantName,
    participantEmail: participantEmail || null,
    selections,
    createdAt,
    updatedAt: now,
  };

  await voteRef.set(voteData, { merge: true });

  return { success: true, voteId: voteRef.id };
};

export const submitVote = functions.https.onCall<SubmitVoteRequest>(submitVoteHandler);

export const deleteVoteHandler = async (request: functions.https.CallableRequest<DeleteVoteRequest>) => {
  // 1. Validate auth
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  // 2. Parse & validate body
  const validation = deleteVoteSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { pollId, voteId } = validation.data;

  // 3. Verify poll exists and is OPEN
  const pollRef = getFirestore().collection("polls").doc(pollId);
  const pollDoc = await pollRef.get();
  if (!pollDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Poll not found.");
  }

  const pollData = pollDoc.data();
  if (pollData?.status !== "OPEN") {
    throw new functions.https.HttpsError("failed-precondition", "Poll is not open for voting.");
  }

  // 4. Verify vote exists and belongs to the user
  const voteRef = pollRef.collection("votes").doc(voteId);
  const voteDoc = await voteRef.get();
  if (!voteDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Vote not found.");
  }

  const voteData = voteDoc.data();
  if (voteData?.participantUid !== request.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "You do not have permission to delete this vote.");
  }

  // 5. Delete the vote
  await voteRef.delete();

  return { success: true };
};

export const deleteVote = functions.https.onCall<DeleteVoteRequest>(deleteVoteHandler);
