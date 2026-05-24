import { describe, it, expect, vi } from "vitest";
import { createAIRouter } from "./router";
import { AIProvider } from "./types";

describe("AIRouter Retry and Fallback Logic", () => {
  it("should successfully return response from primary provider if it succeeds on first try", async () => {
    const primaryMock: AIProvider = {
      name: "cerebras",
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({ reasoning: "ok", time_slots: [] }),
        provider: "cerebras",
      }),
    };

    const fallbackMock: AIProvider = {
      name: "gemini",
      generate: vi.fn(),
    };

    const router = createAIRouter({
      primary: primaryMock,
      fallback: fallbackMock,
      maxRetries: 1,
    });

    const response = await router.generate({
      systemPrompt: "sys",
      userMessage: "user",
      jsonMode: true,
    });

    expect(response.text).toBe("{\"reasoning\":\"ok\",\"time_slots\":[]}");
    expect(response.provider).toBe("cerebras");
    expect(primaryMock.generate).toHaveBeenCalledTimes(1);
    expect(fallbackMock.generate).not.toHaveBeenCalled();
  });

  it("should retry primary provider if it fails, and succeed if retry succeeds", async () => {
    let callCount = 0;
    const primaryMock: AIProvider = {
      name: "cerebras",
      generate: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Temporary network error");
        }
        return {
          text: JSON.stringify({ reasoning: "retry ok" }),
          provider: "cerebras",
        };
      }),
    };

    const fallbackMock: AIProvider = {
      name: "gemini",
      generate: vi.fn(),
    };

    const router = createAIRouter({
      primary: primaryMock,
      fallback: fallbackMock,
      maxRetries: 2,
    });

    const response = await router.generate({
      systemPrompt: "sys",
      userMessage: "user",
      jsonMode: true,
    });

    expect(response.text).toBe("{\"reasoning\":\"retry ok\"}");
    expect(primaryMock.generate).toHaveBeenCalledTimes(2);
    expect(fallbackMock.generate).not.toHaveBeenCalled();
  });

  it("should fall back to fallback provider if primary fails all attempts", async () => {
    const primaryMock: AIProvider = {
      name: "cerebras",
      generate: vi.fn().mockRejectedValue(new Error("Permanent outage")),
    };

    const fallbackMock: AIProvider = {
      name: "gemini",
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({ reasoning: "fallback ok" }),
        provider: "gemini",
      }),
    };

    const router = createAIRouter({
      primary: primaryMock,
      fallback: fallbackMock,
      maxRetries: 1, // 1 retry = 2 attempts total
    });

    const response = await router.generate({
      systemPrompt: "sys",
      userMessage: "user",
      jsonMode: true,
    });

    expect(response.text).toBe("{\"reasoning\":\"fallback ok\"}");
    expect(response.provider).toBe("gemini");
    expect(primaryMock.generate).toHaveBeenCalledTimes(2);
    expect(fallbackMock.generate).toHaveBeenCalledTimes(1);
  });

  it("should treat empty response as failure and trigger fallback", async () => {
    const primaryMock: AIProvider = {
      name: "cerebras",
      generate: vi.fn().mockResolvedValue({
        text: "",
        provider: "cerebras",
      }),
    };

    const fallbackMock: AIProvider = {
      name: "gemini",
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({ reasoning: "empty fallback ok" }),
        provider: "gemini",
      }),
    };

    const router = createAIRouter({
      primary: primaryMock,
      fallback: fallbackMock,
      maxRetries: 0, // no retries, go straight to fallback
    });

    const response = await router.generate({
      systemPrompt: "sys",
      userMessage: "user",
      jsonMode: true,
    });

    expect(response.text).toBe("{\"reasoning\":\"empty fallback ok\"}");
    expect(response.provider).toBe("gemini");
    expect(primaryMock.generate).toHaveBeenCalledTimes(1);
    expect(fallbackMock.generate).toHaveBeenCalledTimes(1);
  });

  it("should treat invalid JSON in jsonMode as failure and trigger fallback", async () => {
    const primaryMock: AIProvider = {
      name: "cerebras",
      generate: vi.fn().mockResolvedValue({
        text: "Not JSON at all",
        provider: "cerebras",
      }),
    };

    const fallbackMock: AIProvider = {
      name: "gemini",
      generate: vi.fn().mockResolvedValue({
        text: JSON.stringify({ reasoning: "json fallback ok" }),
        provider: "gemini",
      }),
    };

    const router = createAIRouter({
      primary: primaryMock,
      fallback: fallbackMock,
      maxRetries: 0,
    });

    const response = await router.generate({
      systemPrompt: "sys",
      userMessage: "user",
      jsonMode: true,
    });

    expect(response.text).toBe("{\"reasoning\":\"json fallback ok\"}");
    expect(response.provider).toBe("gemini");
    expect(primaryMock.generate).toHaveBeenCalledTimes(1);
    expect(fallbackMock.generate).toHaveBeenCalledTimes(1);
  });

  it("should throw consolidated error if all attempts on both providers fail", async () => {
    const primaryMock: AIProvider = {
      name: "cerebras",
      generate: vi.fn().mockRejectedValue(new Error("Primary dead")),
    };

    const fallbackMock: AIProvider = {
      name: "gemini",
      generate: vi.fn().mockRejectedValue(new Error("Fallback dead")),
    };

    const router = createAIRouter({
      primary: primaryMock,
      fallback: fallbackMock,
      maxRetries: 0,
    });

    await expect(
      router.generate({
        systemPrompt: "sys",
        userMessage: "user",
        jsonMode: true,
      })
    ).rejects.toThrow("AI Generation failed. Primary: Primary dead. Fallback: Fallback dead");

    expect(primaryMock.generate).toHaveBeenCalledTimes(1);
    expect(fallbackMock.generate).toHaveBeenCalledTimes(1);
  });
});
