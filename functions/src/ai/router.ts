import { AIProvider, AIGenerateRequest, AIGenerateResponse } from "./types";

export interface AIRouterConfig {
  primary: AIProvider;
  fallback: AIProvider | null;
}

export function createAIRouter(config: AIRouterConfig) {
  return {
    async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
      try {
        return await config.primary.generate(request);
      } catch (primaryError) {
        console.error(
          `[AI Router] Primary provider "${config.primary.name}" failed:`,
          primaryError
        );

        if (!config.fallback) {
          throw primaryError;
        }

        console.log(
          `[AI Router] Falling back to "${config.fallback.name}"...`
        );

        try {
          return await config.fallback.generate(request);
        } catch (fallbackError) {
          console.error(
            `[AI Router] Fallback provider "${config.fallback.name}" also failed:`,
            fallbackError
          );
          // Throw the original primary error for clarity
          throw primaryError;
        }
      }
    },
  };
}
