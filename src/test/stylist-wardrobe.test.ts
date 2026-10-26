import { describe, expect, it } from "vitest";
import { recommendOutfit, validateSlots, type EngineItem } from "@/features/recommendations/engine";
import { parseIntent } from "@/features/stylist/intents";
import { SAMPLE_WARDROBE } from "@/lib/sample-wardrobe";

describe("Stylist Wardrobe Strict Boundary", () => {
  const userWardrobe: EngineItem[] = SAMPLE_WARDROBE.map((s) => ({
    id: `item-${s.sample_key}`,
    name: s.name,
    category: s.category,
    main_color: s.main_color,
    secondary_colors: [],
    pattern: s.pattern,
    style: s.style,
    seasons: s.seasons,
  }));

  const wardrobeItemIds = new Set(userWardrobe.map((i) => i.id));

  it("accurately detects recommend intent from user query and matches clothes", () => {
    const intent = parseIntent(
      "trouble shoot ai stylish it works perfectly according to the need of the website it should recommend perfect cloths according to the need which should present from my wardrobe not from outside of the wardrobe",
    );
    expect(intent.intent).toBe("recommend");
  });

  it("never selects items outside of the user wardrobe in recommendation engine", () => {
    const occasions = [
      "college",
      "work",
      "evening",
      "party",
      "travel",
      "casual",
      "formal",
      "dinner",
      "date",
    ];

    for (const occ of occasions) {
      const result = recommendOutfit(userWardrobe, {
        occasion: occ,
        favoriteColors: [],
        avoidedColors: [],
        preferredStyles: [],
        feedback: { colorAffinity: {}, itemAffinity: {}, likedSignatures: [] },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const [slot, id] of Object.entries(result.outfit.slots)) {
          if (id) {
            expect(wardrobeItemIds.has(id)).toBe(true);
          }
        }
      }
    }
  });

  it("strictly validates and rejects external or invented item IDs", () => {
    const invalidPicks = {
      top: "external-gucci-tshirt",
      bottom: `item-${SAMPLE_WARDROBE.find((s) => s.category === "trousers")?.sample_key}`,
      shoes: `item-${SAMPLE_WARDROBE.find((s) => s.category === "shoes")?.sample_key}`,
    };

    const validated = validateSlots(userWardrobe, invalidPicks);
    expect(validated).toBeNull();
  });

  it("accepts valid picks made exclusively from user wardrobe", () => {
    const topItem = userWardrobe.find((s) => s.category === "top" || s.category === "shirt");
    const bottomItem = userWardrobe.find(
      (s) => s.category === "trousers" || s.category === "jeans",
    );
    const shoesItem = userWardrobe.find((s) => s.category === "shoes");

    const validPicks = {
      top: topItem!.id,
      bottom: bottomItem!.id,
      shoes: shoesItem!.id,
    };

    const validated = validateSlots(userWardrobe, validPicks);
    expect(validated).not.toBeNull();
    expect(validated?.top).toBe(topItem!.id);
    expect(validated?.bottom).toBe(bottomItem!.id);
    expect(validated?.shoes).toBe(shoesItem!.id);
  });
});
