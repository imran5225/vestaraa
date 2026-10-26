import { describe, expect, it } from "vitest";
import {
  createMockSupabaseClient,
  DEMO_USER_ID,
  globalMockStore,
} from "@/integrations/supabase/mock-client";
import { loadStylingContext } from "@/lib/styling.server";
import { recommendOutfit, type EngineItem } from "@/features/recommendations/engine";
import { SAMPLE_WARDROBE } from "@/lib/sample-wardrobe";

describe("Stylist Chat & DB Chaining Tests", () => {
  it("supports .insert().select().single() pattern correctly in mock database", async () => {
    const mock = createMockSupabaseClient();
    const testTitle = "College outfit consultation " + Date.now();
    const { data, error } = await mock
      .from("conversations")
      .insert({ user_id: DEMO_USER_ID, title: testTitle })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect((data as { id: string }).id).toBeTypeOf("string");

    // Verify it actually persisted in mock store
    const inStore = globalMockStore.conversations.find(
      (c) => c["id"] === (data as { id: string }).id,
    );
    expect(inStore).toBeDefined();
    expect(inStore?.["title"]).toBe(testTitle);
  });

  it("supports .insert().select().single() for outfits table", async () => {
    const mock = createMockSupabaseClient();
    const { data, error } = await mock
      .from("outfits")
      .insert({
        user_id: DEMO_USER_ID,
        occasion: "college",
        explanation: "Crisp shirt with tailored trousers and clean white sneakers.",
        score: 95,
        source: "rules",
        piece_count: 3,
        signature: "outfit-test-" + Date.now(),
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    const outfitId = (data as { id: string }).id;
    expect(outfitId).toBeTypeOf("string");

    // Add outfit items
    await mock.from("outfit_items").insert([
      { outfit_id: outfitId, item_id: "sample-oxford-shirt", slot: "top", user_id: DEMO_USER_ID },
      { outfit_id: outfitId, item_id: "sample-navy-chinos", slot: "bottom", user_id: DEMO_USER_ID },
      {
        outfit_id: outfitId,
        item_id: "sample-leather-sneakers",
        slot: "shoes",
        user_id: DEMO_USER_ID,
      },
    ]);

    // Query outfits with joined outfit_items
    const { data: outfitQueryData } = await mock
      .from("outfits")
      .select("id,occasion,outfit_items(slot,item:wardrobe_items(*))")
      .eq("id", outfitId)
      .maybeSingle();

    expect(outfitQueryData).toBeDefined();
    const queryOutfit = outfitQueryData as { outfit_items?: unknown[] };
    expect(Array.isArray(queryOutfit.outfit_items)).toBe(true);
    expect(queryOutfit.outfit_items?.length).toBe(3);
  });

  it("auto-seeds sample wardrobe in loadStylingContext if user has no clothes yet", async () => {
    const testUserId = "user-empty-" + Date.now();
    const mock = createMockSupabaseClient(testUserId);

    const loaded = await loadStylingContext(mock, testUserId);
    expect(loaded.wardrobe.length).toBeGreaterThanOrEqual(SAMPLE_WARDROBE.length);

    // Verify all items belong to this user
    for (const item of loaded.wardrobe) {
      expect(item.id).toContain(testUserId);
    }
  });

  it("generates complete outfits strictly from the user wardrobe", () => {
    const userWardrobe: EngineItem[] = SAMPLE_WARDROBE.map((s) => ({
      id: `wardrobe-${s.sample_key}`,
      name: s.name,
      category: s.category,
      main_color: s.main_color,
      secondary_colors: [],
      pattern: s.pattern,
      style: s.style,
      seasons: s.seasons,
    }));

    const allowedIds = new Set(userWardrobe.map((i) => i.id));

    const result = recommendOutfit(userWardrobe, {
      occasion: "college",
      favoriteColors: ["navy", "white"],
      avoidedColors: [],
      preferredStyles: ["casual"],
      feedback: { colorAffinity: {}, itemAffinity: {}, likedSignatures: [] },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.outfit.slots.top).toBeDefined();
      expect(allowedIds.has(result.outfit.slots.top!)).toBe(true);
      expect(result.outfit.slots.bottom).toBeDefined();
      expect(allowedIds.has(result.outfit.slots.bottom!)).toBe(true);
      expect(result.outfit.slots.shoes).toBeDefined();
      expect(allowedIds.has(result.outfit.slots.shoes!)).toBe(true);
    }
  });
});
