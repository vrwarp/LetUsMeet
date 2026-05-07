import * as functions from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { google } from "googleapis";
import { getOrganizerCalendarSchema } from "./validators.js";
import { GetOrganizerCalendarRequest } from "./types.js";

const oauth2Client = new google.auth.OAuth2(
  // Since we are using Firebase Auth Google provider, we don't strictly need the client secret to call APIs if we have the access token directly,
  // but googleapis library expects an oauth2Client. We can initialize it with dummy values and set the credentials.
  "client_id", // Dummy
  "client_secret", // Dummy
  "redirect_uri" // Dummy
);

export const getOrganizerCalendarHandler = async (request: functions.https.CallableRequest<GetOrganizerCalendarRequest>) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const validation = getOrganizerCalendarSchema.safeParse(request.data);
  if (!validation.success) {
    throw new functions.https.HttpsError("invalid-argument", validation.error.message);
  }

  const { timeMin, timeMax } = validation.data;

  // Get user's Google tokens from Firestore
  const userDoc = await getFirestore().collection("users").doc(request.auth.uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User not found.");
  }

  const userData = userDoc.data();
  const tokens = userData?.googleTokens;

  if (!tokens || !tokens.accessToken) {
    throw new functions.https.HttpsError("permission-denied", "User has not linked their Google Calendar.");
  }

  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    // Add refresh_token if available to allow auto-refresh, but for this demo access_token might suffice if not expired.
    ...(tokens.refreshToken ? { refresh_token: tokens.refreshToken } : {}),
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      },
    });

    const busyTimes = response.data.calendars?.primary?.busy || [];
    return { busyTimes };
  } catch (error: any) {
    console.error("Error fetching calendar:", error);
    if (error.code === 401) {
       throw new functions.https.HttpsError("unauthenticated", "Google Calendar access token is invalid or expired.");
    }
    throw new functions.https.HttpsError("internal", "Failed to fetch calendar events.");
  }
};

export const getOrganizerCalendar = functions.https.onCall<GetOrganizerCalendarRequest>(getOrganizerCalendarHandler);
