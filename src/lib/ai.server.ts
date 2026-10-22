// Server-only Lovable AI Gateway helpers (Google Gemini). Never import from client code.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
/** Central model config — change here to switch the stylist's model. */
export const AI_MODEL = "google/gemini-3.8-flash";

export class AiUnavailableError extends Error {}

export function isAiConfigured() {
  return Boolean(process.env["LOVABLE_API_KEY"]);
}

/** Streams a structured-output call and returns the schema-validated object. */
export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  instructions: string;
  messages: ModelMessage[];
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiUnavailableError("AI is not configured");
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    supportsStructuredOutputs: true,
  });
  const result = streamText({
    model: provider.chatModel(AI_MODEL),
    system: opts.instructions,
    messages: opts.messages,
    output: Output.object({ schema: opts.schema }),
    maxOutputTokens: 4000,
    maxRetries: 1,
  });
  try {
    const out = (await result.output) as T;
    if (out == null) throw new AiUnavailableError("AI returned an empty response");
    return out;
  } catch (error) {
    if (error instanceof AiUnavailableError) throw error;
    if (NoObjectGeneratedError.isInstance(error)) throw new AiUnavailableError("AI returned an invalid response");
    const status = (error as { statusCode?: number }).statusCode;
    console.error("AI gateway call failed", status ?? "");
    if (status === 402) throw new AiUnavailableError("AI credits are exhausted");
    if (status === 429) throw new AiUnavailableError("AI is busy, please try again shortly");
    throw new AiUnavailableError("AI request failed");
  }
}
