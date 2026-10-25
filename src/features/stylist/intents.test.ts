import { describe, expect, it } from "vitest";
import { parseIntent } from "./intents";

describe("parseIntent", () => {
  it("detects an occasion recommendation", () => {
    expect(parseIntent("I'm heading to college today. What should I wear?")).toEqual({
      intent: "recommend",
      occasion: "college",
      slot: null,
    });
  });
  it("detects a shoe swap", () => {
    expect(parseIntent("I don't like those shoes. Suggest something else.")).toMatchObject({
      intent: "swap",
      slot: "shoes",
    });
  });
  it("detects a formal request", () => {
    expect(parseIntent("Give me a more formal look using my wardrobe.").intent).toBe("formal");
  });
  it("detects a weather request", () => {
    expect(parseIntent("Make this outfit suitable for rainy weather.").intent).toBe("weather");
  });
  it("detects outfit rejection", () => {
    expect(parseIntent("Not for me, try again").intent).toBe("reject");
  });
});
