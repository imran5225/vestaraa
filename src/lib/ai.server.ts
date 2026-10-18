// Server-only Lovable AI Gateway helpers. Never import from client code.
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiUnavailableError extends Error {}

export function isAiConfigured() {
  return Boolean(process.env["LOVABLE_API_KEY"]);
}

/** Streams a structured-output call and returns the parsed object. */
export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  instructions: string;
  messages: ModelMessage[];
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiUnavailableError("AI is not configured");
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: opts.instructions,
    messages: opts.messages,
    output: Output.object({ schema: opts.schema }),
    providerOptions: {
      openai: { store: false, forceReasoning: true, reasoningEffort: "low", include: ["reasoning.encrypted_content"] },
    },
  });
  try {
    return (await result.output) as T;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) throw new AiUnavailableError("AI returned an invalid response");
    const status = (error as { statusCode?: number }).statusCode;
    console.error("AI gateway call failed", status ?? "");
    if (status === 402) throw new AiUnavailableError("AI credits are exhausted");
    if (status === 429) throw new AiUnavailableError("AI is busy, please try again shortly");
    throw new AiUnavailableError("AI request failed");
  }
}
