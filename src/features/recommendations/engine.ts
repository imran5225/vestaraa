/**
 * Deterministic outfit engine. Pure functions only — no I/O — so the same
 * logic runs in server functions and unit tests.
 *
 * Every score component is normalised to 0..1 and combined with SCORING_WEIGHTS.
 * Missing attributes score a neutral 0.6 so incomplete items are still usable.
 */
import {
  CATEGORY_SLOT,
  REQUIRED_SLOTS,
  type OutfitSlots,
  type Slot,
  type WardrobeItem,
  type WeatherContext,
} from "@/lib/domain";

export const SCORING_WEIGHTS = {
  occasion: 0.24,
  colorHarmony: 0.2,
  styleConsistency: 0.14,
  preferences: 0.14,
  feedback: 0.18,
  weather: 0.1,
} as const;

export type ScoringWeights = Record<keyof typeof SCORING_WEIGHTS, number>;

export type EngineItem = Pick<
  WardrobeItem,
  "id" | "name" | "category" | "main_color" | "secondary_colors" | "pattern" | "style" | "seasons"
>;

export interface FeedbackSignals {
  /** Positive = liked, negative = rejected. Values are soft and clamped. */
  colorAffinity: Record<string, number>;
  itemAffinity: Record<string, number>;
  likedSignatures: string[];
}

export interface EngineContext {
  occasion: string;
  mood?: string | null | undefined;
  favoriteColors: string[];
  avoidedColors: string[];
  preferredStyles: string[];
  feedback: FeedbackSignals;
  weather?: WeatherContext | null | undefined;
  recentSignatures?: string[] | undefined;
  excludeItemIds?: string[] | undefined;
  weights?: ScoringWeights | undefined;
}

export interface ScoredOutfit {
  slots: OutfitSlots;
  score: number;
  breakdown: Record<keyof typeof SCORING_WEIGHTS, number>;
  signature: string;
}

export type EngineResult =
  | { ok: true; outfit: ScoredOutfit; alternatives: number }
  | { ok: false; missing: Slot[]; reason: string };

const NEUTRALS = new Set(["white", "black", "grey", "navy", "beige", "cream", "camel", "brown", "denim"]);

// Pairs that read as harmonious beyond neutrals (unordered).
const HARMONIOUS = new Set([
  "blue|brown", "light blue|navy", "light blue|beige", "olive|cream", "olive|white", "burgundy|grey",
  "burgundy|navy", "pink|grey", "pink|navy", "green|beige", "blue|beige", "blue|white", "red|navy",
]);

// Which styles suit each occasion, best first.
export const OCCASION_STYLES: Record<string, string[]> = {
  college: ["casual", "streetwear", "smart-casual", "athleisure"],
  casual: ["casual", "streetwear", "athleisure", "smart-casual"],
  work: ["smart-casual", "formal"],
  evening: ["smart-casual", "formal", "party"],
  party: ["party", "streetwear", "smart-casual"],
  travel: ["casual", "athleisure", "smart-casual"],
};

const MOOD_STYLE: Record<string, string> = {
  formal: "formal",
  relaxed: "casual",
  bold: "party",
  sporty: "athleisure",
  polished: "smart-casual",
  edgy: "streetwear",
};

const STYLE_ORDER = ["athleisure", "casual", "streetwear", "smart-casual", "party", "formal"];

export function slotOf(item: Pick<EngineItem, "category">): Slot {
  return CATEGORY_SLOT[item.category];
}

export function outfitSignature(slots: OutfitSlots): string {
  return (Object.keys(slots) as Slot[])
    .sort()
    .map((s) => `${s}:${slots[s]}`)
    .join("|");
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

export function colorPairScore(a: string | null, b: string | null): number {
  if (!a || !b) return 0.6;
  if (a === b) return NEUTRALS.has(a) ? 0.85 : 0.55;
  const an = NEUTRALS.has(a);
  const bn = NEUTRALS.has(b);
  if (an && bn) return 1;
  if (an || bn) return 0.9;
  return HARMONIOUS.has([a, b].sort().join("|")) ? 0.8 : 0.35;
}

export function colorHarmony(items: EngineItem[]): number {
  if (items.length < 2) return 0.6;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      total += colorPairScore(items[i]!.main_color, items[j]!.main_color);
      pairs++;
    }
  }
  // More than one bold pattern competes for attention.
  const patterned = items.filter((i) => i.pattern && i.pattern !== "solid" && i.pattern !== "textured").length;
  const patternPenalty = patterned > 1 ? 0.2 * (patterned - 1) : 0;
  return clamp01(total / pairs - patternPenalty);
}

export function occasionFit(item: EngineItem, occasion: string, mood?: string | null): number {
  if (!item.style) return 0.6;
  const wanted = [...(OCCASION_STYLES[occasion] ?? OCCASION_STYLES["casual"] ?? [])];
  const moodStyle = mood ? MOOD_STYLE[mood.toLowerCase()] : undefined;
  if (moodStyle) wanted.unshift(moodStyle);
  const idx = wanted.indexOf(item.style);
  if (idx === -1) return 0.15;
  return 1 - idx * 0.15;
}

export function styleConsistency(items: EngineItem[]): number {
  const ranks = items.map((i) => (i.style ? STYLE_ORDER.indexOf(i.style) : -1)).filter((r) => r >= 0);
  if (ranks.length < 2) return 0.6;
  const spread = Math.max(...ranks) - Math.min(...ranks);
  return clamp01(1 - spread * 0.15);
}

function preferenceScore(items: EngineItem[], ctx: EngineContext): number {
  let score = 0.6;
  for (const item of items) {
    const colors = [item.main_color, ...item.secondary_colors].filter(Boolean) as string[];
    if (colors.some((c) => ctx.favoriteColors.includes(c))) score += 0.1;
    if (colors.some((c) => ctx.avoidedColors.includes(c))) score -= 0.25;
    if (item.style && ctx.preferredStyles.includes(item.style)) score += 0.08;
  }
  return clamp01(score);
}

function feedbackScore(items: EngineItem[], signature: string, fb: FeedbackSignals): number {
  let score = 0.5;
  for (const item of items) {
    score += 0.15 * (fb.itemAffinity[item.id] ?? 0);
    if (item.main_color) score += 0.05 * (fb.colorAffinity[item.main_color] ?? 0);
  }
  if (fb.likedSignatures.includes(signature)) score += 0.25;
  return clamp01(score);
}

const WARM_SEASONS = ["spring", "summer"];
const COLD_SEASONS = ["autumn", "winter"];

export function weatherScore(items: EngineItem[], weather?: WeatherContext | null): number {
  if (!weather) return 0.6;
  const cold = weather.temperatureC < 14;
  const hot = weather.temperatureC > 26;
  const wet = weather.precipitationMm > 0.5;
  let score = 0.7;
  const hasOuter = items.some((i) => i.category === "outerwear");
  if ((cold || wet) && hasOuter) score += 0.25;
  if ((cold || wet) && !hasOuter) score -= 0.3;
  if (hot && hasOuter) score -= 0.35;
  for (const i of items) {
    if (!i.seasons.length) continue;
    if (cold && i.seasons.some((s) => COLD_SEASONS.includes(s))) score += 0.04;
    if (hot && i.seasons.some((s) => WARM_SEASONS.includes(s))) score += 0.04;
    if (cold && i.seasons.every((s) => s === "summer")) score -= 0.1;
  }
  return clamp01(score);
}

export function scoreOutfit(items: EngineItem[], ctx: EngineContext): ScoredOutfit {
  const weights = ctx.weights ?? SCORING_WEIGHTS;
  const slots: OutfitSlots = {};
  for (const i of items) slots[slotOf(i)] = i.id;
  const signature = outfitSignature(slots);
  const breakdown = {
    occasion: items.reduce((s, i) => s + occasionFit(i, ctx.occasion, ctx.mood), 0) / items.length,
    colorHarmony: colorHarmony(items),
    styleConsistency: styleConsistency(items),
    preferences: preferenceScore(items, ctx),
    feedback: feedbackScore(items, signature, ctx.feedback),
    weather: weatherScore(items, ctx.weather),
  };
  const score = (Object.keys(weights) as (keyof ScoringWeights)[]).reduce(
    (s, k) => s + weights[k] * breakdown[k],
    0,
  );
  return { slots, score: Math.round(score * 1000) / 1000, breakdown, signature };
}

function groupBySlot(items: EngineItem[], exclude: Set<string>) {
  const groups: Record<Slot, EngineItem[]> = { top: [], bottom: [], shoes: [], outerwear: [], accessory: [] };
  for (const item of items) {
    if (exclude.has(item.id)) continue;
    groups[slotOf(item)].push(item);
  }
  return groups;
}

/** Keep only the strongest candidates per slot to bound combinatorics. */
function shortlist(items: EngineItem[], ctx: EngineContext, limit = 12) {
  return [...items]
    .sort((a, b) => occasionFit(b, ctx.occasion, ctx.mood) - occasionFit(a, ctx.occasion, ctx.mood))
    .slice(0, limit);
}

/** Try adding each optional piece; keep it only when it raises the score. */
function withOptionalPieces(base: EngineItem[], groups: Record<Slot, EngineItem[]>, ctx: EngineContext, locked: Partial<Record<Slot, EngineItem>>) {
  let best = base;
  let bestScore = scoreOutfit(base, ctx).score;
  for (const slot of ["outerwear", "accessory"] as const) {
    if (locked[slot]) {
      best = [...best, locked[slot]!];
      bestScore = scoreOutfit(best, ctx).score;
      continue;
    }
    let pick: EngineItem | null = null;
    for (const cand of groups[slot]) {
      const s = scoreOutfit([...best, cand], ctx).score;
      if (s > bestScore + 0.005) {
        bestScore = s;
        pick = cand;
      }
    }
    if (pick) best = [...best, pick];
  }
  return best;
}

export function missingSlots(items: EngineItem[], exclude: string[] = []): Slot[] {
  const groups = groupBySlot(items, new Set(exclude));
  return REQUIRED_SLOTS.filter((s) => groups[s].length === 0);
}

/**
 * Rank all valid top+bottom+shoes combinations, enrich with optional pieces,
 * and prefer combinations not shown recently.
 */
export function recommendOutfit(
  wardrobe: EngineItem[],
  ctx: EngineContext,
  locked: Partial<Record<Slot, string>> = {},
): EngineResult {
  const exclude = new Set(ctx.excludeItemIds ?? []);
  const byId = new Map(wardrobe.map((i) => [i.id, i]));
  const lockedItems: Partial<Record<Slot, EngineItem>> = {};
  for (const [slot, id] of Object.entries(locked) as [Slot, string][]) {
    const item = byId.get(id);
    if (item && slotOf(item) === slot) lockedItems[slot] = item;
  }
  const groups = groupBySlot(wardrobe, exclude);
  const missing = REQUIRED_SLOTS.filter((s) => !lockedItems[s] && groups[s].length === 0);
  if (missing.length) {
    return { ok: false, missing, reason: `Add at least one ${missing.join(", ")} item to build a complete outfit.` };
  }
  const pool = (slot: Slot) => (lockedItems[slot] ? [lockedItems[slot]!] : shortlist(groups[slot], ctx));
  const ranked: ScoredOutfit[] = [];
  for (const top of pool("top"))
    for (const bottom of pool("bottom"))
      for (const shoes of pool("shoes")) {
        const full = withOptionalPieces([top, bottom, shoes], groups, ctx, lockedItems);
        ranked.push(scoreOutfit(full, ctx));
      }
  ranked.sort((a, b) => b.score - a.score);
  const recent = new Set(ctx.recentSignatures ?? []);
  const fresh = ranked.find((o) => !recent.has(o.signature));
  const chosen = fresh ?? ranked[0];
  if (!chosen) return { ok: false, missing: [], reason: "No valid outfit could be composed." };
  return { ok: true, outfit: chosen, alternatives: ranked.length - 1 };
}

/** Replace one slot, keeping every other piece. Revalidates the result. */
export function swapSlot(
  wardrobe: EngineItem[],
  current: OutfitSlots,
  slot: Slot,
  ctx: EngineContext,
): EngineResult {
  const currentId = current[slot];
  const byId = new Map(wardrobe.map((i) => [i.id, i]));
  const kept = (Object.entries(current) as [Slot, string][])
    .filter(([s, id]) => s !== slot && byId.has(id))
    .map(([, id]) => byId.get(id)!);
  const exclude = new Set([...(ctx.excludeItemIds ?? []), ...(currentId ? [currentId] : [])]);
  const candidates = wardrobe.filter((i) => slotOf(i) === slot && !exclude.has(i.id));
  if (!candidates.length) {
    return { ok: false, missing: [slot], reason: `There is no other ${slot} in your wardrobe to swap in.` };
  }
  const options = candidates
    .map((c) => scoreOutfit([...kept, c], ctx))
    .sort((a, b) => b.score - a.score);
  const result = options[0];
  if (!result) return { ok: false, missing: [slot], reason: "No swap candidate fits." };
  const invalid = REQUIRED_SLOTS.filter((s) => !result.slots[s]);
  if (invalid.length) {
    return { ok: false, missing: invalid, reason: "The revised outfit is missing required pieces." };
  }
  return { ok: true, outfit: result, alternatives: options.length - 1 };
}

/** Validate externally proposed slots (e.g. from an AI model) against the wardrobe. */
export function validateSlots(wardrobe: EngineItem[], slots: OutfitSlots): OutfitSlots | null {
  const byId = new Map(wardrobe.map((i) => [i.id, i]));
  const clean: OutfitSlots = {};
  for (const [slot, id] of Object.entries(slots) as [Slot, string | undefined][]) {
    if (!id) continue;
    const item = byId.get(id);
    if (!item || slotOf(item) !== slot) return null;
    clean[slot] = id;
  }
  return REQUIRED_SLOTS.every((s) => clean[s]) ? clean : null;
}

/** Turn raw feedback rows into soft ranking signals. */
export function buildFeedbackSignals(
  rows: { action: string; item_ids: string[]; colors: string[]; signature?: string | null }[],
): FeedbackSignals {
  const colorAffinity: Record<string, number> = {};
  const itemAffinity: Record<string, number> = {};
  const likedSignatures: string[] = [];
  const delta: Record<string, number> = { love: 1, save: 0.6, worn: 0.8, dislike: -1, swap: -0.7 };
  for (const row of rows) {
    const d = delta[row.action] ?? 0;
    for (const id of row.item_ids) itemAffinity[id] = Math.max(-3, Math.min(3, (itemAffinity[id] ?? 0) + d));
    for (const c of row.colors) colorAffinity[c] = Math.max(-3, Math.min(3, (colorAffinity[c] ?? 0) + d * 0.5));
    if ((row.action === "love" || row.action === "save") && row.signature) likedSignatures.push(row.signature);
  }
  return { colorAffinity, itemAffinity, likedSignatures };
}

/** Short, factual explanation derived from the score breakdown. */
export function explainOutfit(items: EngineItem[], outfit: ScoredOutfit, ctx: EngineContext): string {
  const names = items.map((i) => i.name.toLowerCase());
  const parts = [`For ${ctx.occasion}, pair your ${names.slice(0, 3).join(", ")}${names.length > 3 ? ` with the ${names.slice(3).join(" and ")}` : ""}.`];
  if (outfit.breakdown.colorHarmony >= 0.85) parts.push("The palette stays calm and balanced.");
  else if (outfit.breakdown.colorHarmony < 0.5) parts.push("It's a bolder colour mix than usual.");
  if (outfit.breakdown.styleConsistency >= 0.8) parts.push("Every piece sits in the same style register.");
  if (ctx.weather) {
    const outer = items.some((i) => i.category === "outerwear");
    if (ctx.weather.precipitationMm > 0.5 || ctx.weather.temperatureC < 14)
      parts.push(outer ? `A layer is included for ${Math.round(ctx.weather.temperatureC)}°C ${ctx.weather.description.toLowerCase()}.` : "Consider adding a layer for today's weather.");
  }
  return parts.join(" ");
}
