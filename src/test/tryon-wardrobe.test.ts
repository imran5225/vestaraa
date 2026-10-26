import { describe, expect, it } from "vitest";
import { runTryOn, fetchUserLooks } from "@/lib/tryon.server";
import { createMockSupabaseClient, DEMO_USER_ID } from "@/integrations/supabase/mock-client";

describe("Virtual Try-On Wardrobe Look Generation", () => {
  const mockDb = createMockSupabaseClient(DEMO_USER_ID);

  it("successfully generates a photo-based look with a selected wardrobe item", async () => {
    const res = await runTryOn(mockDb, DEMO_USER_ID, {
      personPath: `${DEMO_USER_ID}/tryon/model/studio-default.jpg`,
      garmentPath: `${DEMO_USER_ID}/tryon/garments/sample-camel-trench.jpg`,
      resultPath: `${DEMO_USER_ID}/tryon/results/test-result-123.jpg`,
      description: "Camel Trench Coat (outerwear, camel)",
      occasion: "casual",
      extras: "White sneakers, leather watch",
      parentId: null,
    });

    expect(res).toBeDefined();
    expect(res.id).toBeTruthy();
    expect(res.look).toBeDefined();
    expect(res.look.description).toBe("Camel Trench Coat (outerwear, camel)");
    expect(res.look.occasion).toBe("casual");
    expect(res.look.result_path).toContain("tryon/results");
    expect(res.look.styling).toBeDefined();
    expect(res.look.styling.outfit_name).toBeTruthy();
    expect(res.look.styling.footwear).toBeInstanceOf(Array);
    expect(res.look.styling.accessories).toBeInstanceOf(Array);
  });

  it("handles data URI garment images correctly during item switching", async () => {
    const fakeGarmentDataUri = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/";
    const res = await runTryOn(mockDb, DEMO_USER_ID, {
      personPath: `${DEMO_USER_ID}/tryon/model/studio-default.jpg`,
      garmentPath: fakeGarmentDataUri,
      resultPath: `${DEMO_USER_ID}/tryon/results/data-uri-test.jpg`,
      description: "Silk Midi Dress (dress, burgundy)",
      occasion: "evening",
      extras: "Strappy heels",
      parentId: null,
    });

    expect(res).toBeDefined();
    expect(res.look.description).toBe("Silk Midi Dress (dress, burgundy)");
    expect(res.look.occasion).toBe("evening");
  });

  it("supports switching repeatedly between different clothing pieces without stale state", async () => {
    const items = [
      { name: "Navy Tailored Blazer", color: "navy", cat: "outerwear" },
      { name: "Crisp Oxford Shirt", color: "white", cat: "top" },
      { name: "Indigo Selvedge Denim", color: "denim", cat: "bottom" },
    ];

    const results = [];
    for (const item of items) {
      const res = await runTryOn(mockDb, DEMO_USER_ID, {
        personPath: `${DEMO_USER_ID}/tryon/model/studio-default.jpg`,
        garmentPath: `${DEMO_USER_ID}/tryon/garments/${item.name.toLowerCase().replace(/\s+/g, "-")}.jpg`,
        description: `${item.name} (${item.cat}, ${item.color})`,
        occasion: "casual",
        extras: null,
        parentId: null,
      });
      results.push(res);
    }

    expect(results).toHaveLength(3);
    expect(results[0].look.description).toContain("Navy Tailored Blazer");
    expect(results[1].look.description).toContain("Crisp Oxford Shirt");
    expect(results[2].look.description).toContain("Indigo Selvedge Denim");
    expect(results[0].id).not.toBe(results[1].id);
    expect(results[1].id).not.toBe(results[2].id);
  });

  it("retrieves generated looks for the user", async () => {
    const looks = await fetchUserLooks(mockDb, DEMO_USER_ID);
    expect(looks).toBeInstanceOf(Array);
    expect(looks.length).toBeGreaterThan(0);
    expect(looks[0].user_id).toBe(DEMO_USER_ID);
  });
});
