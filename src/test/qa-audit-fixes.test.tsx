import { describe, expect, it } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { SidebarMenuSkeleton } from "@/components/ui/sidebar";
import { categoryToClothType, normalizeColabUrl } from "@/lib/catvton.service";
import { runTryOn, TryOnError } from "@/lib/tryon.server";
import { createMockSupabaseClient, DEMO_USER_ID } from "@/integrations/supabase/mock-client";

describe("QA Audit Fixes Verification", () => {
  it("SidebarMenuSkeleton renders with deterministic width to prevent SSR hydration mismatch", () => {
    // Render multiple instances to ensure stability
    const { container: first } = render(<SidebarMenuSkeleton data-testid="skeleton-1" />);
    const { container: second } = render(<SidebarMenuSkeleton data-testid="skeleton-2" />);

    const style1 = first
      .querySelector("[data-sidebar='menu-skeleton-text']")
      ?.getAttribute("style");
    const style2 = second
      .querySelector("[data-sidebar='menu-skeleton-text']")
      ?.getAttribute("style");

    expect(style1).toBe("--skeleton-width: 70%;");
    expect(style2).toBe("--skeleton-width: 70%;");
    expect(style1).toBe(style2);
  });

  it("categoryToClothType accurately maps all apparel classes", () => {
    expect(categoryToClothType("blazer")).toBe("upper");
    expect(categoryToClothType("trench coat")).toBe("upper");
    expect(categoryToClothType("trouser")).toBe("lower");
    expect(categoryToClothType("chino")).toBe("lower");
    expect(categoryToClothType("jumpsuit")).toBe("overall");
    expect(categoryToClothType("gown")).toBe("overall");
  });

  it("normalizeColabUrl safely parses edge cases and malformed user inputs", () => {
    expect(normalizeColabUrl("   https://test-node.gradio.live/   ")).toBe(
      "https://test-node.gradio.live",
    );
    expect(normalizeColabUrl("test-node.gradio.live")).toBe("https://test-node.gradio.live");
    expect(normalizeColabUrl(null)).toBe("");
    expect(normalizeColabUrl(undefined)).toBe("");
  });

  it("runTryOn validates required inputs and throws descriptive errors", async () => {
    const mockDb = createMockSupabaseClient(DEMO_USER_ID);

    // Missing person path
    await expect(
      runTryOn(mockDb, DEMO_USER_ID, {
        personPath: "",
        garmentPath: "sample.jpg",
        description: "Blazer",
        occasion: "casual",
        extras: null,
        parentId: null,
      }),
    ).rejects.toThrow(TryOnError);

    // Missing garment and description
    await expect(
      runTryOn(mockDb, DEMO_USER_ID, {
        personPath: "person.jpg",
        garmentPath: null,
        description: "",
        occasion: "casual",
        extras: null,
        parentId: null,
      }),
    ).rejects.toThrow(TryOnError);
  });
});
