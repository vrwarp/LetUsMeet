import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineJsonSecret } from "firebase-functions/params";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

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
  { secrets: [appConfig] },
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
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

    // 4. Configure the model and prompt
    const modelName = "gemma-4-26b-a4b-it"; // Alternative "gemma-4-31b-it";
    const config = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
      systemInstruction: [
        {
          text: `You are an expert time-slot extraction engine for a scheduling application. Your sole purpose is to convert natural language time queries into a strict, structured JSON format.

RULES:
1. Output ONLY valid JSON. No conversational filler, no markdown formatting outside of the JSON block.
2. You must first provide a 'reasoning' string at the root level explaining your date math and exclusions.
3. Format dates strictly as YYYY-MM-DD.
4. Format times strictly in 24-hour format as HH:MM.
5. All relative dates (e.g., 'next week', 'tomorrow') must be calculated relative to the CURRENT_DATE provided below.
6. Strictly obey exclusions (e.g., 'except Wednesday', 'not weekends').

EXPECTED OUTPUT SCHEMA:
{
  "reasoning": "Step-by-step logic calculating the correct dates and applying exclusions.",
  "time_slots": [
    {
      "date": "YYYY-MM-DD",
      "start_time": "HH:MM",
      "end_time": "HH:MM"
    }
  ]
}

---
CURRENT_DATE: ${currentDate} (${dayOfWeek})`,
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
  { secrets: [appConfig] },
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
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });

    // 4. Configure the model and prompt
    const modelName = "gemma-4-26b-a4b-it";
    const config = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
      systemInstruction: [
        {
          text: `You are an expert AI scheduling assistant for a scheduling application. Your task is to parse a user's natural language availability and convert it into structured JSON for flexible 'fuzzy' scheduling blocks.

RULES:
1. Output ONLY valid JSON. No conversational filler, no markdown formatting outside of the JSON block.
2. Provide a 'reasoning' string at the root level explaining your date math and interpretation of the user's intent.
3. Format dates strictly as YYYY-MM-DD relative to CURRENT_DATE.
4. Labels should be concise, prioritizing single word but no more than a few words.
5. Labels are flexible. They can be used to describe time of day (e.g. morning), activity (e.g. hiking), or any other descriptor that makes sense for the user's query.
6. Inferred Time: Inferred time is optional and should only be used if the request explicitly asks for or implies an hour of the day. Otherwise, leave the time as an empty string "".
7. Deduplication: If the user says 'Evenings next week', generate a distinct slot for each day, all with the label 'Evening'.

EXPECTED OUTPUT SCHEMA:
{
  "reasoning": "Step-by-step logic calculating dates and inferring labels.",
  "fuzzy_slots": [
    {
      "date": "YYYY-MM-DD",
      "label": "Short Label",
      "time": "HH:MM"
    }
  ]
}

---
CURRENT_DATE: ${currentDate} (${dayOfWeek})`,
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
