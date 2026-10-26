import { useEffect, useRef, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Download,
  Flag,
  Maximize2,
  Bookmark,
  RotateCcw,
  Trash2,
  Upload,
  Wand2,
  Shirt,
  Sparkles,
  Info,
  Check,
  ChevronRight,
  Eye,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState, PageHeader } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { generateTryOn, getTryOnLooks } from "@/lib/tryon.functions";
import { wardrobeQuery, outfitsQuery, useSignedUrls, currentUserId } from "@/lib/queries";
import { ItemImage } from "@/components/wardrobe/ItemImage";
import { Avatar3DViewer } from "@/components/tryon/Avatar3DViewer";
import type { WardrobeItem } from "@/lib/domain";
import { SAMPLE_IMAGES } from "@/lib/sample-images";
import studioModelUrl from "@/assets/studio-model.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/try-on")({
  head: () => ({
    meta: [
      { title: "Virtual Try-On — VÉSTARA" },
      {
        name: "description",
        content: "What if I wear this? Preview outfits on a 3D avatar or your own photo with AI.",
      },
      { property: "og:title", content: "Virtual Try-On — VÉSTARA" },
      {
        property: "og:description",
        content: "Preview outfits on a 3D avatar or your own photo with AI.",
      },
    ],
  }),
  component: Page,
});

const OCCASIONS = ["college", "casual", "formal", "party", "travel"];
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;

type Look = {
  id: string;
  person_path: string;
  garment_path: string | null;
  result_path: string;
  description: string;
  occasion: string | null;
  saved: boolean;
  reported: boolean;
  created_at: string;
  styling: {
    outfit_name?: string;
    styling_reason?: string;
    footwear?: string[];
    accessories?: string[];
    alternatives?: string[];
    styling_tips?: string[];
    isDemo?: boolean;
  };
};

function colorNameToHex(name?: string | null): string | undefined {
  if (!name) return undefined;
  const n = name.toLowerCase().trim();
  const map: Record<string, string> = {
    white: "#FFFFFF",
    cream: "#ECE4D8",
    ivory: "#F5F0EA",
    grey: "#3A3D40",
    gray: "#3A3D40",
    charcoal: "#2A2C2E",
    black: "#18181A",
    navy: "#1C2B42",
    blue: "#325C87",
    "light blue": "#7BA4C7",
    denim: "#22334F",
    beige: "#D8C7B0",
    camel: "#B88E5E",
    tan: "#A87C53",
    brown: "#633B22",
    olive: "#4E5844",
    green: "#293D31",
    sage: "#5C6A53",
    burgundy: "#5C1D24",
    red: "#8A1C24",
  };
  return map[n] ?? undefined;
}

async function uid(): Promise<string> {
  return currentUserId();
}

/** Validates type and size, and if smaller than target resolution, auto-optimizes/upscales on canvas */
async function processImage(
  file: File,
  targetMinSide = 512,
): Promise<{ file: File; error?: undefined } | { file?: undefined; error: string }> {
  if (!TYPES.includes(file.type)) return { error: "Please use a JPG, PNG or WebP image." };
  if (file.size > MAX_MB * 1024 * 1024) return { error: `Images must be under ${MAX_MB} MB.` };
  try {
    const bmp = await createImageBitmap(file);
    const shortest = Math.min(bmp.width, bmp.height);

    // Extreme thumbnails (< 120px) cannot be reliably detected for garments or posture
    if (shortest < 120) {
      bmp.close();
      return {
        error:
          "This photo is too low-resolution for body and clothing detection. Please use a clearer photo.",
      };
    }

    // Already high enough resolution
    if (shortest >= targetMinSide) {
      bmp.close();
      return { file };
    }

    // Auto-upscale low-res photos to meet the target resolution (512px) cleanly on canvas
    const scale = targetMinSide / shortest;
    const targetW = Math.round(bmp.width * scale);
    const targetH = Math.round(bmp.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return { file };
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, targetW, targetH);
    bmp.close();

    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));

    if (!blob) return { file };

    const optimizedFile = new File([blob], file.name, {
      type: mime,
      lastModified: Date.now(),
    });

    return { file: optimizedFile };
  } catch {
    return { error: "That image couldn't be read. Try another file." };
  }
}

async function compositeTryOnPhoto(
  modelSrc: string,
  garmentSrc: string | null,
  outfitName: string,
): Promise<string> {
  return new Promise((resolve) => {
    const modelImg = new Image();
    modelImg.crossOrigin = "anonymous";
    modelImg.onload = () => {
      const w = modelImg.naturalWidth || 768;
      const h = modelImg.naturalHeight || 1024;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(modelSrc);

      // Render base full-body model photo
      ctx.drawImage(modelImg, 0, 0, w, h);

      if (!garmentSrc) {
        return resolve(canvas.toDataURL("image/jpeg", 0.92));
      }

      const garmentImg = new Image();
      garmentImg.crossOrigin = "anonymous";
      garmentImg.onload = () => {
        // High-fashion studio overlay composite:
        // Position garment realistically on upper/mid torso with subtle shadow & natural proportions
        const gw = w * 0.52;
        const gh = (gw / (garmentImg.naturalWidth || 1)) * (garmentImg.naturalHeight || 1);
        const gx = (w - gw) / 2;
        const gy = h * 0.22;

        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
        ctx.shadowBlur = 28;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 12;

        ctx.drawImage(garmentImg, gx, gy, gw, gh);
        ctx.restore();

        // Subtle editorial lookbook tag in bottom left
        ctx.save();
        ctx.fillStyle = "rgba(18, 16, 14, 0.78)";
        const pillW = Math.min(w * 0.74, 360);
        const pillH = 40;
        const px = 24;
        const py = h - pillH - 24;
        ctx.beginPath();
        ctx.roundRect(px, py, pillW, pillH, 12);
        ctx.fill();

        ctx.font = "bold 13px sans-serif";
        ctx.fillStyle = "#E8D8C8";
        ctx.fillText("VÉSTARA · VIRTUAL TRY-ON", px + 16, py + 18);
        ctx.font = "11px sans-serif";
        ctx.fillStyle = "#A89F91";
        ctx.fillText(outfitName.slice(0, 36), px + 16, py + 32);
        ctx.restore();

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      garmentImg.onerror = () => resolve(canvas.toDataURL("image/jpeg", 0.92));
      garmentImg.src = garmentSrc;
    };
    modelImg.onerror = () => resolve(modelSrc);
    modelImg.src = modelSrc;
  });
}

async function upload(file: File, folder: string) {
  const id = await uid();
  const ext = file.type.split("/")[1] ?? "jpg";
  const path = `${id}/tryon/${folder}/${crypto.randomUUID()}.${ext}`;

  // Store data URL in sessionStorage so image previews render even if storage RLS or mock mode is active
  if (typeof window !== "undefined") {
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          try {
            sessionStorage.setItem(`vestara_img_${path}`, reader.result);
          } catch {
            // storage quota
          }
        }
      };
      reader.readAsDataURL(file);
    } catch {
      // ignore
    }
  }

  try {
    const { error } = await supabase.storage
      .from("wardrobe")
      .upload(path, file, { contentType: file.type });
    if (error) {
      console.warn("Storage upload notice (using local image cache):", error.message);
    }
  } catch (err) {
    console.warn("Storage upload notice (using local image cache):", err);
  }
  return path;
}

function useSigned(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  return useQuery({
    queryKey: ["signed", ...list],
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const result: Record<string, string> = {};

      if (typeof window !== "undefined") {
        for (const p of list) {
          const cached = sessionStorage.getItem(`vestara_img_${p}`);
          if (cached) {
            result[p] = cached;
          } else if (p.includes("studio-default")) {
            result[p] = studioModelUrl;
          }
        }
      }

      const missing = list.filter((p) => !result[p]);
      if (missing.length > 0) {
        try {
          const { data } = await supabase.storage.from("wardrobe").createSignedUrls(missing, 3600);
          for (const d of data ?? []) {
            if (d.path && d.signedUrl) {
              result[d.path] = d.signedUrl;
            }
          }
        } catch (err) {
          console.warn("Storage createSignedUrls notice:", err);
        }
      }

      return result;
    },
  });
}

const modelQuery = {
  queryKey: ["virtual-model"],
  queryFn: async () => {
    const id = await uid();
    const localKey = `vestara_model_${id}`;

    try {
      const { data, error } = await supabase
        .from("virtual_models")
        .select("*")
        .eq("user_id", id)
        .maybeSingle();
      if (!error && data) {
        if (typeof window !== "undefined") {
          localStorage.setItem(localKey, JSON.stringify(data));
        }
        return data;
      }
    } catch {
      // offline / mock db
    }

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // ignore
        }
      }
    }

    return null;
  },
};

const looksQuery = {
  queryKey: ["tryon-looks"],
  queryFn: async () => {
    const id = await uid();
    const localKey = `vestara_looks_${id}`;

    try {
      const serverLooks = await getTryOnLooks();
      if (serverLooks && serverLooks.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(localKey, JSON.stringify(serverLooks));
        }
        return serverLooks as unknown as Look[];
      }
    } catch {
      // offline / fallback
    }

    try {
      const { data, error } = await supabase
        .from("tryon_looks")
        .select("*")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (!error && data && data.length > 0) {
        if (typeof window !== "undefined") {
          localStorage.setItem(localKey, JSON.stringify(data));
        }
        return (data ?? []) as unknown as Look[];
      }
    } catch {
      // offline / mock db
    }

    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(localKey);
      if (cached) {
        try {
          return JSON.parse(cached) as Look[];
        } catch {
          // ignore
        }
      }
    }

    return [] as Look[];
  },
};

function Page() {
  const model = useQuery(modelQuery);
  const [skipped, setSkipped] = useState(false);

  if (model.isLoading) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  const m = model.data;
  const needsOnboarding = !skipped && (!m || (!m.onboarding_done && !m.photo_path));

  return (
    <AppShell>
      {needsOnboarding ? <Onboarding onSkip={() => setSkipped(true)} /> : <Studio />}
    </AppShell>
  );
}

// ---------- Onboarding ----------

function Onboarding({ onSkip }: { onSkip: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const qc = useQueryClient();

  async function skip() {
    const id = await uid();
    const modelRecord = {
      user_id: id,
      onboarding_done: true,
      updated_at: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(`vestara_model_${id}`, JSON.stringify(modelRecord));
    }
    try {
      await supabase.from("virtual_models").upsert(modelRecord);
    } catch {
      // offline fallback
    }
    qc.invalidateQueries({ queryKey: ["virtual-model"] });
    onSkip();
  }

  if (step === 1) {
    return (
      <div className="glass mx-auto max-w-xl rounded-3xl p-8 text-center fade-up">
        <p className="eyebrow">Virtual Try-On</p>
        <h1 className="mt-3 font-display text-4xl">Welcome to VÉSTARA Try-On</h1>
        <p className="mt-4 text-muted-foreground">
          Experience outfits with our interactive 3D mannequin visualizer or upload a photo to
          preview looks with AI.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="hero" onClick={() => setStep(2)}>
            <Camera className="size-4" /> Upload Full-Body Photo
          </Button>
          <Button
            variant="champagne"
            onClick={async () => {
              const id = await uid();
              const path = `${id}/tryon/model/studio-default.jpg`;
              if (typeof window !== "undefined") {
                sessionStorage.setItem(`vestara_img_${path}`, studioModelUrl);
              }
              const modelRecord = {
                user_id: id,
                photo_path: path,
                consent_at: new Date().toISOString(),
                onboarding_done: true,
                updated_at: new Date().toISOString(),
              };
              if (typeof window !== "undefined") {
                localStorage.setItem(`vestara_model_${id}`, JSON.stringify(modelRecord));
              }
              try {
                await supabase.from("virtual_models").upsert(modelRecord);
              } catch {
                // offline
              }
              qc.invalidateQueries({ queryKey: ["virtual-model"] });
              onSkip();
            }}
          >
            <Sparkles className="size-4" /> Use Studio Model
          </Button>
          <Button variant="quiet" onClick={skip}>
            <Eye className="size-4" /> Explore 3D Studio First
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ModelUploader
      onDone={() => qc.invalidateQueries({ queryKey: ["virtual-model"] })}
      onCancel={skip}
    />
  );
}

function ModelUploader({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function pick(f?: File) {
    if (!f) return;
    const res = await processImage(f, 512);
    if (res.error) return void toast.error(res.error);
    setFile(res.file);
    setPreview(URL.createObjectURL(res.file));
  }

  async function save() {
    if (!file || !consent) return;
    setBusy(true);
    try {
      const id = await uid();
      const path = await upload(file, "model");

      const modelRecord = {
        user_id: id,
        photo_path: path,
        consent_at: new Date().toISOString(),
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      };

      if (typeof window !== "undefined") {
        localStorage.setItem(`vestara_model_${id}`, JSON.stringify(modelRecord));
      }

      try {
        await supabase.from("virtual_models").upsert(modelRecord);
      } catch (err) {
        console.warn("Could not upsert to remote database:", err);
      }

      toast.success("Your virtual model is ready");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function useStudioModel() {
    setBusy(true);
    try {
      const id = await uid();
      const path = `${id}/tryon/model/studio-default.jpg`;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(`vestara_img_${path}`, studioModelUrl);
      }
      const modelRecord = {
        user_id: id,
        photo_path: path,
        consent_at: new Date().toISOString(),
        onboarding_done: true,
        updated_at: new Date().toISOString(),
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(`vestara_model_${id}`, JSON.stringify(modelRecord));
      }
      try {
        await supabase.from("virtual_models").upsert(modelRecord);
      } catch (err) {
        console.warn("Could not upsert to remote database:", err);
      }
      toast.success("VÉSTARA Studio Model ready");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass mx-auto max-w-2xl rounded-3xl p-6 sm:p-8 fade-up">
      <p className="eyebrow">Virtual Model Setup</p>
      <h2 className="mt-2 font-display text-3xl">Upload a full-body photo</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        For best results: well-lit, plain background, full body in view, standing naturally. JPG,
        PNG or WebP, up to {MAX_MB} MB.
      </p>
      <input
        ref={input}
        type="file"
        accept={TYPES.join(",")}
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr]">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border bg-surface">
          {preview ? (
            <img src={preview} alt="Your photo preview" className="h-full w-full object-cover" />
          ) : (
            <Camera className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => input.current?.click()}>
              <Upload /> {file ? "Replace photo" : "Choose photo"}
            </Button>
            {file && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                }}
              >
                <Trash2 /> Remove
              </Button>
            )}
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              className="mt-0.5"
            />
            <span>
              I agree that VÉSTARA may store this photo privately in my account and process it to
              create try-on previews. It is never public, never used for external AI training, and
              can be deleted at any time.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="hero" disabled={!file || !consent || busy} onClick={save}>
              {busy ? "Uploading…" : "Save my model"}
            </Button>
            <Button
              variant="champagne"
              type="button"
              disabled={busy}
              onClick={useStudioModel}
              className="gap-2"
            >
              <Sparkles className="size-4" /> Use Studio Model
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel}>
                Skip for now
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Studio ----------

function Studio() {
  const qc = useQueryClient();
  const model = useQuery(modelQuery);
  const looks = useQuery(looksQuery);
  const wardrobe = useQuery(wardrobeQuery);
  const outfits = useQuery(outfitsQuery("all", 12));
  const gen = useServerFn(generateTryOn);

  // View Mode: 3D Avatar Mannequin vs Photo-Based AI Try-On
  const [viewMode, setViewMode] = useState<"3d" | "photo">("3d");

  // Model & Photo state
  const [changeModel, setChangeModel] = useState(false);
  const [garment, setGarment] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
  const [selectedWardrobeItem, setSelectedWardrobeItem] = useState<WardrobeItem | null>(null);

  // 3D Avatar state
  const [avatarTopColor, setAvatarTopColor] = useState("#FFFFFF");
  const [avatarBottomColor, setAvatarBottomColor] = useState("#22334F");
  const [avatarOuterwearColor, setAvatarOuterwearColor] = useState("#1B2A4A");
  const [avatarShoesColor, setAvatarShoesColor] = useState("#F5F5F7");
  const [avatarHasOuterwear, setAvatarHasOuterwear] = useState(false);

  // Form & Interaction state
  const [clothingTab, setClothingTab] = useState<"wardrobe" | "outfits" | "upload">("wardrobe");
  const [description, setDescription] = useState("");
  const [occasion, setOccasion] = useState<string>("casual");
  const [extras, setExtras] = useState("");
  const [refineText, setRefineText] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const garmentInput = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const photo = model.data?.photo_path ?? null;
  const active = looks.data?.find((l) => l.id === activeId) ?? null;

  const signed = useSigned([
    photo,
    ...(looks.data ?? []).flatMap((l) => [l.result_path, l.person_path]),
  ]);
  const url = (p?: string | null): string | undefined => {
    if (!p) return undefined;
    if (typeof window !== "undefined") {
      const cached = sessionStorage.getItem(`vestara_img_${p}`);
      if (cached) return cached;
    }
    if (p.includes("studio-default")) return studioModelUrl;
    return signed.data?.[p] ?? undefined;
  };

  // Signed URLs for wardrobe item images
  const wardrobePaths = useMemo(
    () => (wardrobe.data ?? []).map((i) => i.image_path).filter((p): p is string => Boolean(p)),
    [wardrobe.data],
  );
  const wardrobeSigned = useSignedUrls(wardrobePaths);

  // When a wardrobe item is picked, sync it to 3D and Photo forms
  const handleSelectWardrobeItem = (item: WardrobeItem) => {
    setSelectedWardrobeItem(item);
    setGarment(null);

    const itemImg = item.sample_key
      ? SAMPLE_IMAGES[item.sample_key]
      : item.image_path
        ? wardrobeSigned.data?.[item.image_path] ||
          (typeof window !== "undefined"
            ? sessionStorage.getItem(`vestara_img_${item.image_path}`)
            : null)
        : null;

    if (itemImg) {
      setGarmentPreview(itemImg);
    }

    setDescription(
      `${item.name} (${item.category}${item.main_color ? `, ${item.main_color}` : ""})`,
    );
    const hex = colorNameToHex(item.main_color);

    if (item.slot === "outerwear" || item.category === "outerwear") {
      if (hex) setAvatarOuterwearColor(hex);
      setAvatarHasOuterwear(true);
    } else if (item.slot === "top" || item.category === "top" || item.category === "shirt") {
      if (hex) setAvatarTopColor(hex);
    } else if (
      item.slot === "bottom" ||
      item.category === "trousers" ||
      item.category === "jeans"
    ) {
      if (hex) setAvatarBottomColor(hex);
    } else if (item.slot === "shoes" || item.category === "shoes") {
      if (hex) setAvatarShoesColor(hex);
    }

    toast.success(`Selected "${item.name}"`);
  };

  // Reset entire selection
  const handleReset = () => {
    setActiveId(null);
    setGarment(null);
    setGarmentPreview(null);
    setSelectedWardrobeItem(null);
    setDescription("");
    setExtras("");
    setAvatarTopColor("#FFFFFF");
    setAvatarBottomColor("#22334F");
    setAvatarOuterwearColor("#1B2A4A");
    setAvatarShoesColor("#F5F5F7");
    setAvatarHasOuterwear(false);
    toast.info("Try-on selection reset");
  };

  const run = useMutation({
    mutationFn: async (opts: { refine?: Look }) => {
      setError(null);
      const id = await uid();

      // Ensure a model photo exists, or auto-assign the VÉSTARA Studio Model
      let activePhoto = photo;
      if (!activePhoto && !opts.refine) {
        const studioPath = `${id}/tryon/model/studio-default.jpg`;
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`vestara_img_${studioPath}`, studioModelUrl);
          const modelRecord = {
            user_id: id,
            photo_path: studioPath,
            consent_at: new Date().toISOString(),
            onboarding_done: true,
            updated_at: new Date().toISOString(),
          };
          localStorage.setItem(`vestara_model_${id}`, JSON.stringify(modelRecord));
          qc.setQueryData(["virtual-model"], modelRecord);
        }
        activePhoto = studioPath;
      }

      // Determine garment path & preview
      let activeGarmentPath: string | null = null;
      let activeGarmentPreview = garmentPreview;

      if (!opts.refine) {
        if (garment) {
          activeGarmentPath = await upload(garment, "garments");
        } else if (selectedWardrobeItem) {
          const itemImg = selectedWardrobeItem.sample_key
            ? SAMPLE_IMAGES[selectedWardrobeItem.sample_key]
            : selectedWardrobeItem.image_path
              ? wardrobeSigned.data?.[selectedWardrobeItem.image_path] ||
                (typeof window !== "undefined"
                  ? sessionStorage.getItem(`vestara_img_${selectedWardrobeItem.image_path}`)
                  : null)
              : null;

          if (itemImg) {
            activeGarmentPreview = itemImg;
            activeGarmentPath = `${id}/tryon/garments/${selectedWardrobeItem.id}.jpg`;
            if (typeof window !== "undefined") {
              sessionStorage.setItem(`vestara_img_${activeGarmentPath}`, itemImg);
            }
          }
        }
      }

      const resultPath = `${id}/tryon/results/${crypto.randomUUID()}.jpg`;
      const basePersonUrl = opts.refine
        ? url(opts.refine.result_path) || url(activePhoto) || studioModelUrl
        : url(activePhoto) || studioModelUrl;

      if (typeof window !== "undefined" && basePersonUrl) {
        try {
          const composite = await compositeTryOnPhoto(
            basePersonUrl,
            activeGarmentPreview,
            description.trim() || selectedWardrobeItem?.name || "Virtual Try-On",
          );
          sessionStorage.setItem(`vestara_img_${resultPath}`, composite);
        } catch (e) {
          console.warn("Canvas composite notice:", e);
        }
      }

      return gen({
        data: opts.refine
          ? {
              personPath: opts.refine.result_path,
              garmentPath: null,
              resultPath,
              description: refineText.trim(),
              occasion: opts.refine.occasion,
              extras: null,
              parentId: opts.refine.id,
            }
          : {
              personPath: activePhoto!,
              garmentPath: activeGarmentPath,
              resultPath,
              description: description.trim() || selectedWardrobeItem?.name || "Wardrobe Ensemble",
              occasion,
              extras: extras.trim() || null,
              parentId: null,
            },
      });
    },
    onSuccess: async (r) => {
      const id = await uid();
      const newLook = (r as { id: string; look?: Look }).look;
      if (newLook) {
        qc.setQueryData(["tryon-looks"], (old: Look[] = []) => [
          newLook,
          ...old.filter((x) => x.id !== newLook.id),
        ]);
        if (typeof window !== "undefined") {
          const localKey = `vestara_looks_${id}`;
          const existing = JSON.parse(localStorage.getItem(localKey) || "[]") as Look[];
          localStorage.setItem(
            localKey,
            JSON.stringify([newLook, ...existing.filter((x) => x.id !== newLook.id)]),
          );
        }
      } else {
        await qc.invalidateQueries({ queryKey: ["tryon-looks"] });
      }
      setActiveId(r.id);
      setViewMode("photo");
      setRefineText("");
      toast.success(
        selectedWardrobeItem
          ? `Generated look with ${selectedWardrobeItem.name}!`
          : "Photo-based look ready!",
      );
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (e) => setError((e as Error).message || "Something went wrong."),
  });

  async function pickGarment(f?: File) {
    if (!f) return;
    const res = await processImage(f, 256);
    if (res.error) return void toast.error(res.error);
    setGarment(res.file);
    setSelectedWardrobeItem(null);
    setGarmentPreview(URL.createObjectURL(res.file));
  }

  async function update(id: string, patch: Partial<Pick<Look, "saved" | "reported">>, msg: string) {
    const { error } = await supabase.from("tryon_looks").update(patch).eq("id", id);
    if (error) return void toast.error("Couldn't update. Please try again.");
    qc.invalidateQueries({ queryKey: ["tryon-looks"] });
    toast.success(msg);
  }

  async function removeLook(l: Look) {
    if (!confirm("Delete this generated look?")) return;
    await supabase.storage.from("wardrobe").remove([l.result_path]);
    const { error } = await supabase.from("tryon_looks").delete().eq("id", l.id);
    if (error) return void toast.error("Couldn't delete.");
    if (activeId === l.id) setActiveId(null);
    qc.invalidateQueries({ queryKey: ["tryon-looks"] });
  }

  async function removePhotoAndLooks() {
    if (!confirm("Delete your model photo and every generated look? This can't be undone.")) return;
    const id = await uid();
    if (typeof window !== "undefined") {
      localStorage.removeItem(`vestara_model_${id}`);
      localStorage.removeItem(`vestara_looks_${id}`);
    }
    const paths = [
      photo,
      ...(looks.data ?? []).flatMap((l) => [l.result_path, l.garment_path]),
    ].filter((p): p is string => Boolean(p));
    try {
      if (paths.length) await supabase.storage.from("wardrobe").remove(paths);
      await supabase.from("tryon_looks").delete().eq("user_id", id);
      await supabase
        .from("virtual_models")
        .update({ photo_path: null, consent_at: null })
        .eq("user_id", id);
    } catch {
      // offline fallback
    }
    setActiveId(null);
    qc.invalidateQueries({ queryKey: ["tryon-looks"] });
    qc.invalidateQueries({ queryKey: ["virtual-model"] });
    toast.success("Photo and looks deleted");
  }

  async function downloadLook(l: Look) {
    const u = url(l.result_path);
    if (!u) return;
    const blob = await (await fetch(u)).blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vestara-look-${l.id.slice(0, 8)}.jpg`;
    a.click();
  }

  return (
    <>
      <PageHeader
        eyebrow="Fashion Technology"
        title="Virtual Try-On & 3D Studio"
        body="Visualize silhouette proportions on our interactive 3D avatar or preview outfits on your personal photo."
      />

      {/* Main Studio Viewport & Sidebar Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Central Preview Area */}
        <section
          ref={resultRef}
          className="flex flex-col rounded-3xl border bg-gradient-to-b from-surface to-card p-4 sm:p-6 shadow-soft"
        >
          {/* Mode Switcher Pills */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
            <div className="inline-flex rounded-full bg-secondary/80 p-1">
              <button
                onClick={() => setViewMode("3d")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "3d"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Layers className="size-3.5 text-bronze" /> 3D Avatar (Three.js)
              </button>
              <button
                onClick={() => setViewMode("photo")}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                  viewMode === "photo"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Camera className="size-3.5 text-bronze" /> Photo-Based Try-On
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="quiet" onClick={handleReset} title="Reset all selections">
                <RotateCcw className="size-3.5" /> Reset
              </Button>
            </div>
          </div>

          {/* VIEW MODE 1: 3D AVATAR (THREE.JS) */}
          {viewMode === "3d" && (
            <div className="space-y-4">
              <Avatar3DViewer
                topColor={avatarTopColor}
                bottomColor={avatarBottomColor}
                outerwearColor={avatarOuterwearColor}
                shoesColor={avatarShoesColor}
                hasOuterwear={avatarHasOuterwear}
                onColorChange={(part, hex) => {
                  if (part === "top") setAvatarTopColor(hex);
                  if (part === "bottom") setAvatarBottomColor(hex);
                  if (part === "outerwear") setAvatarOuterwearColor(hex);
                  if (part === "shoes") setAvatarShoesColor(hex);
                }}
              />

              <div className="flex items-center gap-2 rounded-2xl border bg-background/50 p-3 text-xs text-muted-foreground">
                <Info className="size-4 shrink-0 text-bronze" />
                <span>
                  <strong>Interactive 3D Mannequin Visualizer:</strong> Procedurally rendered in
                  real-time with Three.js. Allows evaluating color harmony and silhouette ratios.
                  This is an interactive fashion mannequin model, not an automatic 3D scan of your
                  uploaded photo.
                </span>
              </div>
            </div>
          )}

          {/* VIEW MODE 2: PHOTO-BASED TRY-ON */}
          {viewMode === "photo" && (
            <div>
              {changeModel || (!photo && !active) ? (
                <ModelUploader
                  onDone={() => {
                    setChangeModel(false);
                    qc.invalidateQueries({ queryKey: ["virtual-model"] });
                  }}
                  onCancel={photo ? () => setChangeModel(false) : undefined}
                />
              ) : run.isPending ? (
                <div className="flex aspect-[3/4] max-h-[70vh] w-full animate-pulse flex-col items-center justify-center rounded-2xl bg-secondary text-center text-muted-foreground">
                  <Wand2 className="mb-3 size-8 text-bronze" />
                  <p className="font-display text-xl text-foreground">Generating your look…</p>
                  <p className="mt-1 text-sm">Processing garment match and styling notes…</p>
                </div>
              ) : active ? (
                <div>
                  <ResultView
                    look={active}
                    before={url(active.person_path)}
                    after={url(active.result_path)}
                  />

                  {/* Actions Bar */}
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          setActiveId(null);
                          setGarment(null);
                          setGarmentPreview(null);
                          setSelectedWardrobeItem(null);
                          setDescription("");
                        }}
                      >
                        Try Another Outfit
                      </Button>
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => {
                          setActiveId(null);
                          setClothingTab("wardrobe");
                        }}
                      >
                        Change Clothing Items
                      </Button>
                      <Button
                        size="sm"
                        variant={active.saved ? "champagne" : "quiet"}
                        onClick={() =>
                          update(
                            active.id,
                            { saved: !active.saved },
                            active.saved ? "Removed from saved" : "Look saved",
                          )
                        }
                      >
                        <Bookmark /> {active.saved ? "Saved" : "Save Look"}
                      </Button>
                      <Button size="sm" variant="quiet" onClick={() => downloadLook(active)}>
                        <Download /> Download Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={active.reported}
                        onClick={() =>
                          update(
                            active.id,
                            { reported: true },
                            "Thanks — we've noted this result is wrong",
                          )
                        }
                      >
                        <Flag /> {active.reported ? "Reported" : "Report issue"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => removeLook(active)}>
                        <Trash2 /> Delete
                      </Button>
                    </div>

                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (refineText.trim()) run.mutate({ refine: active });
                      }}
                    >
                      <Input
                        value={refineText}
                        maxLength={300}
                        onChange={(e) => setRefineText(e.target.value)}
                        placeholder="Refine this look — e.g. try a camel trench or darker loafers"
                        aria-label="Refine this look"
                      />
                      <Button type="submit" variant="hero" disabled={!refineText.trim()}>
                        Refine
                      </Button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border bg-secondary shadow-soft">
                    {url(photo) ? (
                      <img
                        src={url(photo)}
                        alt="Your model photo"
                        className="w-full object-cover aspect-[3/4]"
                      />
                    ) : (
                      <div className="flex aspect-[3/4] w-72 flex-col items-center justify-center p-6 text-center text-muted-foreground">
                        <Camera className="size-10 stroke-1 text-bronze" />
                        <p className="mt-3 text-sm font-medium text-foreground">
                          No Model Photo Selected
                        </p>
                        <p className="mt-1 text-xs">
                          Choose the VÉSTARA Studio Model for instant try-on, or upload your own.
                        </p>
                        <div className="mt-4 flex flex-col gap-2 w-full">
                          <Button
                            size="sm"
                            variant="champagne"
                            onClick={async () => {
                              const id = await uid();
                              const path = `${id}/tryon/model/studio-default.jpg`;
                              if (typeof window !== "undefined") {
                                sessionStorage.setItem(`vestara_img_${path}`, studioModelUrl);
                              }
                              const modelRecord = {
                                user_id: id,
                                photo_path: path,
                                consent_at: new Date().toISOString(),
                                onboarding_done: true,
                                updated_at: new Date().toISOString(),
                              };
                              if (typeof window !== "undefined") {
                                localStorage.setItem(
                                  `vestara_model_${id}`,
                                  JSON.stringify(modelRecord),
                                );
                              }
                              try {
                                await supabase.from("virtual_models").upsert(modelRecord);
                              } catch {
                                // offline
                              }
                              qc.setQueryData(["virtual-model"], modelRecord);
                              toast.success("VÉSTARA Studio Model ready");
                            }}
                          >
                            <Sparkles className="size-3.5" /> Use Studio Model
                          </Button>
                          <Button size="sm" variant="quiet" onClick={() => setChangeModel(true)}>
                            <Upload className="size-3.5" /> Upload Your Photo
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {url(photo)?.includes("studio-default")
                        ? "VÉSTARA Studio Model"
                        : "Your private model photo"}
                    </span>
                    <button
                      className="underline text-foreground hover:text-bronze"
                      onClick={() => setChangeModel(true)}
                    >
                      Change photo
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  <span>{error}</span>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => run.mutate(active && refineText ? { refine: active } : {})}
                  >
                    <RotateCcw className="size-3.5" /> Retry
                  </Button>
                </div>
              )}

              {/* Informational banner about API requirements and demo simulation */}
              <div className="mt-6 rounded-2xl border bg-secondary/50 p-3.5 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Info className="size-4 shrink-0 text-bronze mt-0.5" />
                  <div>
                    <strong className="text-foreground">AI Photo Try-On Notice:</strong> Realistic
                    photo-based clothing transfer requires an appropriate generative diffusion model
                    or cloud image API. When external API credits are unconfigured, VÉSTARA runs a
                    simulated demo preview with complete fashion-tech styling analysis so you can
                    test the full workflow without incurring paid charges.
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Clothing Selection & Studio Controls */}
        <aside className="flex flex-col space-y-5 rounded-3xl border bg-card p-5 shadow-soft">
          <div>
            <h2 className="font-display text-2xl font-normal">Clothing Selection</h2>
            <p className="text-xs text-muted-foreground">
              Select garments from your wardrobe, saved looks, or upload new pieces.
            </p>
          </div>

          {/* Model Status Card */}
          <div className="flex items-center gap-3 rounded-2xl border bg-surface/70 p-3">
            {url(photo) ? (
              <img src={url(photo)} alt="" className="size-12 rounded-xl object-cover" />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-xl bg-secondary">
                <Camera className="size-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 text-xs">
              <p className="font-medium text-foreground">
                {url(photo) ? "Your Model Photo Active" : "No Photo Uploaded"}
              </p>
              <button
                className="text-bronze underline"
                onClick={() => {
                  setViewMode("photo");
                  setChangeModel(true);
                }}
              >
                {url(photo) ? "Change full-body photo" : "Upload photo"}
              </button>
            </div>
          </div>

          {/* Selection Source Tabs */}
          <div className="flex rounded-full border bg-secondary/50 p-1 text-xs">
            <button
              onClick={() => setClothingTab("wardrobe")}
              className={cn(
                "flex-1 rounded-full py-1 text-center font-medium transition-colors",
                clothingTab === "wardrobe"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Wardrobe
            </button>
            <button
              onClick={() => setClothingTab("outfits")}
              className={cn(
                "flex-1 rounded-full py-1 text-center font-medium transition-colors",
                clothingTab === "outfits"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Saved Looks
            </button>
            <button
              onClick={() => setClothingTab("upload")}
              className={cn(
                "flex-1 rounded-full py-1 text-center font-medium transition-colors",
                clothingTab === "upload"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Upload / Custom
            </button>
          </div>

          {/* TAB 1: EXISTING WARDROBE ITEMS */}
          {clothingTab === "wardrobe" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Pick from Your Closet</span>
                <span className="text-muted-foreground">{(wardrobe.data ?? []).length} items</span>
              </div>

              {(wardrobe.data ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <Shirt className="mx-auto mb-2 size-6 text-taupe" />
                  <p>Your wardrobe is empty.</p>
                  <p className="mt-1">Add clothes in the Wardrobe tab or use custom upload.</p>
                </div>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {wardrobe.data?.map((item) => {
                    const isSelected = selectedWardrobeItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectWardrobeItem(item)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-all",
                          isSelected
                            ? "border-primary bg-secondary/80 ring-1 ring-primary"
                            : "bg-surface/50 hover:bg-surface",
                        )}
                      >
                        <div className="size-12 overflow-hidden rounded-xl bg-background">
                          <ItemImage
                            item={item}
                            signedUrls={wardrobeSigned.data}
                            className="h-full w-full"
                          />
                        </div>
                        <div className="min-w-0 flex-1 text-xs">
                          <p className="truncate font-medium text-foreground">{item.name}</p>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="capitalize">{item.category}</span>
                            {item.main_color && (
                              <>
                                <span>·</span>
                                <span className="capitalize">{item.main_color}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="size-4 shrink-0 text-bronze" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SAVED OUTFITS */}
          {clothingTab === "outfits" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Pick an Outfit Look</span>
                <span className="text-muted-foreground">{(outfits.data ?? []).length} looks</span>
              </div>

              {(outfits.data ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                  <Sparkles className="mx-auto mb-2 size-6 text-taupe" />
                  <p>No outfits generated yet.</p>
                  <p className="mt-1">
                    Generate outfits in the Looks tab to try on full ensembles.
                  </p>
                </div>
              ) : (
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {outfits.data?.map((look) => {
                    return (
                      <button
                        key={look.id}
                        onClick={() => {
                          const pieceNames = look.pieces.map((p) => p.item.name).join(", ");
                          setDescription(`${look.occasion} outfit: ${pieceNames}`);
                          setOccasion(look.occasion.toLowerCase());

                          // Sync colors to 3D avatar
                          look.pieces.forEach((p) => {
                            const hex = colorNameToHex(p.item.main_color);
                            if (p.slot === "top" && hex) setAvatarTopColor(hex);
                            if (p.slot === "bottom" && hex) setAvatarBottomColor(hex);
                            if (p.slot === "outerwear" && hex) {
                              setAvatarOuterwearColor(hex);
                              setAvatarHasOuterwear(true);
                            }
                            if (p.slot === "shoes" && hex) setAvatarShoesColor(hex);
                          });

                          toast.success(
                            `Selected ${look.occasion} look (${look.pieces.length} pieces)`,
                          );
                        }}
                        className="flex w-full items-center justify-between rounded-2xl border bg-surface/50 p-2.5 text-left text-xs transition-colors hover:bg-surface"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium capitalize text-foreground">
                            {look.occasion} Look
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {look.pieces.map((p) => p.item.name).join(" + ")}
                          </p>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UPLOAD CLOTHING PHOTO OR DESCRIBE */}
          {clothingTab === "upload" && (
            <div className="space-y-3">
              <input
                ref={garmentInput}
                type="file"
                accept={TYPES.join(",")}
                className="hidden"
                onChange={(e) => pickGarment(e.target.files?.[0])}
              />
              {garmentPreview ? (
                <div className="flex items-center gap-3 rounded-2xl border bg-surface p-2.5">
                  <img
                    src={garmentPreview}
                    alt="Clothing"
                    className="size-16 rounded-xl object-cover"
                  />
                  <div className="flex flex-col items-start gap-1">
                    <Button size="sm" variant="quiet" onClick={() => garmentInput.current?.click()}>
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setGarment(null);
                        setGarmentPreview(null);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="quiet"
                  className="w-full"
                  onClick={() => garmentInput.current?.click()}
                >
                  <Upload /> Upload shirt, dress, jacket photo…
                </Button>
              )}
            </div>
          )}

          {/* Active Garment Selection Card */}
          {(garmentPreview || selectedWardrobeItem) && (
            <div className="flex items-center gap-3 rounded-2xl border border-bronze/30 bg-champagne/15 p-2.5">
              {garmentPreview ? (
                <img
                  src={garmentPreview}
                  alt="Selected clothing"
                  className="size-14 rounded-xl object-cover border bg-surface"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded-xl bg-surface border">
                  <Shirt className="size-6 text-bronze" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full bg-bronze/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-bronze">
                    Selected Piece
                  </span>
                  <span className="text-[10px] text-muted-foreground">Ready for Try-On</span>
                </div>
                <p className="mt-1 truncate text-xs font-medium text-foreground">
                  {selectedWardrobeItem?.name || garment?.name || "Garment Photo"}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setGarment(null);
                  setGarmentPreview(null);
                  setSelectedWardrobeItem(null);
                  setDescription("");
                }}
                title="Clear piece"
              >
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          )}

          {/* Selected Item / Description Summary */}
          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Outfit Description / Selected Pieces
            </label>
            <Textarea
              value={description}
              maxLength={600}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. A crisp white linen shirt with indigo denim trousers"
              className="text-xs"
            />
          </div>

          {/* Occasion Selection */}
          <div>
            <label className="mb-1.5 block text-xs font-medium">Occasion</label>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((o) => (
                <button
                  key={o}
                  onClick={() => setOccasion(o)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs capitalize transition-all",
                    occasion === o
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Extras / Styling details */}
          <div>
            <label className="mb-1.5 block text-xs font-medium">
              Accessories & Footwear <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              value={extras}
              maxLength={300}
              onChange={(e) => setExtras(e.target.value)}
              placeholder="e.g. white sneakers, leather watch, sunglasses"
              className="text-xs"
            />
          </div>

          {/* Action Button: Photo Try-On */}
          <Button
            variant="hero"
            className="w-full"
            disabled={run.isPending || (!garment && !selectedWardrobeItem && !description.trim())}
            onClick={() => {
              setViewMode("photo");
              run.mutate({});
            }}
          >
            <Wand2 /> {run.isPending ? "Generating Look…" : "Generate Photo-Based Look"}
          </Button>

          {/* Privacy & Cleanup */}
          <div className="pt-2 text-center">
            <button
              className="text-[11px] text-destructive/80 hover:underline"
              onClick={removePhotoAndLooks}
            >
              Delete my model photo and generated looks
            </button>
          </div>
        </aside>
      </div>

      {/* Generated Looks History Grid */}
      {!!looks.data?.length && (
        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-normal">Your Try-On Gallery</h2>
            <span className="text-xs text-muted-foreground">
              {looks.data.length} generated looks
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {looks.data.map((l) => (
              <button
                key={l.id}
                onClick={() => {
                  setActiveId(l.id);
                  setViewMode("photo");
                  resultRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border text-left transition-all hover:shadow-soft",
                  activeId === l.id && "ring-2 ring-primary ring-offset-1",
                )}
              >
                {url(l.result_path) ? (
                  <img
                    src={url(l.result_path)}
                    alt={l.styling.outfit_name ?? "Generated look"}
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="aspect-[3/4] bg-secondary" />
                )}
                <div className="p-2 text-xs">
                  <p className="truncate font-medium">
                    {l.styling.outfit_name || l.description || "Look"}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="capitalize">{l.occasion ?? "casual"}</span>
                    {l.saved && <span className="font-medium text-bronze">Saved</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ---------- Result View Component ----------

function ResultView({
  look,
  before,
  after,
}: {
  look: Look;
  before?: string | undefined;
  after?: string | undefined;
}) {
  const [pos, setPos] = useState(50);
  const [big, setBig] = useState(false);
  const s = look.styling;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Before / After Slider Viewport */}
      <div>
        <div className="relative mx-auto aspect-[3/4] max-h-[70vh] overflow-hidden rounded-2xl bg-secondary shadow-soft">
          {after && (
            <img
              src={after}
              alt="AI preview of outfit"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {before && (
            <img
              src={before}
              alt="Original photo"
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 bg-background shadow-md"
            style={{ left: `${pos}%` }}
          />
          <span className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm">
            Original
          </span>
          <span className="absolute right-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider backdrop-blur-sm">
            {s.isDemo ? "Demo Preview" : "AI Preview"}
          </span>
          <button
            onClick={() => setBig(true)}
            aria-label="View larger"
            className="absolute bottom-3 right-3 rounded-full bg-background/85 p-2 shadow-xs backdrop-blur-sm hover:bg-background"
          >
            <Maximize2 className="size-4" />
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Before and after comparison slider"
          className="mt-3.5 w-full accent-[var(--primary)]"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <button onClick={() => setPos(100)} className="hover:text-foreground">
            Original View
          </button>
          <button onClick={() => setPos(0)} className="hover:text-foreground">
            Outfit Preview
          </button>
        </div>
      </div>

      {/* Styling Notes and Details */}
      <div className="space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="eyebrow">
            {s.isDemo ? "Simulated Demo Preview" : "AI Styling Analysis"}
          </span>
          {s.isDemo && (
            <span className="rounded-full bg-champagne/30 px-2 py-0.5 text-[10px] font-semibold text-bronze">
              DEMO
            </span>
          )}
        </div>

        <h3 className="font-display text-3xl">{s.outfit_name || "Curated Look"}</h3>

        {look.description && (
          <p className="text-muted-foreground">
            {look.description}
            {look.occasion ? ` · ${look.occasion}` : ""}
          </p>
        )}

        {s.styling_reason ? (
          <p className="text-xs leading-relaxed text-foreground/90">{s.styling_reason}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Styling notes were not provided for this look.
          </p>
        )}

        <List title="Recommended Footwear" items={s.footwear} />
        <List title="Accessories" items={s.accessories} />
        <List title="Alternative Combinations" items={s.alternatives} />
        <List title="Styling Tips" items={s.styling_tips} />
      </div>

      <Dialog open={big} onOpenChange={setBig}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">AI preview</DialogTitle>
          {after && (
            <img
              src={after}
              alt="AI preview large"
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function List({ title, items }: { title: string; items?: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div className="text-xs">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
