import { createPollSchema, finalizePollSchema, updatePollSchema } from "./validators.js";
import { FinalizePollRequest, CreatePollRequest, Poll, TimeSlot, UpdatePollRequest } from "./types.js";
import * as crypto from "crypto";
import * as functions from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
export const createPollHandler = async (request: functions.https.CallableRequest<CreatePollRequest>) => {
  console.log("createPoll triggered", { data: request.data, auth: request.auth?.uid });
  try {
  // 1. Auth is optional
    const organizerUid = request.auth?.uid;

    // 2. Parse & validate body
    const validation = createPollSchema.safeParse(request.data);
    if (!validation.success) {
      throw new functions.https.HttpsError("invalid-argument", validation.error.message);
    }

    const {
      title, description, location, schedulingMode,
      timeSlots: rawSlots, organizerName, organizerEmail,
    } = validation.data;

    // 3. Generate sequential IDs for time slots
    const timeSlots: TimeSlot[] = rawSlots.map((slot, index) => ({
      ...slot,
      id: `t${index + 1}`,
    }));

    // 4. Generate admin token
    const adminToken = crypto.randomUUID();

    // 5. Create poll document
    const pollRef = getFirestore().collection("polls").doc();
    const poll: Poll = {
      pollId: pollRef.id,
      organizerUid: organizerUid || null,
      organizerName,
      organizerEmail,
      adminToken,
      title,
      description: description || "",
      location: location || "",
      schedulingMode,
      timeSlots,
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };

    await pollRef.set(poll);

    return { pollId: pollRef.id, adminToken };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Error in createPoll:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to create poll");
  }
};

export const createPoll = functions.https.onCall<CreatePollRequest>({ cors: true, invoker: "public" }, createPollHandler);

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
  const votes = votesSnapshot.docs.map((doc) => doc.data());

  // Aggregate vote counts
  const voteCounts: Record<string, { YES: number, NO: number, IF_NEED_BE: number }> = {};
  pollData.timeSlots.forEach((slot) => {
    voteCounts[slot.id] = { YES: 0, NO: 0, IF_NEED_BE: 0 };
  });

  votes.forEach((vote) => {
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

export const getPoll = functions.https.onCall<{ pollId: string }>({ cors: true, invoker: "public" }, getPollHandler);

export const pingHandler = async () => {
  return { pong: true };
};

export const ping = functions.https.onCall({ cors: true, invoker: "public" }, pingHandler);


export const finalizePollHandler = async (request: functions.https.CallableRequest<FinalizePollRequest>) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const validation = finalizePollSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { pollId, selectedTimeSlotId } = validation.data;
  const db = getFirestore();

  // 1. Get Poll
  const pollRef = db.collection("polls").doc(pollId);
  const pollDoc = await pollRef.get();

  if (!pollDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Poll not found.");
  }

  const pollData = pollDoc.data() as Poll;

  // 2. Verify Ownership
  if (pollData.organizerUid !== request.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Only the organizer can finalize this poll.");
  }

  // 3. Find selected time slot
  const selectedSlot = pollData.timeSlots.find((s) => s.id === selectedTimeSlotId);
  if (!selectedSlot) {
    throw new functions.https.HttpsError("invalid-argument", "Selected time slot is invalid.");
  }

  // 4. Update Poll Status
  await pollRef.update({
    status: "FINALIZED",
    finalizedSlotId: selectedTimeSlotId,
  });

  return { success: true };
};

export const finalizePoll = functions.https.onCall<FinalizePollRequest>({ cors: true, invoker: "public" }, finalizePollHandler);

export const updatePollHandler = async (request: functions.https.CallableRequest<UpdatePollRequest>) => {
  console.log("updatePoll triggered", { data: request.data, auth: request.auth?.uid });
  try {
    const validation = updatePollSchema.safeParse(request.data);
    if (!validation.success) {
      throw new functions.https.HttpsError("invalid-argument", validation.error.message);
    }

    const { pollId, adminToken, title, description, location, timeSlots: rawSlots } = validation.data;
    const db = getFirestore();
    const pollRef = db.collection("polls").doc(pollId);
    const pollDoc = await pollRef.get();

    if (!pollDoc.exists) {
      throw new functions.https.HttpsError("not-found", "Poll not found.");
    }

    const pollData = pollDoc.data() as Poll;

    // Authorization: organizerUid matches OR adminToken matches
    const isOwner = request.auth?.uid && pollData.organizerUid === request.auth.uid;
    const isAdmin = adminToken && pollData.adminToken === adminToken;

    if (!isOwner && !isAdmin) {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized to edit this poll.");
    }

    // Prepare updated time slots
    // We need to keep existing IDs for slots that are being updated, and generate new ones for new slots.
    // However, the client should ideally provide IDs for existing ones.
    // The request payload for timeSlots is (CreateTimeSlotPayload & { id?: string })[]

    // Find max existing ID to continue sequence if needed
    const existingIds = pollData.timeSlots
      .map((s) => (s.id && typeof s.id === "string") ? parseInt(s.id.substring(1)) : NaN)
      .filter((n) => !isNaN(n));
    let nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    const updatedTimeSlots: TimeSlot[] = rawSlots.map((slot) => {
      if (slot.id) {
        return slot as TimeSlot;
      } else {
        const newSlot = {
          ...slot,
          id: `t${nextId++}`,
        } as TimeSlot;
        return newSlot;
      }
    });

    await pollRef.update({
      title,
      description: description || "",
      location: location || "",
      timeSlots: updatedTimeSlots,
    });

    return { success: true };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error("Error in updatePoll:", error);
    throw new functions.https.HttpsError("internal", error.message || "Failed to update poll");
  }
};

export const updatePoll = functions.https.onCall<UpdatePollRequest>({ cors: true, invoker: "public" }, updatePollHandler);
