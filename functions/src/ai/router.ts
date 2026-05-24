import { AIProvider, AIGenerateRequest, AIGenerateResponse } from "./types";

export interface AIRouterConfig {
  primary: AIProvider;
  fallback: AIProvider | null;
  maxRetries?: number; // Number of retries (default 1, meaning 2 total attempts)
}

export function createAIRouter(config: AIRouterConfig) {
  const maxRetries = config.maxRetries ?? 1;

  async function executeWithValidation(
    provider: AIProvider,
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    const response = await provider.generate(request);

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    if (request.jsonMode) {
      try {
        JSON.parse(response.text);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new Error(`AI returned invalid JSON: ${error.message}. Response was: "${response.text}"`, { cause: err });
      }
    }

    return response;
  }

  async function tryProvider(
    provider: AIProvider,
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AI Router] Retrying provider "${provider.name}" (attempt ${attempt + 1}/${maxRetries + 1})...`);
          // Wait briefly before retrying (e.g. 500ms)
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return await executeWithValidation(provider, request);
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        console.warn(
          `[AI Router] Provider "${provider.name}" failed on attempt ${attempt + 1}: ${error.message}`
        );
      }
    }
    if (lastError) {
      throw lastError;
    }
    throw new Error(`Provider "${provider.name}" failed without throwing lastError.`);
  }

  return {
    async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
      try {
        return await tryProvider(config.primary, request);
      } catch (primaryError: unknown) {
        const primaryErr = primaryError instanceof Error ? primaryError : new Error(String(primaryError));
        console.error(
          `[AI Router] Primary provider "${config.primary.name}" failed after all attempts:`,
          primaryErr
        );

        if (!config.fallback) {
          throw primaryErr;
        }

        console.log(
          `[AI Router] Falling back to "${config.fallback.name}"...`
        );

        try {
          return await tryProvider(config.fallback, request);
        } catch (fallbackError: unknown) {
          const fallbackErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
          console.error(
            `[AI Router] Fallback provider "${config.fallback.name}" also failed after all attempts:`,
            fallbackErr
          );
          throw new Error(`AI Generation failed. Primary: ${primaryErr.message}. Fallback: ${fallbackErr.message}`, { cause: fallbackError });
        }
      }
    },
  };
}

