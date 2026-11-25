export interface AIGenerateRequest {
  systemPrompt: string;
  userMessage: string;
  /** If true, expect JSON output */
  jsonMode: boolean;
  /** JSON Schema for strict structured output */
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
}

export interface AIGenerateResponse {
  text: string;
  provider: string;
}

export interface AIProvider {
  name: string;
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
}
