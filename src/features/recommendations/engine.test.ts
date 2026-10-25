import { describe, expect, it } from "vitest";
import {
  buildFeedbackSignals,
  colorPairScore,
  missingSlots,
  recommendOutfit,
  swapSlot,
  validateSlots,
  type EngineContext,
  type EngineItem,
} from "./engine";

const item = (
  id: string,
  category: EngineItem["category"],
  color: string,
  style = "casual",
  pattern = "solid",
): EngineItem => ({
  id,
  name: id,
  category,
  main_color: color,
  secondary_colors: [],
  pattern,
  style,
  seasons: [],
});

const wardrobe: EngineItem[] = [
  item("tee", "top", "white"),
  item("oxford", "shirt", "light blue", "smart-casual"),
  item("chinos", "trousers", "beige", "smart-casual"),
  item("jeans", "jeans", "denim"),
  item("sneakers", "shoes", "white"),
  item("loafers", "shoes", "brown", "smart-casual"),
  item("blazer", "outerwear", "navy", "smart-casual"),
];

const ctx = (over: Partial<EngineContext> = {}): EngineContext => ({
  occasion: "casual",
  favoriteColors: [],
  avoidedColors: [],
  preferredStyles: [],
  feedback: { colorAffinity: {}, itemAffinity: {}, likedSignatures: [] },
  ...over,
});

const ids = new Set(wardrobe.map((i) => i.id));

describe("recommendOutfit", () => {
  it("only returns items that exist in the wardrobe and includes top, bottom and shoes", () => {
    const r = recommendOutfit(wardrobe, ctx());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const id of Object.values(r.outfit.slots)) expect(ids.has(id!)).toBe(true);
    expect(r.outfit.slots.top && r.outfit.slots.bottom && r.outfit.slots.shoes).toBeTruthy();
  });

  it("reports missing required categories instead of inventing items", () => {
    const r = recommendOutfit(
      wardrobe.filter((i) => i.category !== "shoes"),
      ctx(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["shoes"]);
  });

  it("prefers smart-casual pieces for work", () => {
    const r = recommendOutfit(wardrobe, ctx({ occasion: "work" }));
    if (!r.ok) throw new Error("expected outfit");
    expect(r.outfit.slots.top).toBe("oxford");
    expect(r.outfit.slots.shoes).toBe("loafers");
  });

  it("avoids repeating a recently shown combination when alternatives exist", () => {
    const first = recommendOutfit(wardrobe, ctx());
    if (!first.ok) throw new Error();
    const second = recommendOutfit(wardrobe, ctx({ recentSignatures: [first.outfit.signature] }));
    if (!second.ok) throw new Error();
    expect(second.outfit.signature).not.toBe(first.outfit.signature);
  });

  it("rejected items rank lower after negative feedback", () => {
    const base = recommendOutfit(wardrobe, ctx());
    if (!base.ok) throw new Error();
    const shoes = base.outfit.slots.shoes!;
    const fb = buildFeedbackSignals(
      [1, 2, 3].map(() => ({ action: "dislike", item_ids: [shoes], colors: [] })),
    );
    const after = recommendOutfit(wardrobe, ctx({ feedback: fb }));
    if (!after.ok) throw new Error();
    expect(after.outfit.slots.shoes).not.toBe(shoes);
  });
});

describe("swapSlot", () => {
  it("changes only the requested slot", () => {
    const current = { top: "tee", bottom: "jeans", shoes: "sneakers" };
    const r = swapSlot(wardrobe, current, "shoes", ctx());
    if (!r.ok) throw new Error();
    expect(r.outfit.slots.top).toBe("tee");
    expect(r.outfit.slots.bottom).toBe("jeans");
    expect(r.outfit.slots.shoes).toBe("loafers");
  });

  it("fails clearly when there is nothing to swap in", () => {
    const r = swapSlot(
      wardrobe,
      { top: "tee", bottom: "jeans", shoes: "sneakers", outerwear: "blazer" },
      "outerwear",
      ctx(),
    );
    expect(r.ok).toBe(false);
  });
});

describe("validateSlots", () => {
  it("rejects ids that are not in the wardrobe", () => {
    expect(
      validateSlots(wardrobe, { top: "ghost", bottom: "jeans", shoes: "sneakers" }),
    ).toBeNull();
  });
  it("rejects items placed in the wrong slot", () => {
    expect(
      validateSlots(wardrobe, { top: "jeans", bottom: "chinos", shoes: "sneakers" }),
    ).toBeNull();
  });
  it("accepts a valid composition", () => {
    expect(
      validateSlots(wardrobe, { top: "tee", bottom: "jeans", shoes: "sneakers" }),
    ).not.toBeNull();
  });
});

describe("missingSlots", () => {
  it("lists required slots that have no items", () => {
    expect(missingSlots([item("tee", "top", "white")])).toEqual(["bottom", "shoes"]);
  });
});

describe("colorPairScore", () => {
  it("treats neutral pairs as most harmonious", () => {
    expect(colorPairScore("white", "navy")).toBe(1);
    expect(colorPairScore("red", "green")).toBeLessThan(0.5);
  });
});
