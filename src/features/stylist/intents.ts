// Rule-based intent parser used when generative AI is unavailable.
import type { Slot } from "@/lib/domain";

export type StylistIntent = "recommend" | "swap" | "reject" | "formal" | "weather" | "chat";

export interface ParsedIntent {
  intent: StylistIntent;
  occasion: string | null;
  slot: Slot | null;
}

const OCCASION_WORDS: [RegExp, string][] = [
  [/\b(college|class|campus|uni|university|school)\b/i, "college"],
  [/\b(work|office|meeting|interview)\b/i, "work"],
  [/\b(party|club|celebrat)/i, "party"],
  [/\b(dinner|date|evening|night out)\b/i, "evening"],
  [/\b(travel|flight|trip|airport)\b/i, "travel"],
  [/\b(casual|weekend|errand|chill)\b/i, "casual"],
];

const SLOT_WORDS: [RegExp, Slot][] = [
  [/\b(shoe|shoes|sneaker|sneakers|loafer|loafers|boot|boots|footwear)\b/i, "shoes"],
  [/\b(top|shirt|tee|t-shirt|sweater|knit|hoodie)\b/i, "top"],
  [/\b(pants|trousers|jeans|chinos|bottom|bottoms|shorts|skirt)\b/i, "bottom"],
  [/\b(jacket|coat|blazer|outerwear|layer)\b/i, "outerwear"],
  [/\b(accessor|watch|belt|bag|cap|hat|scarf)/i, "accessory"],
];

export function parseIntent(text: string): ParsedIntent {
  const occasion = OCCASION_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const slot = SLOT_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const swapLike = /\b(don'?t like|swap|change|replace|different|another|something else|instead)\b/i.test(text);
  if (swapLike && slot) return { intent: "swap", occasion, slot };
  if (/\b(hate|not for me|reject|no thanks|start over|new look|try again)\b/i.test(text) || (swapLike && !slot))
    return { intent: "reject", occasion, slot: null };
  if (/\b(rain|rainy|cold|chilly|hot|weather|snow|warm)\b/i.test(text)) return { intent: "weather", occasion, slot: null };
  if (/\b(formal|dressier|dressy|smarter|elegant|polished)\b/i.test(text)) return { intent: "formal", occasion, slot: null };
  if (occasion || /\b(wear|outfit|look|style me|what should)\b/i.test(text)) return { intent: "recommend", occasion, slot: null };
  return { intent: "chat", occasion: null, slot: null };
}
