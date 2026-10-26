import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  recommendOutfit,
  swapSlot,
  validateSlots,
  type EngineResult,
} from "@/features/recommendations/engine";
import { parseIntent, type StylistIntent } from "@/features/stylist/intents";
import {
  CATEGORIES,
  COLORS,
  PATTERNS,
  SEASONS,
  SLOTS,
  STYLES,
  type OutfitSlots,
  type Slot,
  type WeatherContext,
} from "@/lib/domain";
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
  { ok: true; outfitId: string } | { ok: false; missing: string[]; reason: string };

async function weatherFor(
  profile: { weather_enabled: boolean; weather_city: string | null } | null,
  use: boolean,
) {
  if (!use || !profile?.weather_enabled || !profile.weather_city) return null;
  return fetchWeather(profile.weather_city);
}

export const generateOutfit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        occasion: occasionSchema,
        mood: z.string().max(40).nullable().optional(),
        useWeather: z.boolean().optional(),
      })
      .parse(input),
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

async function swapInternal(
  supabase: Db,
  userId: string,
  outfitId: string,
  slot: Slot,
): Promise<GenerateResult> {
  const current = await loadOutfitSlots(supabase, outfitId);
  if (!current) return { ok: false, missing: [], reason: "That outfit no longer exists." };
  const loaded = await loadStylingContext(supabase, userId);
  const weather = (current.outfit.weather as WeatherContext | null) ?? null;
  const ctx = buildEngineContext(loaded, {
    occasion: current.outfit.occasion,
    mood: current.outfit.mood,
    weather,
  });
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
  .inputValidator((input: unknown) =>
    z.object({ outfitId: z.string().uuid(), slot: slotSchema }).parse(input),
  )
  .handler(({ data, context }) =>
    swapInternal(context.supabase, context.userId, data.outfitId, data.slot),
  );

export const recordFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        outfitId: z.string().uuid(),
        action: z.enum(["love", "dislike", "save", "unsave", "worn"]),
      })
      .parse(input),
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
    if (Object.keys(update).length)
      await supabase.from("outfits").update(update).eq("id", data.outfitId);
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
    const { data: existing } = await supabase
      .from("wardrobe_items")
      .select("sample_key")
      .eq("user_id", userId)
      .eq("is_sample", true);
    const have = new Set((existing ?? []).map((e) => e.sample_key));
    const rows = SAMPLE_WARDROBE.filter((s) => !have.has(s.sample_key)).map((s) => ({
      ...s,
      user_id: userId,
      is_sample: true,
    }));
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
  dominant_colors: z.array(z.object({ name: z.string(), hex: z.string() })),
  pattern: z.enum(PATTERNS),
  style: z.enum(STYLES),
  seasons: z.array(z.enum(SEASONS)),
  outfit_suggestions: z.array(
    z.object({ title: z.string(), pieces: z.array(z.string()), colour_reasoning: z.string() }),
  ),
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
      return {
        status: "error" as const,
        message: "Hourly AI limit reached. Fill in the details manually.",
      };
    const { data: owned } = await context.supabase
      .from("wardrobe_items")
      .select("name,category,main_color")
      .limit(60);
    const wardrobe =
      (owned ?? []).map((i) => `- ${i.name} (${i.category}, ${i.main_color ?? "?"})`).join("\n") ||
      "(empty)";
    try {
      const s = await generateStructured({
        schema: garmentSchema,
        instructions:
          "You label a single clothing item from a photo for a wardrobe app. Give a short descriptive name (max 5 words). main_color is the closest allowed colour; dominant_colors lists 1-3 visible colours with a friendly name and hex. Suggest 2-3 outfit ideas built around this piece: prefer pieces from the user's existing wardrobe (use their exact names), and fill gaps with generic pieces. Each idea gets a short title, 2-4 pieces, and a one-line colour_reasoning. If the photo is not clothing, set isGarment false and give best guesses.",
        messages: [
          {
            role: "user",
            content: [
              { type: "image", image: data.imageDataUrl },
              { type: "text", text: `My existing wardrobe:\n${wardrobe}\n\nAnalyse this item.` },
            ],
          },
        ],
      });
      return { status: "ok" as const, suggestion: s };
    } catch (e) {
      return {
        status: "error" as const,
        message: e instanceof AiUnavailableError ? e.message : "Analysis failed",
      };
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

const STYLIST_INSTRUCTIONS = `You are VÉSTARA's professional AI personal styling assistant (the VÉSTARA Style Assistant). You build bespoke, occasion-aware outfits and provide tailored styling advice.

ABSOLUTE STRICTEST CONSTITUTION & WARDROBE BOUNDARY:
1. EXCLUSIVE WARDROBE USAGE: You can ONLY and EXCLUSIVELY recommend, pick, and discuss garments, shoes, and accessories that are explicitly present in the user's WARDROBE inventory provided below.
2. ZERO EXTERNAL CLOTHES: NEVER recommend, invent, suggest, or name garments, shoes, accessories, or brands that are not present in the user's WARDROBE inventory. Do not suggest buying new pieces or imaginary clothes.
3. EXACT ITEM IDS: When suggesting or updating an outfit (intent = recommend | formal | weather | reject), you MUST fill 'picks' using the EXACT 'id' of the piece from the WARDROBE list below:
   - top: exact id of an owned top or shirt (REQUIRED)
   - bottom: exact id of owned trousers or jeans (REQUIRED)
   - shoes: exact id of owned shoes (REQUIRED)
   - outerwear: exact id of owned jacket/coat from wardrobe, or null if not needed
   - accessory: exact id of owned accessory from wardrobe, or null if not needed
   NEVER use fake, invented, or approximate IDs.
4. OCCASION & NEED MATCHING: Pick the harmonious combination from the user's wardrobe that best suits their stated need (e.g. college, work, dinner, party, casual, travel, formal, wedding, weather, etc.).
5. STYLING EXPLANATION: In 'reply', explicitly name the exact pieces chosen from their wardrobe, explain why their colors and styles harmonize, and give one practical styling tip (e.g. cuffing, tucking, or layering). No emojis.
6. IF WARDROBE IS EMPTY OR INSUFFICIENT: If the wardrobe has no items or lacks required pieces, politely explain that VÉSTARA crafts outfits exclusively from their personal wardrobe, specify which piece is missing, and invite them to add pieces or load the sample wardrobe.

DECIDE INTENT:
- recommend: the user wants an outfit for an occasion, event, weather, or general need (set occasion to: college|casual|work|evening|party|travel|formal|date|dinner or custom word).
- formal: user wants to dress up or make the look sharper.
- weather: user wants look adapted to temperature, rain, or climate.
- swap: user asks to change or replace one specific piece (set swapSlot to: top|bottom|shoes|outerwear|accessory).
- reject: user dislikes the whole look or wants a completely different combination.
- chat: general fashion questions (e.g. color theory). Even in chat, only suggest pairing items that the user actually owns in their wardrobe.`;

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
    .limit(8);
  const past = (history ?? []).reverse().slice(0, -1);

  const fullInstructions = `${STYLIST_INSTRUCTIONS}

--- USER'S CURRENT WARDROBE INVENTORY (ONLY USE ITEMS FROM THIS LIST) ---
${wardrobeSummary}

--- CURRENT CANVAS OUTFIT ---
${currentSummary}`;

  try {
    return await generateStructured({
      schema: stylistSchema,
      instructions: fullInstructions,
      messages: [
        ...past.map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        })),
        { role: "user", content: text },
      ],
    });
  } catch (err) {
    console.warn("[Stylist AI error]:", err);
    return null;
  }
}

export const getConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("conversations")
      .select("id,title,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const getConversationMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ conversationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: messages } = await context.supabase
      .from("messages")
      .select("id,role,content,outfit_id,mode,created_at")
      .eq("conversation_id", data.conversationId)
      .order("created_at", { ascending: true });
    return messages ?? [];
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ conversationId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (data.conversationId) {
      await context.supabase.from("messages").delete().eq("conversation_id", data.conversationId);
      await context.supabase.from("conversations").delete().eq("id", data.conversationId);
    } else {
      await context.supabase.from("messages").delete().eq("user_id", context.userId);
      await context.supabase.from("conversations").delete().eq("user_id", context.userId);
    }
    return { ok: true };
  });

export const getOutfits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        filter: z.enum(["all", "saved"]).optional(),
        limit: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("outfits")
      .select(
        "id,occasion,mood,explanation,score,source,status,piece_count,worn_at,created_at,outfit_items(slot,item:wardrobe_items(*))",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 24);
    if (data.filter === "saved") {
      q = q.eq("status", "saved");
    }
    const { data: rows } = await q;
    return rows ?? [];
  });

export const getOutfitById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ outfitId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: outfit } = await context.supabase
      .from("outfits")
      .select(
        "id,occasion,mood,explanation,score,source,status,piece_count,worn_at,created_at,outfit_items(slot,item:wardrobe_items(*))",
      )
      .eq("id", data.outfitId)
      .maybeSingle();
    return outfit ?? null;
  });

export const sendStylistMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        conversationId: z.string().uuid().nullable(),
        text: z.string().trim().min(1).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let conversationId = data.conversationId;

    try {
      if (!conversationId) {
        const { data: conv, error } = await supabase
          .from("conversations")
          .insert({ user_id: userId, title: data.text.slice(0, 60) })
          .select("id")
          .single();
        if (error || !conv) {
          conversationId = crypto.randomUUID();
        } else {
          conversationId = (conv as { id: string }).id;
        }
      }

      const { data: conv } = await supabase
        .from("conversations")
        .select("current_outfit_id")
        .eq("id", conversationId)
        .maybeSingle();

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: data.text,
      });

      const loaded = await loadStylingContext(supabase, userId);
      const current = (conv as { current_outfit_id?: string | null })?.current_outfit_id
        ? await loadOutfitSlots(supabase, (conv as { current_outfit_id: string }).current_outfit_id)
        : null;
      const byId = new Map(loaded.wardrobe.map((i) => [i.id, i]));

      // Check if wardrobe is completely empty
      if (!loaded.wardrobe.length) {
        const emptyMsg =
          "Your wardrobe is currently empty! VÉSTARA only ever recommends outfits built strictly from the clothes you already own. Please head to your Wardrobe to add your pieces, or load our curated sample wardrobe so I can style looks for you right away.";
        const assistantMsg = {
          id: crypto.randomUUID(),
          conversation_id: conversationId,
          user_id: userId,
          role: "assistant" as const,
          content: emptyMsg,
          outfit_id: null,
          mode: "rules" as const,
          created_at: new Date().toISOString(),
        };
        await supabase.from("messages").insert(assistantMsg);
        return { conversationId, mode: "rules" as const, message: assistantMsg };
      }

      const wardrobeSummary =
        loaded.wardrobe
          .map(
            (i) =>
              `${i.id} | ${i.name} | ${i.category} | ${i.main_color ?? "?"} | ${i.pattern ?? "?"} | ${i.style ?? "?"}`,
          )
          .join("\n") || "(empty)";
      const currentSummary = current
        ? (Object.entries(current.slots) as [Slot, string][])
            .map(([s, id]) => `${s}: ${byId.get(id)?.name ?? "removed"} (${id})`)
            .join("\n")
        : "(none)";

      const ai = await interpret(
        supabase,
        userId,
        conversationId,
        data.text,
        wardrobeSummary,
        currentSummary,
      );
      const mode = ai ? "ai" : "rules";
      const rule = parseIntent(data.text);

      // If rule detected an outfit need (recommend, swap, reject, formal, weather), prioritize it over generic chat
      let intent: StylistIntent = ai?.intent ?? rule.intent;
      if (intent === "chat" && rule.intent !== "chat") {
        intent = rule.intent;
      }

      const occasion =
        ai?.occasion?.toLowerCase() || rule.occasion || current?.outfit.occasion || "casual";
      const swapTarget = (ai?.swapSlot ?? rule.slot) as Slot | null;

      let outfitId: string | null = null;
      let content: string;

      if (intent === "chat") {
        // General advice: guide the user using only items in their wardrobe
        if (ai?.reply) {
          content = ai.reply;
        } else {
          // Smart fallback referencing their actual wardrobe pieces
          const sampleNames = loaded.wardrobe
            .slice(0, 4)
            .map((i) => i.name)
            .join(", ");
          content = `I build complete looks exclusively from your wardrobe (including your ${sampleNames}). Tell me where you are heading—like college, work, dinner, a party, or a casual weekend—and I will craft the ideal outfit for you.`;
        }
      } else if (intent === "swap") {
        if (!current)
          content =
            "There's no outfit on the canvas yet. Tell me where you're heading and I'll build one first from your wardrobe.";
        else if (!swapTarget)
          content = "Which piece should I change — the top, bottom, shoes, outerwear or accessory?";
        else {
          const r = await swapInternal(supabase, userId, current.outfit.id, swapTarget);
          if (r.ok) {
            outfitId = r.outfitId;
            const fresh = await loadOutfitSlots(supabase, r.outfitId);
            content =
              `Swapped the ${swapTarget} — every other piece stays from your wardrobe. ${fresh?.outfit.explanation ?? ""}`.trim();
          } else content = r.reason;
        }
      } else {
        if (intent === "reject" && current) {
          await supabase.from("outfits").update({ status: "rejected" }).eq("id", current.outfit.id);
          const ids = Object.values(current.slots).filter((v): v is string => Boolean(v));
          await supabase.from("feedback").insert({
            user_id: userId,
            outfit_id: current.outfit.id,
            action: "dislike",
            item_ids: ids,
            colors: await colorsFor(supabase, ids),
          });
        }
        const weather =
          intent === "weather" || loaded.profile?.weather_enabled
            ? await weatherFor(loaded.profile, true)
            : null;
        const mood = intent === "formal" ? "formal" : null;
        const exclude = intent === "reject" && current ? [] : undefined;
        const ctx = buildEngineContext(loaded, {
          occasion,
          mood,
          weather,
          excludeItemIds: exclude,
        });
        if (intent === "reject" && current)
          ctx.recentSignatures = [...(ctx.recentSignatures ?? []), current.outfit.signature];

        // Validate that AI picks strictly exist in the user's wardrobe and have required slots
        const aiSlots: OutfitSlots | null = ai
          ? validateSlots(loaded.wardrobe, cleanPicks(ai.picks))
          : null;
        const rejectedSame =
          aiSlots &&
          current &&
          intent === "reject" &&
          JSON.stringify(aiSlots) === JSON.stringify(current.slots);

        let result: EngineResult;
        let source: "ai" | "rules" = "rules";

        if (aiSlots && !rejectedSame) {
          const { scoreOutfit } = await import("@/features/recommendations/engine");
          const items = Object.values(aiSlots).map((id) => byId.get(id!)!);
          result = { ok: true, outfit: scoreOutfit(items, ctx), alternatives: 0 };
          source = "ai";
        } else {
          // Fall back to deterministic outfit engine which ALWAYS guarantees pieces strictly from wardrobe
          result = recommendOutfit(loaded.wardrobe, ctx);
        }

        if (!result.ok) {
          content = `${result.reason} VÉSTARA only recommends outfits built from the clothes you already own. Head to your wardrobe to add pieces, or load the sample wardrobe to explore.`;
        } else {
          // Always derive explanation strictly based on the items in the outfit
          const explanation =
            source === "ai" && ai?.reply ? ai.reply : describe(loaded.wardrobe, result.outfit, ctx);

          outfitId = await persistOutfit(supabase, userId, {
            outfit: result.outfit,
            occasion,
            mood,
            explanation,
            source,
            weather,
            parentOutfitId: current?.outfit.id ?? null,
          });

          const weatherNote =
            intent === "weather" && !weather
              ? " Live weather isn't set up, so I layered conservatively from your wardrobe."
              : "";
          content = explanation + weatherNote;
        }
      }

      const assistantMsg = {
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant" as const,
        content,
        outfit_id: outfitId,
        mode,
        created_at: new Date().toISOString(),
      };

      await supabase.from("messages").insert(assistantMsg);
      await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
          ...(outfitId ? { current_outfit_id: outfitId } : {}),
        })
        .eq("id", conversationId);

      return { conversationId, mode, message: assistantMsg };
    } catch (err) {
      console.error("[Stylist error caught]:", err);
      try {
        const loaded = await loadStylingContext(supabase, userId);
        const ctx = buildEngineContext(loaded, { occasion: "casual" });
        const result = recommendOutfit(loaded.wardrobe, ctx);
        const explanation = result.ok
          ? describe(loaded.wardrobe, result.outfit, ctx)
          : "I style exclusively using the pieces in your wardrobe. Let me know which occasion or event you're preparing for!";

        let fallbackOutfitId: string | null = null;
        if (result.ok) {
          try {
            fallbackOutfitId = await persistOutfit(supabase, userId, {
              outfit: result.outfit,
              occasion: "casual",
              explanation,
              source: "rules",
            });
          } catch {
            // ignore persistence error in failsafe
          }
        }

        const safeConvId = conversationId || crypto.randomUUID();
        const fallbackMsg = {
          id: crypto.randomUUID(),
          conversation_id: safeConvId,
          user_id: userId,
          role: "assistant" as const,
          content: explanation,
          outfit_id: fallbackOutfitId,
          mode: "rules" as const,
          created_at: new Date().toISOString(),
        };

        try {
          await supabase.from("messages").insert(fallbackMsg);
        } catch {
          // ignore
        }

        return { conversationId: safeConvId, mode: "rules" as const, message: fallbackMsg };
      } catch (innerErr) {
        console.error("[Stylist critical fallback error]:", innerErr);
        const safeConvId = conversationId || crypto.randomUUID();
        const ultimateMsg = {
          id: crypto.randomUUID(),
          conversation_id: safeConvId,
          user_id: userId,
          role: "assistant" as const,
          content:
            "I am ready to style tailored looks exclusively from your wardrobe. Tell me your occasion—such as college, work, dinner, party, or casual!",
          outfit_id: null,
          mode: "rules" as const,
          created_at: new Date().toISOString(),
        };
        return { conversationId: safeConvId, mode: "rules" as const, message: ultimateMsg };
      }
    }
  });

function cleanPicks(p: Record<string, string | null>): OutfitSlots {
  const out: OutfitSlots = {};
  for (const s of SLOTS) if (p[s]) out[s] = p[s]!;
  return out;
}
