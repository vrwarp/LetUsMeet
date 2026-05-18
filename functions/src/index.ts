import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineJsonSecret } from "firebase-functions/params";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { getTimeSlotsPrompt } from "./prompts/timeSlots";
import { getFuzzySlotsPrompt } from "./prompts/fuzzySlots";
import * as admin from "firebase-admin";

admin.initializeApp();

// Declare a structured JSON secret to hold all app-wide configuration values.
// This helps stay within the Cloud Secret Manager free tier.
// Run: npx firebase-tools functions:secrets:set LETUSMEET_CONFIG
// and provide a JSON string: {"geminiApiKey": "your_key"}
const appConfig = defineJsonSecret("LETUSMEET_CONFIG");

/**
 * Natural language time-slot extraction using Google Gemma.
 */
export const extractTimeSlots = onCall(
  { secrets: [appConfig] },
  async (request) => {
    const userQuery = request.data.query;
    if (!userQuery) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'query' argument.");
    }

    const ai = new GoogleGenAI({ apiKey: appConfig.value().geminiApiKey });
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

    const config = {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      systemInstruction: [{ text: getTimeSlotsPrompt(currentDate, dayOfWeek) }],
      responseMimeType: "application/json",
    };

    try {
      const response = await ai.models.generateContent({
        model: "gemma-4-26b-a4b-it",
        config,
        contents: [{ role: "user", parts: [{ text: userQuery }] }],
      });

      const cleanJson = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
      if (!cleanJson) throw new Error("AI returned an empty response.");
      return JSON.parse(cleanJson);
    } catch (error: unknown) {
      console.error("AI Generation Error:", error);
      throw new HttpsError("internal", error instanceof Error ? error.message : "Failed to parse time slots.");
    }
  }
);

/**
 * Natural language fuzzy-slot extraction using Google Gemma.
 */
export const extractFuzzySlots = onCall(
  { secrets: [appConfig] },
  async (request) => {
    const userQuery = request.data.query;
    if (!userQuery) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'query' argument.");
    }

    const ai = new GoogleGenAI({ apiKey: appConfig.value().geminiApiKey });
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

    const config = {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      systemInstruction: [{ text: getFuzzySlotsPrompt(currentDate, dayOfWeek) }],
      responseMimeType: "application/json",
    };

    try {
      const response = await ai.models.generateContent({
        model: "gemma-4-26b-a4b-it",
        config,
        contents: [{ role: "user", parts: [{ text: userQuery }] }],
      });

      const cleanJson = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
      if (!cleanJson) throw new Error("AI returned an empty response.");
      return JSON.parse(cleanJson);
    } catch (error: unknown) {
      console.error("AI Generation Error:", error);
      throw new HttpsError("internal", error instanceof Error ? error.message : "Failed to parse fuzzy slots.");
    }
  }
);

/**
 * GDPR Account Deletion via Cryptographic Shredding.
 * Deletes the user's document, keystore, and auth account.
 */
export const deleteUserAccount = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in to delete account.");
  }

  const uid = request.auth.uid;
  console.log(`Starting account deletion for UID: ${uid}`);

  try {
    // 1. Delete Firestore user data (including Keystore)
    // This recursively deletes everything under /users/{uid}
    await admin.firestore().recursiveDelete(
      admin.firestore().doc(`users/${uid}`)
    );
    console.log(`Firestore data for ${uid} deleted successfully.`);

    // 2. Delete the Auth user account
    await admin.auth().deleteUser(uid);
    console.log(`Auth account for ${uid} deleted successfully.`);

    return { success: true };
  } catch (error) {
    console.error("Account Deletion Error:", error);
    throw new HttpsError("internal", "An error occurred during account deletion.");
  }
});
