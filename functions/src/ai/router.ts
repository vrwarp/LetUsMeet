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
      } catch (err: any) {
        throw new Error(`AI returned invalid JSON: ${err.message}. Response was: "${response.text}"`);
      }
    }

    return response;
  }

  async function tryProvider(
    provider: AIProvider,
    request: AIGenerateRequest
  ): Promise<AIGenerateResponse> {
    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`[AI Router] Retrying provider "${provider.name}" (attempt ${attempt + 1}/${maxRetries + 1})...`);
          // Wait briefly before retrying (e.g. 500ms)
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return await executeWithValidation(provider, request);
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[AI Router] Provider "${provider.name}" failed on attempt ${attempt + 1}: ${err.message}`
        );
      }
    }
    throw lastError;
  }

  return {
    async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
      try {
        return await tryProvider(config.primary, request);
      } catch (primaryError: any) {
        console.error(
          `[AI Router] Primary provider "${config.primary.name}" failed after all attempts:`,
          primaryError
        );

        if (!config.fallback) {
          throw primaryError;
        }

        console.log(
          `[AI Router] Falling back to "${config.fallback.name}"...`
        );

        try {
          return await tryProvider(config.fallback, request);
        } catch (fallbackError: any) {
          console.error(
            `[AI Router] Fallback provider "${config.fallback.name}" also failed after all attempts:`,
            fallbackError
          );
          throw new Error(`AI Generation failed. Primary: ${primaryError.message}. Fallback: ${fallbackError.message}`);
        }
      }
    },
  };
}

