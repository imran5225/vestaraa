import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  personPath: z.string().min(3).max(300),
  garmentPath: z.string().min(3).max(300).nullable(),
  description: z.string().trim().max(600),
  occasion: z.string().trim().max(40).nullable(),
  extras: z.string().trim().max(300).nullable(),
  parentId: z.string().uuid().nullable(),
});

export const generateTryOn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { runTryOn } = await import("./tryon.server");
    return runTryOn(supabase, userId, data);
  });
