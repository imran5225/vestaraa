// Client-side data access (RLS-scoped reads/writes via the browser client).
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Slot, WardrobeItem } from "@/lib/domain";

export async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return data.user.id;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await currentUserId();
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },
});

export const wardrobeQuery = queryOptions({
  queryKey: ["wardrobe"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as WardrobeItem[];
  },
});

export interface OutfitPiece {
  slot: Slot;
  item: WardrobeItem;
}
export interface OutfitView {
  id: string;
  occasion: string;
  mood: string | null;
  explanation: string;
  score: number;
  source: string;
  status: string;
  piece_count: number;
  worn_at: string | null;
  created_at: string;
  pieces: OutfitPiece[];
}

const SLOT_ORDER: Slot[] = ["outerwear", "top", "bottom", "shoes", "accessory"];

const OUTFIT_SELECT =
  "id,occasion,mood,explanation,score,source,status,piece_count,worn_at,created_at,outfit_items(slot,item:wardrobe_items(*))";

type RawOutfit = Omit<OutfitView, "pieces"> & {
  outfit_items: { slot: string; item: WardrobeItem | null }[];
};

function toView(raw: RawOutfit): OutfitView {
  const pieces = raw.outfit_items
    .filter((p): p is { slot: string; item: WardrobeItem } => Boolean(p.item))
    .map((p) => ({ slot: p.slot as Slot, item: p.item }))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const { outfit_items: _ignored, ...rest } = raw;
  return { ...rest, pieces };
}

export const outfitsQuery = (filter: "all" | "saved" = "all", limit = 24) =>
  queryOptions({
    queryKey: ["outfits", filter, limit],
    queryFn: async () => {
      let q = supabase.from("outfits").select(OUTFIT_SELECT).order("created_at", { ascending: false }).limit(limit);
      if (filter === "saved") q = q.eq("status", "saved");
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as RawOutfit[]).map(toView);
    },
  });

export const outfitQuery = (id: string | null) =>
  queryOptions({
    queryKey: ["outfit", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("outfits").select(OUTFIT_SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return data ? toView(data as unknown as RawOutfit) : null;
    },
  });

export const feedbackQuery = queryOptions({
  queryKey: ["feedback"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("id,action,slot,created_at,outfit_id")
      .order("created_at", { ascending: false })
      .limit(8);
    if (error) throw error;
    return data ?? [];
  },
});

export const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data ?? [];
  },
});

export const messagesQuery = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id,role,content,outfit_id,mode,created_at")
        .eq("conversation_id", conversationId!)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

/** Batch-sign private wardrobe image paths (1h). */
export function useSignedUrls(paths: string[]) {
  const unique = [...new Set(paths)].sort();
  return useQuery({
    queryKey: ["signed-urls", unique],
    enabled: unique.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("wardrobe").createSignedUrls(unique, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      return map;
    },
  });
}
