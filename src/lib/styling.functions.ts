import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recommendOutfit, swapSlot, validateSlots, type EngineResult } from "@/features/recommendations/engine";
import { parseIntent, type StylistIntent } from "@/features/stylist/intents";
import { CATEGORIES, COLORS, PATTERNS, SEASONS, SLOTS, STYLES, type OutfitSlots, type Slot, type WeatherContext } from "@/lib/domain";
import { SAMPLE_WARDROBE } from "@/lib/sample-wardrobe";
import {
  buildEngineContext,
  checkAiQuota,
  colorsFor,
  describe,
  fetchWeather,
  loadOutfitSlots,
  loadStylingContext,
  persistOutfit,
  type Db,
} from "@/lib/styling.server";
import { AiUnavailableError, generateStructured, isAiConfigured } from "@/lib/ai.server";

const occasionSchema = z.string().trim().min(1).max(40);
const slotSchema = z.enum(SLOTS);

type GenerateResult =
  | { ok: true; outfitId: string }
  | { ok: false; missing: string[]; reason: string };

async function weatherFor(profile: { weather_enabled: boolean; weather_city: string | null } | null, use: boolean) {
  if (!use || !profile?.weather_enabled || !profile.weather_city) return null;
  return fetchWeather(profile.weather_city);
}

export const generateOutfit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ occasion: occasionSchema, mood: z.string().max(40).nullable().optional(), useWeather: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<GenerateResult> => {
    const loaded = await loadStylingContext(context.supabase, context.userId);
    const weather = await weatherFor(loaded.profile, data.useWeather ?? true);
    const ctx = buildEngineContext(loaded, { occasion: data.occasion, mood: data.mood, weather });
    const result = recommendOutfit(loaded.wardrobe, ctx);
    if (!result.ok) return { ok: false, missing: result.missing, reason: result.reason };
    const outfitId = await persistOutfit(context.supabase, context.userId, {
      outfit: result.outfit,
      occasion: data.occasion,
      mood: data.mood,
      explanation: describe(loaded.wardrobe, result.outfit, ctx),
      source: "rules",
      weather,
    });
    return { ok: true, outfitId };
  });

async function swapInternal(supabase: Db, userId: string, outfitId: string, slot: Slot): Promise<GenerateResult> {
  const current = await loadOutfitSlots(supabase, outfitId);
  if (!current) return { ok: false, missing: [], reason: "That outfit no longer exists." };
  const loaded = await loadStylingContext(supabase, userId);
  const weather = (current.outfit.weather as WeatherContext | null) ?? null;
  const ctx = buildEngineContext(loaded, { occasion: current.outfit.occasion, mood: current.outfit.mood, weather });
  const result = swapSlot(loaded.wardrobe, current.slots, slot, ctx);
  if (!result.ok) return { ok: false, missing: result.missing, reason: result.reason };
  const oldItem = current.slots[slot];
  await supabase.from("feedback").insert({
    user_id: userId,
    outfit_id: outfitId,
    action: "swap",
    slot,
    item_ids: oldItem ? [oldItem] : [],
    colors: await colorsFor(supabase, oldItem ? [oldItem] : []),
  });
  const newId = await persistOutfit(supabase, userId, {
    outfit: result.outfit,
    occasion: current.outfit.occasion,
    mood: current.outfit.mood,
    explanation: describe(loaded.wardrobe, result.outfit, ctx),
    source: "rules",
    weather,
    parentOutfitId: outfitId,
  });
  return { ok: true, outfitId: newId };
}

export const swapOutfitItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ outfitId: z.string().uuid(), slot: slotSchema }).parse(input))
  .handler(({ data, context }) => swapInternal(context.supabase, context.userId, data.outfitId, data.slot));

export const recordFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ outfitId: z.string().uuid(), action: z.enum(["love", "dislike", "save", "unsave", "worn"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const current = await loadOutfitSlots(supabase, data.outfitId);
    if (!current) throw new Error("That outfit no longer exists.");
    const itemIds = Object.values(current.slots).filter((v): v is string => Boolean(v));
    const update: { status?: string; worn_at?: string } = {};
    if (data.action === "save" || data.action === "love") update.status = "saved";
    if (data.action === "unsave") update.status = "suggested";
    if (data.action === "dislike") update.status = "rejected";
    if (data.action === "worn") update.worn_at = new Date().toISOString();
    if (Object.keys(update).length) await supabase.from("outfits").update(update).eq("id", data.outfitId);
    if (data.action !== "unsave") {
      const { error } = await supabase.from("feedback").insert({
        user_id: userId,
        outfit_id: data.outfitId,
        action: data.action,
        item_ids: itemIds,
        colors: await colorsFor(supabase, itemIds),
      });
      if (error) throw new Error("Could not record feedback");
    }
    return { ok: true };
  });

export const getWeather = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("weather_enabled,weather_city")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile?.weather_enabled || !profile.weather_city) return { status: "disabled" as const };
    const weather = await fetchWeather(profile.weather_city);
    return weather ? { status: "ok" as const, weather } : { status: "unavailable" as const };
  });

export const loadSampleWardrobe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase.from("wardrobe_items").select("sample_key").eq("user_id", userId).eq("is_sample", true);
    const have = new Set((existing ?? []).map((e) => e.sample_key));
    const rows = SAMPLE_WARDROBE.filter((s) => !have.has(s.sample_key)).map((s) => ({ ...s, user_id: userId, is_sample: true }));
    if (rows.length) {
      const { error } = await supabase.from("wardrobe_items").insert(rows);
      if (error) throw new Error("Could not add the sample wardrobe");
    }
    return { added: rows.length };
  });

export const resetDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("conversations").delete().eq("user_id", userId);
    await supabase.from("feedback").delete().eq("user_id", userId);
    await supabase.from("outfits").delete().eq("user_id", userId);
    await supabase.from("wardrobe_items").delete().eq("user_id", userId).eq("is_sample", true);
    return { ok: true };
  });

// ---------- Garment image analysis ----------

const garmentSchema = z.object({
  isGarment: z.boolean(),
  name: z.string(),
  category: z.enum(CATEGORIES.map((c) => c.value) as [string, ...string[]]),
  main_color: z.enum(COLORS),
  pattern: z.enum(PATTERNS),
  style: z.enum(STYLES),
  seasons: z.array(z.enum(SEASONS)),
});
export type GarmentSuggestion = z.infer<typeof garmentSchema>;

export const analyzeGarment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ imageDataUrl: z.string().startsWith("data:image/").max(7_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!isAiConfigured()) return { status: "unconfigured" as const };
    if (!(await checkAiQuota(context.supabase, context.userId, "vision")))
      return { status: "error" as const, message: "Hourly AI limit reached. Fill in the details manually." };
    try {
      const s = await generateStructured({
        schema: garmentSchema,
        instructions:
          "You label a single clothing item from a photo for a wardrobe app. Give a short descriptive name (max 5 words). If the photo is not a clothing item, set isGarment false and fill other fields with best guesses.",
        messages: [
          { role: "user", content: [{ type: "image", image: data.imageDataUrl }, { type: "text", text: "Label this item." }] },
        ],
      });
      return { status: "ok" as const, suggestion: s };
    } catch (e) {
      return { status: "error" as const, message: e instanceof AiUnavailableError ? e.message : "Analysis failed" };
    }
  });

// ---------- Conversational stylist ----------

const stylistSchema = z.object({
  intent: z.enum(["recommend", "swap", "reject", "formal", "weather", "chat"]),
  occasion: z.string().nullable(),
  swapSlot: z.enum(SLOTS).nullable(),
  picks: z.object({
    top: z.string().nullable(),
    bottom: z.string().nullable(),
    shoes: z.string().nullable(),
    outerwear: z.string().nullable(),
    accessory: z.string().nullable(),
  }),
  reply: z.string(),
});

const STYLIST_INSTRUCTIONS = `You are VÉSTARA, a calm, editorial personal stylist. You ONLY style from the user's wardrobe listed in the context (each item has an id).
Decide the user's intent:
- recommend: they want an outfit (set occasion: college|casual|work|evening|party|travel or a short custom word).
- formal: they want a dressier version.
- weather: they want the look adapted to weather.
- swap: they dislike one piece; set swapSlot (top|bottom|shoes|outerwear|accessory). Leave picks null.
- reject: they dislike the whole look.
- chat: general styling question, no outfit needed.
For recommend/formal/weather/reject, fill picks with wardrobe item ids (top, bottom, shoes required; outerwear/accessory optional, null if not used). Never invent ids.
Write reply in 1-3 short sentences, warm and specific, naming the pieces. No emojis.`;

async function interpret(
  supabase: Db,
  userId: string,
  conversationId: string,
  text: string,
  wardrobeSummary: string,
  currentSummary: string,
) {
  if (!isAiConfigured()) return null;
  if (!(await checkAiQuota(supabase, userId, "stylist"))) return null;
  const { data: history } = await supabase
    .from("messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);
  const past = (history ?? []).reverse().slice(0, -1);
  try {
    return await generateStructured({
      schema: stylistSchema,
      instructions: STYLIST_INSTRUCTIONS,
      messages: [
        { role: "user", content: `WARDROBE:\n${wardrobeSummary}\n\nCURRENT OUTFIT:\n${currentSummary}` },
        ...past.map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content })),
        { role: "user", content: text },
      ],
    });
  } catch {
    return null;
  }
}

export const sendStylistMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid().nullable(), text: z.string().trim().min(1).max(1000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let conversationId = data.conversationId;
    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title: data.text.slice(0, 60) })
        .select("id")
        .single();
      if (error || !conv) throw new Error("Could not start a conversation");
      conversationId = conv.id;
    }
    const { data: conv } = await supabase.from("conversations").select("current_outfit_id").eq("id", conversationId).single();
    await supabase.from("messages").insert({ conversation_id: conversationId, user_id: userId, role: "user", content: data.text });

    const loaded = await loadStylingContext(supabase, userId);
    const current = conv?.current_outfit_id ? await loadOutfitSlots(supabase, conv.current_outfit_id) : null;
    const byId = new Map(loaded.wardrobe.map((i) => [i.id, i]));
    const wardrobeSummary =
      loaded.wardrobe
        .map((i) => `${i.id} | ${i.name} | ${i.category} | ${i.main_color ?? "?"} | ${i.pattern ?? "?"} | ${i.style ?? "?"}`)
        .join("\n") || "(empty)";
    const currentSummary = current
      ? (Object.entries(current.slots) as [Slot, string][]).map(([s, id]) => `${s}: ${byId.get(id)?.name ?? "removed"} (${id})`).join("\n")
      : "(none)";

    const ai = await interpret(supabase, userId, conversationId, data.text, wardrobeSummary, currentSummary);
    const mode = ai ? "ai" : "rules";
    const rule = parseIntent(data.text);
    const intent: StylistIntent = ai?.intent ?? rule.intent;
    const occasion = ai?.occasion?.toLowerCase() || rule.occasion || current?.outfit.occasion || "casual";
    const swapTarget = (ai?.swapSlot ?? rule.slot) as Slot | null;

    let outfitId: string | null = null;
    let content: string;

    if (intent === "chat") {
      content = ai?.reply ?? "I can build a look from your wardrobe, swap a piece, or make it dressier. Try “What should I wear to college today?”";
    } else if (intent === "swap") {
      if (!current) content = "There's no outfit on the table yet. Tell me where you're heading and I'll build one first.";
      else if (!swapTarget) content = "Which piece should I change — the top, bottom, shoes, outerwear or accessory?";
      else {
        const r = await swapInternal(supabase, userId, current.outfit.id, swapTarget);
        if (r.ok) {
          outfitId = r.outfitId;
          const fresh = await loadOutfitSlots(supabase, r.outfitId);
          content = `Swapped the ${swapTarget} — everything else stays. ${fresh?.outfit.explanation ?? ""}`.trim();
        } else content = r.reason;
      }
    } else {
      if (intent === "reject" && current) {
        await supabase.from("outfits").update({ status: "rejected" }).eq("id", current.outfit.id);
        const ids = Object.values(current.slots).filter((v): v is string => Boolean(v));
        await supabase.from("feedback").insert({
          user_id: userId, outfit_id: current.outfit.id, action: "dislike", item_ids: ids, colors: await colorsFor(supabase, ids),
        });
      }
      const weather = intent === "weather" || loaded.profile?.weather_enabled ? await weatherFor(loaded.profile, true) : null;
      const mood = intent === "formal" ? "formal" : null;
      const exclude = intent === "reject" && current ? [] : undefined;
      const ctx = buildEngineContext(loaded, { occasion, mood, weather, excludeItemIds: exclude });
      if (intent === "reject" && current) ctx.recentSignatures = [...(ctx.recentSignatures ?? []), current.outfit.signature];

      const aiSlots: OutfitSlots | null = ai ? validateSlots(loaded.wardrobe, cleanPicks(ai.picks)) : null;
      const rejectedSame = aiSlots && current && intent === "reject" && JSON.stringify(aiSlots) === JSON.stringify(current.slots);
      let result: EngineResult;
      let source: "ai" | "rules" = "rules";
      if (aiSlots && !rejectedSame) {
        const { scoreOutfit } = await import("@/features/recommendations/engine");
        const items = Object.values(aiSlots).map((id) => byId.get(id!)!);
        result = { ok: true, outfit: scoreOutfit(items, ctx), alternatives: 0 };
        source = "ai";
      } else {
        result = recommendOutfit(loaded.wardrobe, ctx);
      }
      if (!result.ok) {
        content = `${result.reason} Head to your wardrobe to add pieces, or load the sample wardrobe to explore.`;
      } else {
        const explanation = source === "ai" && ai ? ai.reply : describe(loaded.wardrobe, result.outfit, ctx);
        outfitId = await persistOutfit(supabase, userId, {
          outfit: result.outfit, occasion, mood, explanation, source, weather,
          parentOutfitId: current?.outfit.id ?? null,
        });
        const weatherNote = intent === "weather" && !weather ? " Live weather isn't set up, so I layered conservatively — enable it in your profile for live conditions." : "";
        content = explanation + weatherNote;
      }
    }

    await supabase.from("messages").insert({ conversation_id: conversationId, user_id: userId, role: "assistant", content, outfit_id: outfitId, mode });
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), ...(outfitId ? { current_outfit_id: outfitId } : {}) })
      .eq("id", conversationId);
    return { conversationId, mode };
  });

function cleanPicks(p: Record<string, string | null>): OutfitSlots {
  const out: OutfitSlots = {};
  for (const s of SLOTS) if (p[s]) out[s] = p[s]!;
  return out;
}
