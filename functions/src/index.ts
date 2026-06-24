import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineJsonSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { getTimeSlotsPrompt } from "./prompts/timeSlots";
import { getFuzzySlotsPrompt } from "./prompts/fuzzySlots";
import { TIME_SLOTS_SCHEMA, FUZZY_SLOTS_SCHEMA } from "./prompts/schemas";
import { createAIRouter } from "./ai/router";
import { createCerebrasProvider } from "./ai/cerebrasProvider";
import { createGeminiProvider } from "./ai/geminiProvider";
import { AIProvider } from "./ai/types";
import * as admin from "firebase-admin";

admin.initializeApp();

// Declare a structured JSON secret to hold all app-wide configuration values.
// This helps stay within the Cloud Secret Manager free tier.
// Run: npx firebase-tools functions:secrets:set LETUSMEET_CONFIG
// and provide a JSON string: {"geminiApiKey": "your_key"}
const appConfig = defineJsonSecret("LETUSMEET_CONFIG");

interface AppConfig {
  geminiApiKey?: string;
  cerebrasApiKey?: string;
  ai?: {
    primary?: string;
    fallback?: string;
    cerebrasModel?: string;
    geminiModel?: string;
  };
}

// Helper to create the right provider from config
function resolveProvider(cfg: AppConfig, name: string): AIProvider {
  switch (name) {
  case "cerebras":
    return createCerebrasProvider(
      cfg.cerebrasApiKey || "",
      cfg.ai?.cerebrasModel || "gpt-oss-120b"
    );
  case "gemini":
  default:
    return createGeminiProvider(
      cfg.geminiApiKey || "",
      cfg.ai?.geminiModel || "gemma-4-26b-a4b-it"
    );
  }
}

/**
 * Natural language time-slot extraction using Cerebras (primary) / Google Gemma (fallback).
 */
export const extractTimeSlots = onCall(
  { secrets: [appConfig], maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in to use AI slot extraction.");
    }

    const userQuery = request.data?.query;
    if (typeof userQuery !== "string" || userQuery.trim().length === 0) {
      throw new HttpsError("invalid-argument", "A non-empty 'query' string is required.");
    }
    if (userQuery.length > 2000) {
      throw new HttpsError("invalid-argument", "Query is too long (max 2000 characters).");
    }

    const cfg = appConfig.value() as unknown as AppConfig;
    const router = createAIRouter({
      primary: resolveProvider(cfg, cfg.ai?.primary || "cerebras"),
      fallback: cfg.ai?.fallback ? resolveProvider(cfg, cfg.ai.fallback) : null,
    });

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

    try {
      const response = await router.generate({
        systemPrompt: getTimeSlotsPrompt(currentDate, dayOfWeek),
        userMessage: userQuery,
        jsonMode: true,
        jsonSchema: TIME_SLOTS_SCHEMA,
      });

      if (!response.text) throw new Error("AI returned an empty response.");
      return JSON.parse(response.text);
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error("AI Generation Error (extractTimeSlots):", error);
      throw new HttpsError("internal", "We couldn't parse the AI response. Please try again.");
    }
  }
);

/**
 * Natural language fuzzy-slot extraction using Cerebras (primary) / Google Gemma (fallback).
 */
export const extractFuzzySlots = onCall(
  { secrets: [appConfig], maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in to use AI slot extraction.");
    }

    const userQuery = request.data?.query;
    if (typeof userQuery !== "string" || userQuery.trim().length === 0) {
      throw new HttpsError("invalid-argument", "A non-empty 'query' string is required.");
    }
    if (userQuery.length > 2000) {
      throw new HttpsError("invalid-argument", "Query is too long (max 2000 characters).");
    }

    const cfg = appConfig.value() as unknown as AppConfig;
    const router = createAIRouter({
      primary: resolveProvider(cfg, cfg.ai?.primary || "cerebras"),
      fallback: cfg.ai?.fallback ? resolveProvider(cfg, cfg.ai.fallback) : null,
    });

    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

    try {
      const response = await router.generate({
        systemPrompt: getFuzzySlotsPrompt(currentDate, dayOfWeek),
        userMessage: userQuery,
        jsonMode: true,
        jsonSchema: FUZZY_SLOTS_SCHEMA,
      });

      if (!response.text) throw new Error("AI returned an empty response.");
      return JSON.parse(response.text);
    } catch (error: unknown) {
      if (error instanceof HttpsError) throw error;
      console.error("AI Generation Error (extractFuzzySlots):", error);
      throw new HttpsError("internal", "We couldn't parse the AI response. Please try again.");
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
  logger.log(`Starting account deletion for UID: ${uid}`);

  try {
    // 1. Delete Firestore user data (including Keystore)
    // This recursively deletes everything under /users/{uid}
    await admin.firestore().recursiveDelete(
      admin.firestore().doc(`users/${uid}`)
    );
    logger.log(`Firestore data for ${uid} deleted successfully.`);

    // 2. Delete the Auth user account
    await admin.auth().deleteUser(uid);
    logger.log(`Auth account for ${uid} deleted successfully.`);

    return { success: true };
  } catch (error) {
    logger.error("Account Deletion Error:", error);
    throw new HttpsError("internal", "An error occurred during account deletion.");
  }
});

/**
 * Scheduled function to refresh the public pool of active poll IDs used for chaffing.
 * Runs every 15 minutes.
 */
export const refreshChaffPool = onSchedule("every 15 minutes", async () => {
  const db = admin.firestore();
  logger.log("Refreshing chaff pool...");

  try {
    // 1. Fetch up to 100 of the most recently created polls.
    const pollsSnapshot = await db.collection("polls")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    if (pollsSnapshot.empty) {
      logger.log("No polls found. Leaving chaff pool empty.");
      return;
    }

    const pollIds = pollsSnapshot.docs.map(doc => doc.id);

    // 2. Shuffle the array to distribute chaff evenly
    const shuffledPool = pollIds.sort(() => 0.5 - Math.random());

    // 3. Write up to 50 active IDs into the public pool
    await db.doc("chaff_pool/current").set({
      activePollIds: shuffledPool.slice(0, 50),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.log(`Successfully updated chaff pool with ${Math.min(pollIds.length, 50)} IDs.`);
  } catch (error) {
    logger.error("Error refreshing chaff pool:", error);
  }
});

