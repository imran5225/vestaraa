// Server-only Google Gemini API integration. Never import from client code.
import { GoogleGenAI, type Content, type Part } from "@google/genai";
import type { z } from "zod";

/** Central model config — defaults to gemini-3.8-flash, configurable via GEMINI_MODEL */
export const AI_MODEL = process.env["GEMINI_MODEL"] || "gemini-3.8-flash";

export class AiUnavailableError extends Error {}

export function isAiConfigured(): boolean {
  const key = process.env["GEMINI_API_KEY"];
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  if (
    !trimmed ||
    trimmed === "your_api_key_here" ||
    trimmed.includes("your-api-key") ||
    trimmed.startsWith("mock-") ||
    trimmed === "undefined" ||
    trimmed === "null" ||
    trimmed.length < 15
  ) {
    return false;
  }
  return true;
}

export type MessagePart =
  { type: "text"; text: string } | { type: "image"; image: string; mediaType?: string };

export type ModelMessage = {
  role: "user" | "assistant" | "system";
  content: string | MessagePart[];
};

/**
 * Executes a structured JSON Gemini call and returns the Zod-validated result.
 */
export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  instructions: string;
  messages: ModelMessage[];
}): Promise<T> {
  if (!isAiConfigured()) {
    throw new AiUnavailableError("AI is not configured. Please set GEMINI_API_KEY.");
  }
  const apiKey = process.env["GEMINI_API_KEY"]!;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // Convert input messages into Google GenAI Content format
  const contents: Content[] = [];

  for (const m of opts.messages) {
    const role = m.role === "assistant" ? "model" : "user";
    const parts: Part[] = [];

    if (typeof m.content === "string") {
      parts.push({ text: m.content });
    } else if (Array.isArray(m.content)) {
      for (const item of m.content) {
        if (item.type === "text") {
          parts.push({ text: item.text });
        } else if (item.type === "image") {
          let mimeType = item.mediaType || "image/jpeg";
          let base64 = item.image;

          // If data URI like data:image/png;base64,... extract payload
          if (base64.startsWith("data:")) {
            const match = base64.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              base64 = match[2];
            }
          }

          parts.push({
            inlineData: {
              mimeType,
              data: base64,
            },
          });
        }
      }
    }

    if (parts.length > 0) {
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts.push(...parts);
      } else {
        contents.push({ role, parts });
      }
    }
  }

  // Model cascade: try configured model first, then fast light model, then latest alias
  const modelsToTry = [AI_MODEL, "gemini-3.1-flash-lite", "gemini-flash-latest"];
  const uniqueModels = [...new Set(modelsToTry)];

  let lastError: unknown = null;

  for (const model of uniqueModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: opts.instructions,
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const text = response.text;
      if (!text) {
        throw new AiUnavailableError("Gemini returned an empty response");
      }

      let cleaned = text.trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      } else {
        cleaned = cleaned
          .replace(/^```json\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
      }

      const parsed = JSON.parse(cleaned);
      return opts.schema.parse(parsed);
    } catch (err: unknown) {
      lastError = err;
      const errStr = String(err);
      if (err instanceof Error && err.name === "ZodError") {
        throw new AiUnavailableError("AI returned an invalid schema response");
      }
      if (errStr.includes("API key not valid") || errStr.includes("API_KEY_INVALID")) {
        console.warn(
          "[Gemini] API key invalid or unconfigured. Falling back to deterministic rules engine.",
        );
        break;
      }
    }
  }

  const errText = String(lastError ?? "");
  if (!errText.includes("API key not valid") && !errText.includes("API_KEY_INVALID")) {
    console.warn(
      "[Gemini] API notice:",
      lastError instanceof Error ? lastError.message : String(lastError),
    );
  }

  throw new AiUnavailableError(
    "AI service temporarily unavailable. Falling back to deterministic rules engine.",
  );
}
