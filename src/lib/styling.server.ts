// Server-only data access + orchestration for recommendations and feedback.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  buildFeedbackSignals,
  explainOutfit,
  type EngineContext,
  type EngineItem,
  type ScoredOutfit,
} from "@/features/recommendations/engine";
import type { OutfitSlots, Slot, WeatherContext } from "@/lib/domain";

export type Db = SupabaseClient<Database>;

export async function loadStylingContext(supabase: Db, userId: string) {
  const [items, profile, feedback, recent] = await Promise.all([
    supabase
      .from("wardrobe_items")
      .select("id,name,category,main_color,secondary_colors,pattern,style,seasons")
      .eq("user_id", userId),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("feedback")
      .select("action,item_ids,colors,outfit:outfits(signature)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("outfits")
      .select("signature")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  if (items.error) throw new Error("Could not load your wardrobe");
  const signals = buildFeedbackSignals(
    (feedback.data ?? []).map((r) => ({
      action: r.action,
      item_ids: r.item_ids,
      colors: r.colors,
      signature: (r.outfit as { signature: string } | null)?.signature ?? null,
    })),
  );
  return {
    wardrobe: (items.data ?? []) as EngineItem[],
    profile: profile.data,
    signals,
    recentSignatures: (recent.data ?? []).map((r) => r.signature),
  };
}

export function buildEngineContext(
  loaded: Awaited<ReturnType<typeof loadStylingContext>>,
  opts: { occasion: string; mood?: string | null; weather?: WeatherContext | null; excludeItemIds?: string[] },
): EngineContext {
  return {
    occasion: opts.occasion,
    mood: opts.mood ?? null,
    favoriteColors: loaded.profile?.favorite_colors ?? [],
    avoidedColors: loaded.profile?.avoided_colors ?? [],
    preferredStyles: loaded.profile?.preferred_styles ?? [],
    feedback: loaded.signals,
    weather: opts.weather ?? null,
    recentSignatures: loaded.recentSignatures,
    excludeItemIds: opts.excludeItemIds,
  };
}

export async function persistOutfit(
  supabase: Db,
  userId: string,
  input: {
    outfit: Pick<ScoredOutfit, "slots" | "score" | "signature">;
    occasion: string;
    mood?: string | null;
    explanation: string;
    source: "rules" | "ai";
    weather?: WeatherContext | null;
    parentOutfitId?: string | null;
  },
) {
  const slots = input.outfit.slots;
  const { data, error } = await supabase
    .from("outfits")
    .insert({
      user_id: userId,
      occasion: input.occasion,
      mood: input.mood ?? null,
      explanation: input.explanation,
      score: input.outfit.score,
      source: input.source,
      piece_count: Object.keys(slots).length,
      signature: input.outfit.signature,
      weather: (input.weather ?? null) as Database["public"]["Tables"]["outfits"]["Insert"]["weather"],
      parent_outfit_id: input.parentOutfitId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not save the recommendation");
  const rows = (Object.entries(slots) as [Slot, string][]).map(([slot, item_id]) => ({
    outfit_id: data.id,
    item_id,
    slot,
    user_id: userId,
  }));
  const ins = await supabase.from("outfit_items").insert(rows);
  if (ins.error) throw new Error("Could not save outfit pieces");
  return data.id;
}

export async function loadOutfitSlots(supabase: Db, outfitId: string) {
  const { data: outfit } = await supabase.from("outfits").select("*").eq("id", outfitId).maybeSingle();
  if (!outfit) return null;
  const { data: rows } = await supabase.from("outfit_items").select("slot,item_id").eq("outfit_id", outfitId);
  const slots: OutfitSlots = {};
  for (const r of rows ?? []) slots[r.slot as Slot] = r.item_id;
  return { outfit, slots };
}

export function describe(wardrobe: EngineItem[], outfit: ScoredOutfit, ctx: EngineContext) {
  const byId = new Map(wardrobe.map((i) => [i.id, i]));
  const items = Object.values(outfit.slots).map((id) => byId.get(id!)!).filter(Boolean);
  return explainOutfit(items, outfit, ctx);
}

export async function colorsFor(supabase: Db, itemIds: string[]) {
  if (!itemIds.length) return [];
  const { data } = await supabase.from("wardrobe_items").select("main_color").in("id", itemIds);
  return [...new Set((data ?? []).map((d) => d.main_color).filter((c): c is string => Boolean(c)))];
}

const WEATHER_CODES: Record<number, string> = {
  0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

/** Live weather from Open-Meteo (no API key). Returns null when unavailable. */
export async function fetchWeather(city: string): Promise<WeatherContext | null> {
  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`,
    ).then((r) => (r.ok ? r.json() : null));
    const place = geo?.results?.[0];
    if (!place) return null;
    const fc = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,precipitation,weather_code`,
    ).then((r) => (r.ok ? r.json() : null));
    const cur = fc?.current;
    if (!cur) return null;
    return {
      city: place.name,
      temperatureC: Number(cur.temperature_2m),
      precipitationMm: Number(cur.precipitation ?? 0),
      description: WEATHER_CODES[Number(cur.weather_code)] ?? "Current conditions",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** Simple per-user hourly cap for paid AI endpoints. */
export async function checkAiQuota(supabase: Db, userId: string, kind: string, limit = 40) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) return false;
  await supabase.from("ai_usage").insert({ user_id: userId, kind });
  return true;
}
