import { useEffect, useRef, useState, useMemo } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Download,
  RotateCcw,
  Upload,
  Wand2,
  Shirt,
  Sparkles,
  Info,
  Check,
  AlertCircle,
  X,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Layers,
  Rotate3d,
  UserCheck,
  SlidersHorizontal,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { generateTryOn, generateVirtualTwin, generateRotatedViews } from "@/lib/tryon.functions";
import { wardrobeQuery, outfitsQuery, useSignedUrls } from "@/lib/queries";
import { ItemImage } from "@/components/wardrobe/ItemImage";
import { Avatar3DViewer } from "@/components/tryon/Avatar3DViewer";
import { BeforeAfterSlider } from "@/components/tryon/BeforeAfterSlider";
import { RotateViewViewer, type MultiAngleViews } from "@/components/tryon/RotateViewViewer";
import {
  validateTryOnPhoto,
  analyzePersonPhoto,
  type BodyProportions,
  getDefaultBodyProportions,
} from "@/lib/pose-analyzer";
import type { WardrobeItem } from "@/lib/domain";
import studioModelUrl from "@/assets/studio-model.jpg";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/try-on")({
  validateSearch: (search: Record<string, unknown>) => ({
    outfitId: typeof search.outfitId === "string" ? search.outfitId : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Virtual Try-On & Virtual Me — VÉSTARA" },
      {
        name: "description",
        content:
          "Preview outfits on your realistic Virtual Me twin or the 3D mannequin using Gemini AI.",
      },
      { property: "og:title", content: "Virtual Try-On & Virtual Me — VÉSTARA" },
      {
        property: "og:description",
        content:
          "Preview outfits on your realistic Virtual Me twin or the 3D mannequin using Gemini AI.",
      },
    ],
  }),
  component: VirtualTryOnPage,
});

interface LookStyling {
  outfit_name?: string;
  styling_reason?: string;
  footwear?: string[];
  accessories?: string[];
  alternatives?: string[];
  styling_tips?: string[];
}

interface TryOnLookRecord {
  id: string;
  person_path: string;
  garment_path: string | null;
  result_path: string;
  resultImageUri?: string | null;
  description: string;
  occasion: string | null;
  styling: LookStyling;
  created_at: string;
  warning?: string | null;
}

function VirtualTryOnPage() {
  const search = useSearch({ from: "/_authenticated/try-on" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Server functions
  const tryOnFn = useServerFn(generateTryOn);
  const virtualTwinFn = useServerFn(generateVirtualTwin);
  const rotateViewsFn = useServerFn(generateRotatedViews);

  // Queries
  const wardrobe = useQuery(wardrobeQuery);
  const outfits = useQuery(outfitsQuery());

  // Active Tab: "virtual-me" (Main realistic Twin tab) vs "mannequin" (Secondary 3D tab)
  const [activeTab, setActiveTab] = useState<"virtual-me" | "mannequin">(
    search.tab === "mannequin" ? "mannequin" : "virtual-me",
  );

  // User Uploaded Photo State (shared across tabs)
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [userPhotoDataUri, setUserPhotoDataUri] = useState<string | null>(null);
  const [userPhotoFile, setUserPhotoFile] = useState<File | null>(null);
  const [proportions, setProportions] = useState<BodyProportions | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Virtual Twin State (Generated base studio twin)
  const [virtualTwinUri, setVirtualTwinUri] = useState<string | null>(null);
  const [isGeneratingTwin, setIsGeneratingTwin] = useState(false);
  const [twinError, setTwinError] = useState<string | null>(null);

  // Drag and Drop State
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Selected Outfit / Garments State
  const [selectedOutfitId, setSelectedOutfitId] = useState<string | null>(search.outfitId ?? null);
  const [selectedWardrobeItem, setSelectedWardrobeItem] = useState<WardrobeItem | null>(null);
  const [customDescription, setCustomDescription] = useState("");
  const [selectedOccasion, setSelectedOccasion] = useState<string>("casual");

  // Try-On Result State
  const [generatedLook, setGeneratedLook] = useState<TryOnLookRecord | null>(null);
  const [tryOnError, setTryOnError] = useState<string | null>(null);

  // Rotate View (3D-feel 4 angles) State
  const [activeViewMode, setActiveViewMode] = useState<"slider" | "rotate">("slider");
  const [rotatedViews, setRotatedViews] = useState<MultiAngleViews | null>(null);
  const [isGeneratingRotateViews, setIsGeneratingRotateViews] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);

  // Cached generated looks to avoid re-running when switching tabs
  const cachedLooksRef = useRef<Map<string, TryOnLookRecord>>(new Map());

  // Load cached photo and virtual twin from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedPhoto = localStorage.getItem("vestara_user_tryon_photo");
    const cachedTwin = localStorage.getItem("vestara_user_virtual_twin");
    const cachedProportions = localStorage.getItem("vestara_user_proportions");

    if (cachedPhoto && !userPhotoUrl) {
      setUserPhotoUrl(cachedPhoto);
      setUserPhotoDataUri(cachedPhoto);
      if (cachedTwin) setVirtualTwinUri(cachedTwin);
      if (cachedProportions) {
        try {
          setProportions(JSON.parse(cachedProportions));
        } catch {
          // ignore
        }
      }
    }
  }, [userPhotoUrl]);

  // Sync selectedOutfitId with search param
  useEffect(() => {
    if (search.outfitId && search.outfitId !== selectedOutfitId) {
      setSelectedOutfitId(search.outfitId);
    }
  }, [search.outfitId, selectedOutfitId]);

  // Find active outfit object
  const activeOutfit = useMemo(() => {
    if (!selectedOutfitId || !outfits.data) return null;
    return outfits.data.find((o) => o.id === selectedOutfitId) ?? null;
  }, [selectedOutfitId, outfits.data]);

  // Derive Garment Colors for 3D Mannequin from active outfit or selected item
  const avatarColors = useMemo(() => {
    let topColor = "#FFFFFF";
    let bottomColor = "#22334F";
    let outerwearColor = "#1B2A4A";
    let shoesColor = "#F5F5F7";
    let hasOuterwear = false;

    if (activeOutfit) {
      for (const piece of activeOutfit.pieces) {
        const hex = piece.item.main_color ? colorNameToHex(piece.item.main_color) : undefined;
        if (piece.slot === "top" && hex) topColor = hex;
        if (piece.slot === "bottom" && hex) bottomColor = hex;
        if (piece.slot === "outerwear" && hex) {
          outerwearColor = hex;
          hasOuterwear = true;
        }
        if (piece.slot === "shoes" && hex) shoesColor = hex;
      }
    } else if (selectedWardrobeItem) {
      const hex = colorNameToHex(selectedWardrobeItem.main_color);
      if (hex) {
        if (selectedWardrobeItem.category === "tops") topColor = hex;
        if (selectedWardrobeItem.category === "bottoms") bottomColor = hex;
        if (selectedWardrobeItem.category === "outerwear") {
          outerwearColor = hex;
          hasOuterwear = true;
        }
        if (selectedWardrobeItem.category === "shoes") shoesColor = hex;
      }
    }

    return { topColor, bottomColor, outerwearColor, shoesColor, hasOuterwear };
  }, [activeOutfit, selectedWardrobeItem]);

  // Effective description for try-on
  const effectiveDescription = useMemo(() => {
    if (customDescription.trim()) return customDescription.trim();
    if (activeOutfit) {
      const pieceNames = activeOutfit.pieces.map((p) => p.item.name).join(", ");
      return `${activeOutfit.explanation || activeOutfit.mood || "Curated ensemble"} (${pieceNames})`;
    }
    if (selectedWardrobeItem) {
      return `${selectedWardrobeItem.name} in ${selectedWardrobeItem.main_color} (${selectedWardrobeItem.category})`;
    }
    return "Curated style ensemble";
  }, [customDescription, activeOutfit, selectedWardrobeItem]);

  // Image URLs for garments
  const garmentUrls = useMemo(() => {
    const list: string[] = [];
    if (activeOutfit) {
      for (const p of activeOutfit.pieces) {
        if (p.item.image_path) list.push(p.item.image_path);
      }
    } else if (selectedWardrobeItem?.image_path) {
      list.push(selectedWardrobeItem.image_path);
    }
    return list;
  }, [activeOutfit, selectedWardrobeItem]);

  const signedGarments = useSignedUrls(garmentUrls);

  // 1. Process Uploaded Photo and 2. Generate Virtual Twin
  const processUploadedFile = async (file: File) => {
    setUploadError(null);
    setTwinError(null);
    const validation = validateTryOnPhoto(file);
    if (!validation.valid) {
      setUploadError(validation.error ?? "Invalid photo file.");
      toast.error(validation.error ?? "Invalid photo file.");
      return;
    }

    setUserPhotoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setUserPhotoUrl(objectUrl);

    // Reset previous generated look
    setGeneratedLook(null);
    setRotatedViews(null);
    setActiveViewMode("slider");

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUri = reader.result as string;
      setUserPhotoDataUri(dataUri);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("vestara_user_tryon_photo", dataUri);
        } catch {
          // ignore quota
        }
      }

      // Analyze proportions in browser
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          const result = await analyzePersonPhoto(img);
          setProportions(result);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("vestara_user_proportions", JSON.stringify(result));
            } catch {
              // ignore
            }
          }
        };
        img.src = dataUri;
      } catch (err) {
        console.warn("Pose landmark warning:", err);
      }

      // Generate Virtual Twin with Gemini model
      setIsGeneratingTwin(true);
      try {
        const res = await virtualTwinFn({
          data: { photoPath: dataUri },
        });

        if (res.twinImageUri) {
          setVirtualTwinUri(res.twinImageUri);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("vestara_user_virtual_twin", res.twinImageUri);
            } catch {
              // ignore
            }
          }
          toast.success("Virtual Me twin synthesized successfully!");
        } else {
          setVirtualTwinUri(dataUri);
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to synthesize Virtual Me twin. Using original photo.";
        console.warn("Twin generation fallback:", msg);
        setVirtualTwinUri(dataUri);
        setTwinError(msg);
      } finally {
        setIsGeneratingTwin(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const handleClearPhoto = () => {
    setUserPhotoUrl(null);
    setUserPhotoDataUri(null);
    setUserPhotoFile(null);
    setVirtualTwinUri(null);
    setProportions(null);
    setGeneratedLook(null);
    setRotatedViews(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("vestara_user_tryon_photo");
      localStorage.removeItem("vestara_user_virtual_twin");
      localStorage.removeItem("vestara_user_proportions");
    }
    toast.info("Photo cleared. Reset to default studio model.");
  };

  // 3. OUTFIT TRY-ON MUTATION
  const tryOnMutation = useMutation({
    mutationFn: async () => {
      setTryOnError(null);
      const photoToUse = virtualTwinUri || userPhotoDataUri || studioModelUrl;

      // Check cache first
      const cacheKey = `${photoToUse.slice(0, 40)}_${effectiveDescription}`;
      const cached = cachedLooksRef.current.get(cacheKey);
      if (cached) {
        return { id: cached.id, look: cached };
      }

      let garmentPath: string | null = null;
      if (activeOutfit && activeOutfit.pieces[0]?.item.image_path) {
        garmentPath = activeOutfit.pieces[0].item.image_path;
      } else if (selectedWardrobeItem?.image_path) {
        garmentPath = selectedWardrobeItem.image_path;
      }

      const response = await tryOnFn({
        data: {
          personPath: photoToUse,
          garmentPath: garmentPath,
          description: effectiveDescription,
          occasion: selectedOccasion,
          extras: null,
          parentId: activeOutfit?.id ?? null,
        },
      });

      const result = response as { id: string; look: TryOnLookRecord };
      cachedLooksRef.current.set(cacheKey, result.look);
      return result;
    },
    onSuccess: (data) => {
      setGeneratedLook(data.look);
      setRotatedViews(null);
      setActiveViewMode("slider");
      queryClient.invalidateQueries({ queryKey: ["tryon-looks"] });
      toast.success("Outfit fitted on your Virtual Me!");
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to dress Virtual Me. Please verify photo lighting and retry.";
      setTryOnError(msg);
      toast.error(msg);
    },
  });

  // 4. ROTATE VIEW (On-Demand 4 Angles)
  const handleGenerateRotateViews = async () => {
    const frontImage = generatedLook?.resultImageUri || virtualTwinUri || userPhotoDataUri;
    if (!frontImage) {
      toast.error("Please generate a try-on look first before rotating.");
      return;
    }

    setIsGeneratingRotateViews(true);
    setRotateError(null);

    try {
      const res = await rotateViewsFn({
        data: {
          frontImage,
          description: effectiveDescription,
        },
      });

      setRotatedViews(res.views);
      setActiveViewMode("rotate");
      toast.success("360° views generated! Drag or use arrows to rotate.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not generate rotated angles.";
      setRotateError(msg);
      toast.error(msg);
    } finally {
      setIsGeneratingRotateViews(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="VÉSTARA Studio"
        title="Virtual Try-On"
        body="Experience garments on your realistic Virtual Me twin or the interactive 3D mannequin. Powered by Google Gemini image editing."
      />

      {/* 1. PHOTO UPLOAD SECTION (TOP) */}
      <section className="mb-8 rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-tight text-foreground">
              Your Reference Photo
            </h2>
            <p className="text-xs text-muted-foreground">
              Powers your realistic "Virtual Me" twin and personalized 3D mannequin proportions.
            </p>
          </div>
          {userPhotoUrl && (
            <Button
              variant="quiet"
              size="sm"
              onClick={handleClearPhoto}
              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <X className="size-3.5" /> Remove Photo
            </Button>
          )}
        </div>

        {!userPhotoUrl ? (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all",
                isDragOver
                  ? "border-bronze bg-champagne/20 scale-[0.99]"
                  : "border-border hover:border-bronze/60 hover:bg-surface/50",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="mb-3 flex size-14 items-center justify-center rounded-full bg-secondary text-foreground group-hover:scale-105 transition-transform">
                <Upload className="size-6 text-bronze" />
              </div>

              <p className="text-sm font-medium text-foreground">
                Drag & drop your full-body photo here, or{" "}
                <span className="text-bronze underline underline-offset-2">browse files</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Supports JPG, PNG, WebP up to 10MB
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="champagne"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Camera className="size-3.5" /> Take Photo with Camera
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserPhotoUrl(studioModelUrl);
                    setUserPhotoDataUri(studioModelUrl);
                    setVirtualTwinUri(studioModelUrl);
                    setProportions(getDefaultBodyProportions());
                    toast.info("Loaded VÉSTARA Studio model template.");
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5 text-bronze" /> Use Studio Template
                </Button>
              </div>
            </div>

            {/* Upload Tips */}
            <div className="mt-4 rounded-xl bg-surface/60 p-3.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Tips for best results: </span>
              Front-facing, full body, plain background, good lighting.
            </div>

            {uploadError && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>
        ) : (
          /* Uploaded Photo & Virtual Twin Preview */
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border bg-surface shadow-sm">
              <img
                src={virtualTwinUri || userPhotoUrl}
                alt="Your Virtual Me Twin"
                className="h-full w-full object-cover object-top"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-center text-[11px] text-white">
                {virtualTwinUri && virtualTwinUri !== userPhotoUrl
                  ? "Synthesized Virtual Me Twin"
                  : "Original Uploaded Photo"}
              </div>
            </div>

            <div className="flex flex-col justify-between space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="champagne" className="gap-1">
                    <UserCheck className="size-3 text-emerald-600" />
                    {virtualTwinUri && virtualTwinUri !== userPhotoUrl
                      ? "Virtual Me Ready"
                      : "Photo Uploaded"}
                  </Badge>

                  {isGeneratingTwin && (
                    <Badge variant="outline" className="animate-pulse gap-1 text-bronze">
                      <Sparkles className="size-3 animate-spin" /> Synthesizing Virtual Me Twin…
                    </Badge>
                  )}
                </div>

                {proportions?.warning && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium">Cropped / Partial Photo Detected</p>
                      <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
                        {proportions.warning} Lower body extended naturally for Virtual Me.
                      </p>
                    </div>
                  </div>
                )}

                {twinError && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                    <Info className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                    <span>{twinError}</span>
                  </div>
                )}

                {/* Photo Quality Checklist */}
                <div className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Photo Quality Verification
                  </h3>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <QualityItem
                      label="Full body visible"
                      passed={proportions?.qualityChecklist.fullBodyVisible ?? false}
                    />
                    <QualityItem
                      label="Arms relaxed at sides"
                      passed={proportions?.qualityChecklist.armsRelaxed ?? true}
                    />
                    <QualityItem
                      label="Plain background"
                      passed={proportions?.qualityChecklist.plainBackground ?? true}
                    />
                    <QualityItem
                      label="Good lighting"
                      passed={proportions?.qualityChecklist.goodLighting ?? true}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="size-3.5" /> Upload Different Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* TABS SELECTOR (Virtual Me vs 3D Mannequin) */}
      <div className="mb-6 flex border-b border-border/80">
        <button
          onClick={() => setActiveTab("virtual-me")}
          className={cn(
            "relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors",
            activeTab === "virtual-me"
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="size-4 text-bronze" />
          <span>Virtual Me</span>
          <Badge variant="champagne" className="text-[10px] px-1.5 py-0 font-normal">
            Realistic Twin
          </Badge>
          {activeTab === "virtual-me" && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-bronze" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("mannequin")}
          className={cn(
            "relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors",
            activeTab === "mannequin"
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="size-4 text-bronze" />
          <span>3D Mannequin</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
            Secondary
          </Badge>
          {activeTab === "mannequin" && (
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-bronze" />
          )}
        </button>
      </div>

      {/* OUTFIT & GARMENT SELECTOR PANEL */}
      <section className="mb-8 rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg tracking-tight text-foreground">
              Select Outfit or Garment to Try On
            </h3>
            <p className="text-xs text-muted-foreground">
              Pick from AI Stylist combinations, saved outfits, or your personal wardrobe.
            </p>
          </div>
          {activeOutfit && (
            <Badge variant="champagne" className="gap-1 text-xs">
              <Sparkles className="size-3" /> Loaded:{" "}
              {activeOutfit.explanation?.slice(0, 32) || "Stylist Outfit"}
            </Badge>
          )}
        </div>

        {/* Saved & Recommended Outfits */}
        {outfits.data && outfits.data.length > 0 && (
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              From Your Stylist & Recommendations
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {outfits.data.map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedOutfitId(o.id);
                    setSelectedWardrobeItem(null);
                    setCustomDescription("");
                    setGeneratedLook(null);
                    setRotatedViews(null);
                    setActiveViewMode("slider");
                  }}
                  className={cn(
                    "flex min-w-[240px] max-w-[280px] flex-col rounded-2xl border p-3 text-left transition-all",
                    selectedOutfitId === o.id
                      ? "border-bronze bg-champagne/15 shadow-sm ring-1 ring-bronze"
                      : "border-border bg-surface hover:border-bronze/40",
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground capitalize">
                      {o.occasion || "Look"}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {o.pieces.length} pieces
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {o.explanation || o.mood || "Curated ensemble"}
                  </p>
                  <div className="mt-2.5 flex items-center gap-1.5 overflow-hidden">
                    {o.pieces.map((p) => (
                      <span
                        key={p.slot}
                        className="size-3.5 rounded-full border border-border/80 shadow-xs"
                        style={{
                          backgroundColor: colorNameToHex(p.item.main_color) || "#ddd",
                        }}
                        title={`${p.item.name} (${p.item.main_color})`}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* My Wardrobe Items */}
        {wardrobe.data && wardrobe.data.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Or Pick Individual Wardrobe Item
            </p>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              {wardrobe.data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedWardrobeItem(item);
                    setSelectedOutfitId(null);
                    setCustomDescription("");
                    setGeneratedLook(null);
                    setRotatedViews(null);
                    setActiveViewMode("slider");
                  }}
                  className={cn(
                    "flex min-w-[130px] flex-col items-center rounded-2xl border p-2 text-center transition-all",
                    selectedWardrobeItem?.id === item.id
                      ? "border-bronze bg-champagne/15 ring-1 ring-bronze"
                      : "border-border bg-surface hover:border-bronze/40",
                  )}
                >
                  <div className="size-16 overflow-hidden rounded-xl bg-card">
                    <ItemImage item={item} signedUrls={signedGarments.data} />
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs font-medium text-foreground">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {item.category} · {item.main_color}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Outfit Description */}
        <div className="mt-3">
          <label className="text-xs font-medium text-foreground">
            Optional outfit description or styling prompt:
          </label>
          <Textarea
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
            placeholder="e.g. Navy slim-fit blazer layered over a crisp white crewneck tee and tailored charcoal trousers."
            className="mt-1 h-18 text-xs"
          />
        </div>
      </section>

      {/* 2. VIRTUAL ME MAIN TAB */}
      {activeTab === "virtual-me" && (
        <section className="fade-up space-y-6">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* Viewport Area */}
            <div className="flex flex-col items-center justify-center rounded-3xl border border-border/80 bg-card p-6 shadow-soft">
              {tryOnMutation.isPending ? (
                /* Loading Skeleton */
                <div className="flex aspect-[3/4] w-full max-w-lg flex-col items-center justify-center rounded-3xl border border-bronze/30 bg-surface/80 p-8 text-center animate-pulse">
                  <div className="relative mb-6">
                    <div className="size-16 animate-spin rounded-full border-4 border-bronze/20 border-t-bronze" />
                    <Sparkles className="absolute inset-0 m-auto size-6 text-bronze" />
                  </div>
                  <h3 className="font-display text-xl text-foreground">
                    Dressing Your Virtual Me…
                  </h3>
                  <p className="mt-2 max-w-sm text-xs text-muted-foreground leading-relaxed">
                    Gemini AI is fitting the selected garments to your Virtual Me twin with
                    realistic fabric drape, natural folds, and studio lighting.
                  </p>
                </div>
              ) : generatedLook && generatedLook.resultImageUri ? (
                /* Result View (Slider or 4-Angle Rotate View) */
                <div className="w-full max-w-lg flex flex-col items-center">
                  {/* Mode Selector Toggle (Before/After vs 360 Rotate View) */}
                  <div className="mb-4 flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 rounded-full border bg-surface p-1 text-xs">
                      <button
                        onClick={() => setActiveViewMode("slider")}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
                          activeViewMode === "slider"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <SlidersHorizontal className="size-3.5" />
                        <span>Before / After</span>
                      </button>

                      <button
                        onClick={() => {
                          if (!rotatedViews) {
                            handleGenerateRotateViews();
                          } else {
                            setActiveViewMode("rotate");
                          }
                        }}
                        disabled={isGeneratingRotateViews}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
                          activeViewMode === "rotate"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Rotate3d
                          className={cn("size-3.5", isGeneratingRotateViews && "animate-spin")}
                        />
                        <span>
                          {isGeneratingRotateViews
                            ? "Generating 360°…"
                            : rotatedViews
                              ? "360° Rotate View"
                              : "Rotate view"}
                        </span>
                      </button>
                    </div>

                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => {
                        setGeneratedLook(null);
                        setRotatedViews(null);
                        setActiveViewMode("slider");
                      }}
                      className="gap-1.5 text-xs"
                    >
                      <RefreshCw className="size-3" /> Try Another Outfit
                    </Button>
                  </div>

                  {/* Viewport Component */}
                  {activeViewMode === "slider" ? (
                    <BeforeAfterSlider
                      beforeImage={virtualTwinUri || userPhotoUrl || studioModelUrl}
                      afterImage={generatedLook.resultImageUri}
                      outfitName={generatedLook.styling?.outfit_name || effectiveDescription}
                      onTryAnotherOutfit={() => {
                        setGeneratedLook(null);
                        setRotatedViews(null);
                        setActiveViewMode("slider");
                      }}
                    />
                  ) : rotatedViews ? (
                    <RotateViewViewer
                      views={rotatedViews}
                      outfitName={generatedLook.styling?.outfit_name || effectiveDescription}
                    />
                  ) : (
                    /* Loading state for rotate views */
                    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-3xl border border-bronze/30 bg-surface/80 p-8 text-center">
                      <Rotate3d className="size-10 animate-spin text-bronze mb-4" />
                      <h4 className="font-display text-lg">Generating 4 Perspectives…</h4>
                      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                        Rendering front, left profile, back, and right profile angles.
                      </p>
                    </div>
                  )}

                  {rotateError && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                      <AlertCircle className="size-3.5 shrink-0 text-amber-600" />
                      <span>{rotateError}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Ready State */
                <div className="flex aspect-[3/4] w-full max-w-lg flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface/50 p-6 text-center">
                  <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-secondary text-bronze">
                    <Sparkles className="size-6" />
                  </div>
                  <h3 className="font-display text-lg text-foreground">
                    Virtual Me Ready for Try-On
                  </h3>
                  <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">
                    {virtualTwinUri
                      ? "Your realistic twin is ready. Click below to dress in the selected garments."
                      : "Upload your photo above to create your Virtual Me twin, or try with our studio template."}
                  </p>

                  <Button
                    variant="hero"
                    size="lg"
                    className="mt-6 gap-2"
                    disabled={tryOnMutation.isPending}
                    onClick={() => tryOnMutation.mutate()}
                  >
                    <Wand2 className="size-4" /> Dress My Virtual Me
                  </Button>
                </div>
              )}

              {/* Error Callout with Retry */}
              {tryOnError && (
                <div className="mt-4 flex w-full max-w-lg items-start justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Generation Notice</p>
                      <p className="mt-0.5 text-destructive/90">{tryOnError}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="quiet"
                    onClick={() => tryOnMutation.mutate()}
                    className="shrink-0 gap-1 text-destructive hover:bg-destructive/15"
                  >
                    <RotateCcw className="size-3.5" /> Retry
                  </Button>
                </div>
              )}

              {/* 6. QUALITY DISCLAIMER NOTE */}
              <div className="mt-6 text-center text-[11px] text-muted-foreground">
                Images are AI-generated previews. Fit and color may differ slightly from the real
                garment.
              </div>
            </div>

            {/* Stylist Insights Column */}
            <div className="space-y-4">
              <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-soft">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bronze">
                  <Sparkles className="size-3.5" />
                  Stylist Look Intelligence
                </div>
                <h4 className="mt-2 font-display text-lg text-foreground">
                  {generatedLook?.styling?.outfit_name || "Curated Ensemble"}
                </h4>
                <p className="mt-2 text-xs leading-relaxed text-foreground/85">
                  {generatedLook?.styling?.styling_reason ||
                    "A tailored combination balancing clean vertical lines, functional layering, and occasion-appropriate contrast."}
                </p>

                {generatedLook?.styling?.footwear && generatedLook.styling.footwear.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Recommended Footwear
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-foreground/80">
                      {generatedLook.styling.footwear.map((fw, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="size-3 text-bronze" /> {fw}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {generatedLook?.styling?.accessories &&
                  generatedLook.styling.accessories.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Suggested Accessories
                      </p>
                      <ul className="mt-1 space-y-1 text-xs text-foreground/80">
                        {generatedLook.styling.accessories.map((acc, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="size-3 text-bronze" /> {acc}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                {generatedLook?.styling?.styling_tips &&
                  generatedLook.styling.styling_tips.length > 0 && (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Styling Tips
                      </p>
                      <ul className="mt-1 space-y-1 text-xs text-foreground/80">
                        {generatedLook.styling.styling_tips.map((tip, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="size-3 text-bronze" /> {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* SECONDARY TAB: 3D MANNEQUIN */}
      {activeTab === "mannequin" && (
        <section className="fade-up space-y-6">
          <Avatar3DViewer
            topColor={avatarColors.topColor}
            bottomColor={avatarColors.bottomColor}
            outerwearColor={avatarColors.outerwearColor}
            shoesColor={avatarColors.shoesColor}
            hasOuterwear={avatarColors.hasOuterwear}
            proportions={proportions}
            hasUserPhoto={Boolean(userPhotoUrl)}
            onUploadPhotoPrompt={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              fileInputRef.current?.click();
            }}
          />

          <div className="rounded-2xl border border-bronze/25 bg-champagne/20 p-4 text-xs text-foreground/90 backdrop-blur-sm">
            <p className="font-medium text-foreground">3D Mannequin Visualizer</p>
            <p className="mt-0.5 text-muted-foreground">
              3D Avatar is an approximate model built from your photo's proportions. For the most
              realistic look, use the <strong>Virtual Me</strong> tab.
            </p>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function QualityItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors",
        passed
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
          : "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200",
      )}
    >
      {passed ? (
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <XCircle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <span className="text-[11px]">{label}</span>
    </div>
  );
}

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
    burgundy: "#5C1D24",
    olive: "#5C6A53",
    green: "#293D31",
  };
  return map[n] ?? "#3A3D40";
}
