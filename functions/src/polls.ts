import { createPollSchema, finalizePollSchema } from "./validators.js";
import { FinalizePollRequest, ExactTimeSlot, CreatePollRequest, Poll, TimeSlot } from "./types.js";
import { google } from "googleapis";
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

  const { title, location, schedulingMode, timeSlots: rawSlots, organizerName, organizerEmail } = validation.data;

  // 3. Generate sequential IDs for time slots
  const timeSlots: TimeSlot[] = rawSlots.map((slot, index) => ({
    id: `t${index + 1}`,
    ...slot,
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
  const selectedSlot = pollData.timeSlots.find(s => s.id === selectedTimeSlotId);
  if (!selectedSlot) {
    throw new functions.https.HttpsError("invalid-argument", "Selected time slot is invalid.");
  }

  // 4. Update Poll Status
  await pollRef.update({
    status: "FINALIZED",
    finalizedSlotId: selectedTimeSlotId,
  });

  // 5. Calendar Integration (Only if EXACT scheduling)
  let eventId = undefined;
  if (pollData.schedulingMode === "EXACT") {
    try {
      const exactSlot = selectedSlot as ExactTimeSlot;

      // Get User Tokens
      const userDoc = await db.collection("users").doc(request.auth.uid).get();
      const userData = userDoc.data();

      if (userData?.googleTokens?.accessToken) {
        // Fetch votes to get attendees
        const votesSnapshot = await pollRef.collection("votes").get();
        const attendees: { email: string }[] = [];
        votesSnapshot.forEach(doc => {
          const voteData = doc.data();
          if (voteData.participantEmail) {
            const userVote = voteData.selections?.[selectedTimeSlotId];
            if (userVote === "YES" || userVote === "IF_NEED_BE") {
              attendees.push({ email: voteData.participantEmail });
            }
          }
        });

        const oauth2Client = new google.auth.OAuth2("client_id", "client_secret", "redirect_uri");
        oauth2Client.setCredentials({
          access_token: userData.googleTokens.accessToken,
          ...(userData.googleTokens.refreshToken ? { refresh_token: userData.googleTokens.refreshToken } : {}),
        });

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const event = {
          summary: pollData.title,
          location: pollData.location,
          start: {
            dateTime: exactSlot.startTime,
          },
          end: {
            dateTime: exactSlot.endTime,
          },
          attendees: attendees,
        };

        const response = await calendar.events.insert({
          calendarId: "primary",
          sendUpdates: "all",
          requestBody: event,
        });

        eventId = response.data.id;
      }
    } catch (error) {
      console.error("Failed to create Google Calendar event:", error);
      // We do not throw an error here, the poll is successfully finalized even if calendar sync fails.
    }
  }

  return { success: true, eventId };
};

export const finalizePoll = functions.https.onCall<FinalizePollRequest>(finalizePollHandler);
