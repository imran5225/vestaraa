import { describe, expect, it } from "vitest";
import {
  validateTryOnPhoto,
  getDefaultBodyProportions,
  MAX_PHOTO_BYTES,
} from "@/lib/pose-analyzer";
import { runTryOn, createVirtualTwin, generateMultiAngleViews } from "@/lib/tryon.server";
import { createMockSupabaseClient, DEMO_USER_ID } from "@/integrations/supabase/mock-client";

describe("Virtual Try-On Photo Upload Validation", () => {
  it("accepts valid JPG, PNG, and WebP files under 10MB", () => {
    const validJpg = { type: "image/jpeg", size: 3 * 1024 * 1024, name: "portrait.jpg" };
    const validPng = { type: "image/png", size: 5 * 1024 * 1024, name: "fullbody.png" };
    const validWebp = { type: "image/webp", size: 2 * 1024 * 1024, name: "model.webp" };

    expect(validateTryOnPhoto(validJpg).valid).toBe(true);
    expect(validateTryOnPhoto(validPng).valid).toBe(true);
    expect(validateTryOnPhoto(validWebp).valid).toBe(true);
  });

  it("rejects files that exceed the 10MB maximum limit", () => {
    const oversizedFile = {
      type: "image/jpeg",
      size: MAX_PHOTO_BYTES + 1024,
      name: "huge_raw_photo.jpg",
    };
    const res = validateTryOnPhoto(oversizedFile);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("10MB");
  });

  it("rejects unsupported file formats like GIF, PDF, or TXT", () => {
    const gifFile = { type: "image/gif", size: 1024 * 100, name: "animation.gif" };
    const pdfFile = { type: "application/pdf", size: 1024 * 500, name: "document.pdf" };
    const textFile = { type: "text/plain", size: 1024, name: "notes.txt" };

    expect(validateTryOnPhoto(gifFile).valid).toBe(false);
    expect(validateTryOnPhoto(gifFile).error).toContain("Unsupported file type");

    expect(validateTryOnPhoto(pdfFile).valid).toBe(false);
    expect(validateTryOnPhoto(textFile).valid).toBe(false);
  });
});

describe("Virtual Me Twin & Rotate Views Generation", () => {
  const mockDb = createMockSupabaseClient(DEMO_USER_ID);
  const tinyJpeg =
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

  it("generates Virtual Me twin fallback from uploaded photo", async () => {
    const res = await createVirtualTwin(mockDb, DEMO_USER_ID, {
      photoPath: tinyJpeg,
    });
    expect(res).toBeDefined();
    expect(res.twinImageUri).toBeTruthy();
  });

  it("generates 4 views for 360-degree rotation view", async () => {
    const res = await generateMultiAngleViews(mockDb, DEMO_USER_ID, {
      frontImage: tinyJpeg,
      description: "Charcoal Blazer and Indigo Jeans",
    });

    expect(res).toBeDefined();
    expect(res.views).toBeDefined();
    expect(res.views.front).toBe(tinyJpeg);
    expect(res.views.left).toBeTruthy();
    expect(res.views.back).toBeTruthy();
    expect(res.views.right).toBeTruthy();
  });
});

describe("Virtual Try-On Body Proportions & Fallback Logic", () => {
  const mockDb = createMockSupabaseClient(DEMO_USER_ID);

  it("returns default balanced proportions when no custom photo is provided", () => {
    const defaults = getDefaultBodyProportions();
    expect(defaults.heightScale).toBe(1.0);
    expect(defaults.shoulderWidth).toBe(1.0);
    expect(defaults.torsoScale).toBe(1.0);
    expect(defaults.legScale).toBe(1.0);
    expect(defaults.skinTone).toBe("#E8D5C4");
    expect(defaults.hairColor).toBe("#2B2520");
    expect(defaults.isCropped).toBe(false);
    expect(defaults.qualityChecklist.fullBodyVisible).toBe(true);
  });

  it("throws a descriptive error when required try-on arguments are missing", async () => {
    // Missing person photo
    await expect(
      runTryOn(mockDb, DEMO_USER_ID, {
        personPath: "",
        garmentPath: "sample.jpg",
        description: "Test dress",
        occasion: "casual",
        extras: null,
        parentId: null,
      }),
    ).rejects.toThrow("Please upload or provide a photo of yourself.");

    // Missing garment and description
    await expect(
      runTryOn(mockDb, DEMO_USER_ID, {
        personPath: "sample-model.jpg",
        garmentPath: null,
        description: "",
        occasion: "casual",
        extras: null,
        parentId: null,
      }),
    ).rejects.toThrow("Please select a clothing item from your wardrobe or describe the outfit.");
  });

  it("handles base64 data URIs gracefully in runTryOn", async () => {
    const tinyJpegDataUri =
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

    const result = await runTryOn(mockDb, DEMO_USER_ID, {
      personPath: tinyJpegDataUri,
      garmentPath: null,
      description: "Navy Blue Blazer and Cream Chinos",
      occasion: "work",
      extras: null,
      parentId: null,
    });

    expect(result).toBeDefined();
    expect(result.id).toBeTruthy();
    expect(result.look.description).toBe("Navy Blue Blazer and Cream Chinos");
    expect(result.look.styling).toBeDefined();
    expect(result.look.styling.footwear).toBeInstanceOf(Array);
  });
});
