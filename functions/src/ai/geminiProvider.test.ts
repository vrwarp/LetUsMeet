import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGeminiProvider } from "./geminiProvider";

const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  ThinkingLevel: { MINIMAL: "MINIMAL" },
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContent: generateContentMock,
      },
    };
  }),
}));

describe("createGeminiProvider", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
  });

  it("uses the model name as provider name and passes responseJsonSchema when jsonSchema is provided", async () => {
    generateContentMock.mockResolvedValue({
      text: "```json\n{\"reasoning\":\"ok\",\"time_slots\":[]}\n```",
    });

    const schema = {
      type: "object",
      properties: { reasoning: { type: "string" } },
      required: ["reasoning"],
    };

    const provider = createGeminiProvider("test-key", "gemini-3.5-flash-lite");
    expect(provider.name).toBe("gemini-3.5-flash-lite");

    const response = await provider.generate({
      systemPrompt: "sys prompt",
      userMessage: "tomorrow at 3pm",
      jsonMode: true,
      jsonSchema: { name: "time_slots_response", schema },
    });

    expect(response).toEqual({
      text: "{\"reasoning\":\"ok\",\"time_slots\":[]}",
      provider: "gemini-3.5-flash-lite",
    });

    expect(generateContentMock).toHaveBeenCalledWith({
      model: "gemini-3.5-flash-lite",
      config: {
        thinkingConfig: { thinkingLevel: "MINIMAL" },
        systemInstruction: [{ text: "sys prompt" }],
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
      contents: [{ role: "user", parts: [{ text: "tomorrow at 3pm" }] }],
    });
  });

  it("omits responseMimeType and responseJsonSchema when jsonMode is false and no schema is provided", async () => {
    generateContentMock.mockResolvedValue({ text: "plain reply" });

    const provider = createGeminiProvider("test-key", "gemma-4-26b-a4b-it");
    const response = await provider.generate({
      systemPrompt: "sys",
      userMessage: "hello",
      jsonMode: false,
    });

    expect(response).toEqual({
      text: "plain reply",
      provider: "gemma-4-26b-a4b-it",
    });

    expect(generateContentMock).toHaveBeenCalledWith({
      model: "gemma-4-26b-a4b-it",
      config: {
        thinkingConfig: { thinkingLevel: "MINIMAL" },
        systemInstruction: [{ text: "sys" }],
      },
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
    });
  });
});
