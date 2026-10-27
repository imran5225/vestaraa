import { describe, expect, it, vi } from "vitest";
import { categoryToClothType, normalizeColabUrl, pingCatVTONServer } from "@/lib/catvton.service";
import { runTryOn } from "@/lib/tryon.server";
import { createMockSupabaseClient, DEMO_USER_ID } from "@/integrations/supabase/mock-client";

describe("CatVTON Service & Classification", () => {
  it("maps top garments to 'upper'", () => {
    expect(categoryToClothType("top")).toBe("upper");
    expect(categoryToClothType("shirt")).toBe("upper");
    expect(categoryToClothType("blazer")).toBe("upper");
    expect(categoryToClothType("jacket")).toBe("upper");
    expect(categoryToClothType("outerwear")).toBe("upper");
  });

  it("maps bottoms and trousers to 'lower'", () => {
    expect(categoryToClothType("bottom")).toBe("lower");
    expect(categoryToClothType("trousers")).toBe("lower");
    expect(categoryToClothType("jeans")).toBe("lower");
    expect(categoryToClothType("chinos")).toBe("lower");
    expect(categoryToClothType("skirt")).toBe("lower");
  });

  it("maps dresses and jumpsuits to 'overall'", () => {
    expect(categoryToClothType("dress")).toBe("overall");
    expect(categoryToClothType("one-piece")).toBe("overall");
    expect(categoryToClothType("jumpsuit")).toBe("overall");
    expect(categoryToClothType("apparel", "Silk Evening Dress")).toBe("overall");
  });

  it("normalizes trailing slashes, whitespace, and schemes on Colab URLs", () => {
    expect(normalizeColabUrl("https://abc-123.gradio.live/")).toBe("https://abc-123.gradio.live");
    expect(normalizeColabUrl("  https://abc-123.gradio.live/// ")).toBe(
      "https://abc-123.gradio.live",
    );
    expect(normalizeColabUrl("60c223aedd0a452b02.gradio.live")).toBe(
      "https://60c223aedd0a452b02.gradio.live",
    );
    expect(normalizeColabUrl("https://60c223aedd0a452b02.gradio.live/")).toBe(
      "https://60c223aedd0a452b02.gradio.live",
    );
    expect(normalizeColabUrl("")).toBe("");
  });

  it("pings CatVTON server and validates FastAPI health response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/health")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "ok",
            model: "CatVTON (Official zhengchong/CatVTON)",
            gpu_name: "Tesla T4",
          }),
        };
      }
      return { ok: true, status: 200 };
    });

    const res = await pingCatVTONServer("https://60c223aedd0a452b02.gradio.live");
    expect(res.ok).toBe(true);
    expect(res.message).toContain("CatVTON Colab GPU server connected");
    expect(res.message).toContain("Tesla T4");

    globalThis.fetch = originalFetch;
  });

  it("handles offline Gradio tunnel errors gracefully", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 502,
      };
    });

    const res = await pingCatVTONServer("https://60c223aedd0a452b02.gradio.live");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("offline");

    globalThis.fetch = originalFetch;
  });

  it("executes runTryOn with CatVTON parameters in test environment seamlessly", async () => {
    const mockDb = createMockSupabaseClient(DEMO_USER_ID);
    const res = await runTryOn(mockDb, DEMO_USER_ID, {
      personPath: `${DEMO_USER_ID}/tryon/model/studio-default.jpg`,
      garmentPath: `${DEMO_USER_ID}/tryon/garments/sample-camel-trench.jpg`,
      resultPath: `${DEMO_USER_ID}/tryon/results/catvton-test.jpg`,
      description: "Camel Trench Coat",
      occasion: "casual",
      extras: null,
      parentId: null,
      category: "outerwear",
      engine: "catvton",
      catvtonEndpoint: "https://60c223aedd0a452b02.gradio.live",
    });

    expect(res).toBeDefined();
    expect(res.id).toBeTruthy();
    expect(res.look).toBeDefined();
    expect(res.look.description).toBe("Camel Trench Coat");
    expect(res.look.styling).toBeDefined();
  });
});
