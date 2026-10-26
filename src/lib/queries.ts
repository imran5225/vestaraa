// Client-side data access (RLS-scoped reads/writes via the browser client).
import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Slot, WardrobeItem } from "@/lib/domain";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function currentUserId() {
  const storedToken =
    typeof window !== "undefined" ? localStorage.getItem("vestara_session_token") : null;
  if (storedToken?.startsWith("mock-token-")) {
    return storedToken.replace("mock-token-", "");
  }
  const { data } = await supabase.auth.getUser().catch(() => ({ data: null }));
  if (data?.user) return data.user.id;
  return DEMO_USER_ID;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    let userRes: {
      user: {
        id: string;
        email?: string;
        created_at?: string;
        user_metadata?: Record<string, unknown>;
      } | null;
    } | null = null;
    try {
      const res = await supabase.auth.getUser();
      userRes = res.data;
    } catch {
      // offline
    }

    const storedUsername =
      typeof window !== "undefined" ? localStorage.getItem("vestara_username") : null;
    const storedToken =
      typeof window !== "undefined" ? localStorage.getItem("vestara_session_token") : null;

    if (!userRes?.user) {
      if (storedUsername) {
        return {
          id: storedToken?.startsWith("mock-token-")
            ? storedToken.replace("mock-token-", "")
            : DEMO_USER_ID,
          display_name: storedUsername,
          username: storedUsername,
          email: `${storedUsername}@auth.vestara.internal`,
          avatar_url: null,
          photo_path: null,
          preferred_styles: ["casual", "smart-casual"],
          preferred_fits: ["regular", "tailored"],
          favorite_colors: ["navy", "white", "camel"],
          avoided_colors: [],
          typical_occasions: ["casual", "work", "college"],
          weather_enabled: false,
          weather_city: "London",
          comfort_notes: "Prefers natural breathable fabrics.",
          created_at: new Date().toISOString(),
        };
      }
      return {
        id: DEMO_USER_ID,
        display_name: "Style Explorer",
        username: "demo",
        email: "demo@auth.vestara.internal",
        avatar_url: null,
        photo_path: null,
        preferred_styles: ["casual", "smart-casual"],
        preferred_fits: ["regular", "tailored"],
        favorite_colors: ["navy", "white", "camel"],
        avoided_colors: [],
        typical_occasions: ["casual", "work", "college"],
        weather_enabled: false,
        weather_city: "London",
        comfort_notes: "Prefers natural breathable fabrics.",
        created_at: new Date().toISOString(),
      };
    }

    const user = userRes.user;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (error && !error.message.includes("Could not find the table")) {
      console.warn("Profile fetch warning:", error.message);
    }

    const { data: modelData } = await supabase
      .from("virtual_models")
      .select("photo_path")
      .eq("user_id", user.id)
      .maybeSingle();

    let avatarUrl: string | null = (user.user_metadata?.avatar_url as string) ?? null;
    if (modelData?.photo_path) {
      try {
        const { data: signed } = await supabase.storage
          .from("wardrobe")
          .createSignedUrl(modelData.photo_path, 3600);
        if (signed?.signedUrl) {
          avatarUrl = signed.signedUrl;
        }
      } catch (err) {
        console.warn("Avatar signing warning:", err);
      }
    }

    return {
      ...(data ?? {
        id: user.id,
        display_name:
          (user.user_metadata?.full_name as string) ?? user.email?.split("@")[0] ?? "Member",
        preferred_styles: ["casual", "smart-casual"],
        preferred_fits: ["regular"],
        favorite_colors: ["navy", "white"],
        avoided_colors: [],
        typical_occasions: ["casual"],
        weather_enabled: false,
        weather_city: null,
        comfort_notes: "",
        created_at: user.created_at ?? new Date().toISOString(),
      }),
      email: user.email,
      avatar_url: avatarUrl,
      photo_path: modelData?.photo_path ?? null,
    };
  },
});

export const wardrobeQuery = queryOptions({
  queryKey: ["wardrobe"],
  queryFn: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (userRes?.user) {
      const { data, error } = await supabase
        .from("wardrobe_items")
        .select("*")
        .eq("user_id", userRes.user.id)
        .order("created_at", { ascending: false });
      if (!error && data) return data as WardrobeItem[];
    }

    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data && data.length > 0) return data as WardrobeItem[];

    // Provide default sample wardrobe items for preview & guest users
    const { SAMPLE_WARDROBE } = await import("@/lib/sample-wardrobe");
    return SAMPLE_WARDROBE.map((s, idx) => ({
      id: `sample-${s.sample_key}`,
      user_id: DEMO_USER_ID,
      name: s.name,
      category: s.category,
      slot: (s.category === "outerwear"
        ? "outerwear"
        : s.category === "top" || s.category === "shirt"
          ? "top"
          : s.category === "trousers" || s.category === "jeans"
            ? "bottom"
            : s.category === "shoes"
              ? "shoes"
              : "accessory") as Slot,
      main_color: s.main_color,
      pattern: s.pattern,
      style: s.style,
      fit: s.fit,
      seasons: s.seasons,
      sample_key: s.sample_key,
      image_path: null,
      is_sample: true,
      created_at: new Date(Date.now() - idx * 3600000).toISOString(),
    })) as WardrobeItem[];
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

import {
  getConversations,
  getConversationMessages,
  getOutfits,
  getOutfitById,
} from "@/lib/styling.functions";

const SLOT_ORDER: Slot[] = ["outerwear", "top", "bottom", "shoes", "accessory"];

const OUTFIT_SELECT =
  "id,occasion,mood,explanation,score,source,status,piece_count,worn_at,created_at,outfit_items(slot,item:wardrobe_items(*))";

type RawOutfit = Omit<OutfitView, "pieces"> & {
  outfit_items?: { slot: string; item: WardrobeItem | null }[];
};

function toView(raw: RawOutfit): OutfitView {
  const items = Array.isArray(raw?.outfit_items) ? raw.outfit_items : [];
  const pieces = items
    .filter((p): p is { slot: string; item: WardrobeItem } => Boolean(p && p.item))
    .map((p) => ({ slot: p.slot as Slot, item: p.item }))
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  const { outfit_items: _ignored, ...rest } = raw;
  return { ...rest, pieces };
}

export const outfitsQuery = (filter: "all" | "saved" = "all", limit = 24) =>
  queryOptions({
    queryKey: ["outfits", filter, limit],
    queryFn: async () => {
      try {
        const data = await getOutfits({ data: { filter, limit } });
        if (Array.isArray(data)) return (data as unknown as RawOutfit[]).map(toView);
      } catch {
        // Fallback to client-side supabase if available
      }
      try {
        let q = supabase
          .from("outfits")
          .select(OUTFIT_SELECT)
          .order("created_at", { ascending: false })
          .limit(limit);
        if (filter === "saved") q = q.eq("status", "saved");
        const { data, error } = await q;
        if (error) {
          return [];
        }
        return ((data ?? []) as unknown as RawOutfit[]).map(toView);
      } catch {
        return [];
      }
    },
  });

export const outfitQuery = (id: string | null) =>
  queryOptions({
    queryKey: ["outfit", id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      try {
        const data = await getOutfitById({ data: { outfitId: id } });
        if (data) return toView(data as unknown as RawOutfit);
      } catch {
        // Fallback to client-side supabase if available
      }
      try {
        const { data, error } = await supabase
          .from("outfits")
          .select(OUTFIT_SELECT)
          .eq("id", id)
          .maybeSingle();
        if (error) {
          return null;
        }
        return data ? toView(data as unknown as RawOutfit) : null;
      } catch {
        return null;
      }
    },
  });

export const feedbackQuery = queryOptions({
  queryKey: ["feedback"],
  queryFn: async () => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("id,action,slot,colors,item_ids,created_at,outfit_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        return [];
      }
      return data ?? [];
    } catch {
      return [];
    }
  },
});

export const conversationsQuery = queryOptions({
  queryKey: ["conversations"],
  queryFn: async () => {
    try {
      const data = await getConversations();
      if (Array.isArray(data)) return data;
    } catch {
      // Fallback to client-side supabase if available
    }
    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) {
        return [];
      }
      return data ?? [];
    } catch {
      return [];
    }
  },
});

export const messagesQuery = (conversationId: string | null) =>
  queryOptions({
    queryKey: ["messages", conversationId],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!conversationId) return [];
      try {
        const data = await getConversationMessages({ data: { conversationId } });
        if (Array.isArray(data)) return data;
      } catch {
        // Fallback to client-side supabase if available
      }
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id,role,content,outfit_id,mode,created_at")
          .eq("conversation_id", conversationId)
          .order("created_at");
        if (error) return [];
        return data ?? [];
      } catch {
        return [];
      }
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
      try {
        const { data, error } = await supabase.storage
          .from("wardrobe")
          .createSignedUrls(unique, 3600);
        if (error) return {};
        const map: Record<string, string> = {};
        for (const d of data ?? []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
        return map;
      } catch {
        return {};
      }
    },
  });
}
