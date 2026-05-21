import Cerebras from "@cerebras/cerebras_cloud_sdk";
import { AIProvider, AIGenerateRequest, AIGenerateResponse } from "./types";

export function createCerebrasProvider(apiKey: string, model: string): AIProvider {
  const client = new Cerebras({
    apiKey,
    warmTCPConnection: false, // Cloud Functions are short-lived; skip warming
  });

  return {
    name: "cerebras",
    async generate(req: AIGenerateRequest): Promise<AIGenerateResponse> {
      const messages = [
        { role: "system" as const, content: req.systemPrompt },
        { role: "user" as const, content: req.userMessage },
      ];

      // Use strict JSON schema when a schema is provided, otherwise fall back to json_object
      const responseFormat = req.jsonSchema
        ? {
            type: "json_schema" as const,
            json_schema: {
              name: req.jsonSchema.name,
              strict: true,
              schema: req.jsonSchema.schema,
            },
          }
        : req.jsonMode
          ? { type: "json_object" as const }
          : undefined;

      const completion = (await client.chat.completions.create({
        model,
        messages,
        ...(responseFormat && { response_format: responseFormat }),
        max_completion_tokens: 2048,
        temperature: 0.2,
        top_p: 1,
      })) as any;

      const text = completion.choices[0]?.message?.content || "";

      return {
        text: text.replace(/```json/g, "").replace(/```/g, "").trim(),
        provider: "cerebras",
      };
    },
  };
}
