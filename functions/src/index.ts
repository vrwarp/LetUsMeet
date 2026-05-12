import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineJsonSecret} from "firebase-functions/params";
import {GoogleGenAI, ThinkingLevel} from "@google/genai";
import {getTimeSlotsPrompt} from "./prompts/timeSlots";
import {getFuzzySlotsPrompt} from "./prompts/fuzzySlots";

// Declare a structured JSON secret to hold all app-wide configuration values.
// This helps stay within the Cloud Secret Manager free tier.
// Run: npx firebase-tools functions:secrets:set LETUSMEET_CONFIG
// and provide a JSON string: {"geminiApiKey": "your_key"}
const appConfig = defineJsonSecret("LETUSMEET_CONFIG");

/**
 * Natural language time-slot extraction using Google Gemma.
 * This function takes a query like "next friday 6pm" and returns
 * structured JSON with reasoning and time slots.
 */
export const extractTimeSlots = onCall(
  {secrets: [appConfig]},
  async (request) => {
    // 1. Validate Input
    const userQuery = request.data.query;
    if (!userQuery) {
      throw new HttpsError(
        "invalid-argument",
        "The function must be called with a 'query' argument."
      );
    }

    // 2. Initialize the AI client using the structured secret
    const ai = new GoogleGenAI({
      apiKey: appConfig.value().geminiApiKey,
    });

    // 3. Prepare dynamic context for the prompt
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const dayOfWeek = now.toLocaleDateString("en-US", {weekday: "long"});

    // 4. Configure the model and prompt
    const modelName = "gemma-4-26b-a4b-it"; // Alternative "gemma-4-31b-it";
    const config = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
      systemInstruction: [
        {
          text: getTimeSlotsPrompt(currentDate, dayOfWeek),
        },
      ],
      responseMimeType: "application/json",
    };

    try {
      // 5. Generate content (Non-streaming for stable JSON parsing)
      const response = await ai.models.generateContent({
        model: modelName,
        config,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: userQuery,
              },
            ],
          },
        ],
      });

      // 6. Extract and clean the result
      const resultText = response.text || "";

      // Remove any potential markdown wrappers the model might still include
      const cleanJson = resultText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      if (!cleanJson) {
        throw new Error("AI returned an empty response.");
      }

      return JSON.parse(cleanJson);
    } catch (error: unknown) {
      console.error("AI Generation Error:", error);

      // Map common errors or throw a general internal error
      const message = error instanceof Error ?
        error.message :
        "Failed to parse time slots using AI.";

      throw new HttpsError("internal", message);
    }
  }
);

/**
 * Natural language fuzzy-slot extraction using Google Gemma.
 * Takes a query like "Dinner next weekend" and returns
 * structured JSON with labels and inferred times.
 */
export const extractFuzzySlots = onCall(
  {secrets: [appConfig]},
  async (request) => {
    // 1. Validate Input
    const userQuery = request.data.query;
    if (!userQuery) {
      throw new HttpsError(
        "invalid-argument",
        "The function must be called with a 'query' argument."
      );
    }

    // 2. Initialize the AI client
    const ai = new GoogleGenAI({
      apiKey: appConfig.value().geminiApiKey,
    });

    // 3. Prepare dynamic context for the prompt
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const dayOfWeek = now.toLocaleDateString("en-US", {weekday: "long"});

    // 4. Configure the model and prompt
    const modelName = "gemma-4-26b-a4b-it";
    const config = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
      systemInstruction: [
        {
          text: getFuzzySlotsPrompt(currentDate, dayOfWeek),
        },
      ],
      responseMimeType: "application/json",
    };

    try {
      // 5. Generate content
      const response = await ai.models.generateContent({
        model: modelName,
        config,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: userQuery,
              },
            ],
          },
        ],
      });

      // 6. Extract and clean the result
      const resultText = response.text || "";

      const cleanJson = resultText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      if (!cleanJson) {
        throw new Error("AI returned an empty response.");
      }

      return JSON.parse(cleanJson);
    } catch (error: unknown) {
      console.error("AI Generation Error:", error);

      const message = error instanceof Error ?
        error.message :
        "Failed to parse fuzzy slots using AI.";

      throw new HttpsError("internal", message);
    }
  }
);
