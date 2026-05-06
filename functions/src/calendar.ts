import { google } from "googleapis";
import * as functions from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { getOrganizerCalendarSchema, finalizePollSchema } from "./validators.js";
import { GetOrganizerCalendarRequest, FinalizePollRequest, Poll, User } from "./types.js";

const getOAuth2Client = async (uid: string) => {
  const userDoc = await getFirestore().collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User tokens not found. Please sign in again.");
  }
  const userData = userDoc.data() as User;
  const { accessToken, refreshToken, expiryDate } = userData.googleTokens;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      await getFirestore().collection("users").doc(uid).update({
        "googleTokens.refreshToken": tokens.refresh_token,
      });
    }
    if (tokens.access_token) {
      await getFirestore().collection("users").doc(uid).update({
        "googleTokens.accessToken": tokens.access_token,
        "googleTokens.expiryDate": tokens.expiry_date,
      });
    }
  });

  return oauth2Client;
};

export const getOrganizerCalendar = functions.https.onCall<GetOrganizerCalendarRequest>(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const validation = getOrganizerCalendarSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { timeMin, timeMax } = validation.data;

  try {
    const auth = await getOAuth2Client(request.auth.uid);
    const calendar = google.calendar({ version: "v3", auth });

    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      },
    });

    const busy = response.data.calendars?.primary?.busy || [];
    return { busy };
  } catch (error: any) {
    console.error("Error fetching calendar:", error);
    throw new functions.https.HttpsError("internal", "Failed to fetch calendar events.");
  }
});

export const finalizePoll = functions.https.onCall<FinalizePollRequest>(async (request) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const validation = finalizePollSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { pollId, selectedTimeSlotId, timezone = "UTC" } = validation.data;

  const pollRef = getFirestore().collection("polls").doc(pollId);
  const pollDoc = await pollRef.get();

  if (!pollDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Poll not found.");
  }

  const pollData = pollDoc.data() as Poll;

  console.log("Finalizing poll:", { pollId, organizerUid: pollData.organizerUid, authUid: request.auth.uid });

  if (pollData.organizerUid && pollData.organizerUid !== request.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Only the organizer can finalize the poll.");
  }

  const selectedSlot = pollData.timeSlots.find(s => s.id === selectedTimeSlotId);
  if (!selectedSlot) {
    throw new functions.https.HttpsError("invalid-argument", "Selected time slot not found.");
  }

  try {
    const authClient = await getOAuth2Client(request.auth.uid);
    const calendar = google.calendar({ version: "v3", auth: authClient });

    // Fetch participant emails
    const votesSnapshot = await pollRef.collection("votes").get();
    const attendees = votesSnapshot.docs
      .map(doc => doc.data().participantEmail)
      .filter(email => !!email)
      .map(email => ({ email }));

    let start, end;
    if ("startTime" in selectedSlot) {
      start = { dateTime: selectedSlot.startTime };
      end = { dateTime: selectedSlot.endTime };
    } else {
      const date = selectedSlot.date;
      const time = (selectedSlot as any).time || "09:00";
      // Use provided timezone instead of hardcoded Z
      start = {
        dateTime: `${date}T${time}:00`,
        timeZone: timezone
      };

      const [h, m] = time.split(':').map(Number);
      const endDate = new Date(Date.UTC(2000, 0, 1, h, m));
      endDate.setUTCHours(endDate.getUTCHours() + 1);
      const endTime = endDate.getUTCHours().toString().padStart(2, '0') + ":" + endDate.getUTCMinutes().toString().padStart(2, '0');

      end = {
        dateTime: `${date}T${endTime}:00`,
        timeZone: timezone
      };
    }

    const event = await calendar.events.insert({
      calendarId: "primary",
      sendUpdates: "all",
      requestBody: {
        summary: pollData.title,
        location: pollData.location,
        description: `Scheduled via LetUsMeet`,
        start,
        end,
        attendees,
      },
    });

    await pollRef.update({
      status: "FINALIZED",
      finalizedSlotId: selectedTimeSlotId,
    });

    return { success: true, calendarEventId: event.data.id };
  } catch (error: any) {
    console.error("Error finalizing poll:", error);
    throw new functions.https.HttpsError("internal", "Failed to finalize poll and create calendar event.");
  }
});
