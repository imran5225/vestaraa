import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("App routing", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  const requiredRoutes = [
    { path: "/", name: "Home" },
    { path: "/wardrobe", name: "My Wardrobe" },
    { path: "/stylist", name: "AI Stylist" },
    { path: "/try-on", name: "Virtual Try-On" },
    { path: "/profile", name: "Profile" },
  ];

  requiredRoutes.forEach(({ path, name }) => {
    it(`matches the ${name} page for route "${path}"`, () => {
      const matches = router.matchRoutes(path);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    });
  });
});
