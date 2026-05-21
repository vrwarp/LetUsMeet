import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AIProvider, AIGenerateRequest, AIGenerateResponse } from "./types";

export function createGeminiProvider(apiKey: string, model: string): AIProvider {
  const ai = new GoogleGenAI({ apiKey });

  return {
    name: "gemini",
    async generate(req: AIGenerateRequest): Promise<AIGenerateResponse> {
      const config = {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        systemInstruction: [{ text: req.systemPrompt }],
        ...(req.jsonMode && { responseMimeType: "application/json" }),
      };

      const response = await ai.models.generateContent({
        model,
        config,
        contents: [{ role: "user", parts: [{ text: req.userMessage }] }],
      });

      return {
        text: (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim(),
        provider: "gemini",
      };
    },
  };
}
