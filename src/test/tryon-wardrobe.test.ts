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

  it("retrieves generated looks for the user", async () => {
    const looks = await fetchUserLooks(mockDb, DEMO_USER_ID);
    expect(looks).toBeInstanceOf(Array);
    expect(looks.length).toBeGreaterThan(0);
    expect(looks[0].user_id).toBe(DEMO_USER_ID);
  });
});
