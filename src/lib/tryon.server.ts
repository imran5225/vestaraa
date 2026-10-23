// Server-only virtual try-on: image editing via Lovable AI Gateway + Gemini styling notes.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AiUnavailableError, generateStructured } from "./ai.server";
import { checkAiQuota } from "./styling.server";

type Db = SupabaseClient<Database>;
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export class TryOnError extends Error {}

const stylingSchema = z.object({
  outfit_name: z.string(),
  styling_reason: z.string(),
  footwear: z.array(z.string()),
  accessories: z.array(z.string()),
  alternatives: z.array(z.string()),
  styling_tips: z.array(z.string()),
});
export type TryOnStyling = z.infer<typeof stylingSchema>;

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function download(supabase: Db, path: string) {
  const { data, error } = await supabase.storage.from("wardrobe").download(path);
  if (error || !data) throw new TryOnError("Couldn't read your photo. Please upload it again.");
  return data;
}

function buildPrompt(d: { description: string; occasion: string | null; extras: string | null; hasGarment: boolean; refine: boolean }) {
  return [
    d.refine
      ? "Image 1 is a person already wearing an outfit. Apply only this change to the outfit:"
      : d.hasGarment
        ? "Image 1 is a full-body photo of a person. Image 2 is a clothing item. Dress the person in the clothing item from image 2."
        : "Image 1 is a full-body photo of a person. Dress the person in this outfit:",
    d.description || "",
    d.occasion ? `Occasion: ${d.occasion}.` : "",
    d.extras ? `Styling details: ${d.extras}.` : "",
    "Keep the person's face, identity, skin tone, hair, body shape, pose and the background exactly as they are. Preserve the garment's colour, pattern, neckline, sleeves and silhouette. Photorealistic, natural fit and lighting. Do not add text or watermarks.",
  ].filter(Boolean).join(" ");
}

export async function runTryOn(
  supabase: Db,
  userId: string,
  d: { personPath: string; garmentPath: string | null; description: string; occasion: string | null; extras: string | null; parentId: string | null },
) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new TryOnError("AI try-on isn't configured.");
  for (const p of [d.personPath, d.garmentPath]) if (p && !p.startsWith(`${userId}/`)) throw new TryOnError("Invalid photo.");
  if (!d.garmentPath && !d.description) throw new TryOnError("Add a clothing photo or describe the outfit.");
  if (!(await checkAiQuota(supabase, userId, "tryon", 15))) throw new TryOnError("You've hit the hourly try-on limit. Please try again later.");

  const person = await download(supabase, d.personPath);
  const garment = d.garmentPath ? await download(supabase, d.garmentPath) : null;
  const refine = Boolean(d.parentId);

  const form = new FormData();
  form.set("model", IMAGE_MODEL);
  form.set("prompt", buildPrompt({ ...d, hasGarment: Boolean(garment), refine }));
  form.set("quality", "medium");
  form.set("output_format", "jpeg");
  form.append("image[]", new File([person], "person.jpg", { type: person.type || "image/jpeg" }));
  if (garment) form.append("image[]", new File([garment], "garment.jpg", { type: garment.type || "image/jpeg" }));

  const imageCall = (async () => {
    const res = await fetch(`${GATEWAY}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!res.ok) {
      console.error("try-on image failed", res.status);
      if (res.status === 402) throw new TryOnError("AI credits are exhausted.");
      if (res.status === 429) throw new TryOnError("AI is busy — please try again in a minute.");
      if (res.status === 400) throw new TryOnError("The AI couldn't use this photo. Try a clearer full-body photo.");
      throw new TryOnError("The try-on couldn't be generated. Please try again.");
    }
    const json = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new TryOnError("The AI returned no image (it may have declined this request).");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  })();

  const stylingCall = (async (): Promise<TryOnStyling | null> => {
    try {
      const content: ({ type: "text"; text: string } | { type: "image"; image: string; mediaType: string })[] = [
        { type: "text", text: `Outfit: ${d.description || "the clothing item in the photo"}. Occasion: ${d.occasion ?? "unspecified"}. Extras: ${d.extras ?? "none"}.` },
      ];
      if (garment) content.push({ type: "image", image: toBase64(new Uint8Array(await garment.arrayBuffer())), mediaType: garment.type || "image/jpeg" });
      return await generateStructured({
        schema: stylingSchema,
        instructions:
          "You are VÉSTARA's professional AI personal styling assistant. Given a garment photo and/or outfit description, give a short outfit name, a 2-3 sentence explanation of why it works for the occasion (colours, silhouette), 2-3 footwear ideas, 2-3 accessory ideas, 2 alternative combinations, and 2-3 practical styling tips. Never judge bodies. Never invent prices or brands. No emojis.",
        messages: [{ role: "user", content }],
      });
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) console.error("try-on styling failed");
      return null;
    }
  })();

  const [bytes, styling] = await Promise.all([imageCall, stylingCall]);
  const resultPath = `${userId}/tryon/results/${crypto.randomUUID()}.jpg`;
  const up = await supabase.storage.from("wardrobe").upload(resultPath, bytes, { contentType: "image/jpeg" });
  if (up.error) throw new TryOnError("Couldn't save the generated look.");

  const { data: row, error } = await supabase
    .from("tryon_looks")
    .insert({
      user_id: userId,
      person_path: d.personPath,
      garment_path: d.garmentPath,
      result_path: resultPath,
      description: d.description,
      occasion: d.occasion,
      styling: (styling ?? {}) as never,
      parent_id: d.parentId,
    })
    .select("id")
    .single();
  if (error || !row) throw new TryOnError("Couldn't save the generated look.");
  return { id: row.id };
}
