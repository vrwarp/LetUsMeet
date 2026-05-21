export interface AIGenerateRequest {
  systemPrompt: string;
  userMessage: string;
  /** If true, expect JSON output */
  jsonMode: boolean;
  /** JSON Schema for strict structured output (used by Cerebras) */
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
}

export interface AIGenerateResponse {
  text: string;
  provider: 'gemini' | 'cerebras';
}

export interface AIProvider {
  name: 'gemini' | 'cerebras';
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
}
