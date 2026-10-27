import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  personPath: z.string().min(3).max(10000000),
  garmentPath: z.string().min(3).max(10000000).nullable().optional(),
  resultPath: z.string().min(3).max(10000000).nullable().optional(),
  description: z.string().trim().max(1000),
  occasion: z.string().trim().max(100).nullable().optional(),
  extras: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  engine: z.enum(["catvton", "gemini", "auto"]).nullable().optional(),
  catvtonEndpoint: z.string().trim().max(1000).nullable().optional(),
});

export const generateTryOn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { runTryOn } = await import("./tryon.server");
    return runTryOn(supabase, userId, {
      personPath: data.personPath,
      garmentPath: data.garmentPath ?? null,
      resultPath: data.resultPath ?? null,
      description: data.description,
      occasion: data.occasion ?? null,
      extras: data.extras ?? null,
      parentId: data.parentId ?? null,
      category: data.category ?? null,
      engine: data.engine ?? "auto",
      catvtonEndpoint: data.catvtonEndpoint ?? null,
    });
  });

const testColabInput = z.object({
  endpoint: z.string().trim().min(3).max(1000),
});

export const testCatVTONEndpoint = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => testColabInput.parse(d))
  .handler(async ({ data }) => {
    const { pingCatVTONServer } = await import("./catvton.service");
    return pingCatVTONServer(data.endpoint);
  });

const twinInput = z.object({
  photoPath: z.string().min(3).max(10000000),
});

export const generateVirtualTwin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => twinInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { createVirtualTwin } = await import("./tryon.server");
    return createVirtualTwin(supabase, userId, data);
  });

const rotateInput = z.object({
  frontImage: z.string().min(3).max(10000000),
  description: z.string().trim().max(1000),
});

export const generateRotatedViews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rotateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { generateMultiAngleViews } = await import("./tryon.server");
    return generateMultiAngleViews(supabase, userId, data);
  });

export const getTryOnLooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { fetchUserLooks } = await import("./tryon.server");
    return fetchUserLooks(supabase, userId);
  });
