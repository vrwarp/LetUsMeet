import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineJsonSecret } from "firebase-functions/params";
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

// Helper to create the right provider from config
function resolveProvider(cfg: any, name: string): AIProvider {
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
  { secrets: [appConfig] },
  async (request) => {
    const userQuery = request.data.query;
    if (!userQuery) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'query' argument.");
    }

    const cfg = appConfig.value() as any;
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
      console.error("AI Generation Error:", error);
      throw new HttpsError("internal", error instanceof Error ? error.message : "Failed to parse time slots.");
    }
  }
);

/**
 * Natural language fuzzy-slot extraction using Cerebras (primary) / Google Gemma (fallback).
 */
export const extractFuzzySlots = onCall(
  { secrets: [appConfig] },
  async (request) => {
    const userQuery = request.data.query;
    if (!userQuery) {
      throw new HttpsError("invalid-argument", "The function must be called with a 'query' argument.");
    }

    const cfg = appConfig.value() as any;
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
