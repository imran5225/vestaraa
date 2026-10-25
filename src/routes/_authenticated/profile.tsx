import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  Check,
  CloudSun,
  Heart,
  Layers,
  Loader2,
  LogOut,
  Palette,
  RefreshCw,
  RotateCcw,
  Shirt,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorState, LoadingState, PageHeader } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORIES, COLORS, FITS, OCCASIONS, STYLES, type WardrobeItem } from "@/lib/domain";
import { currentUserId, feedbackQuery, profileQuery, wardrobeQuery } from "@/lib/queries";
import { resetDemoData } from "@/lib/styling.functions";
import { useSignOut } from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Smart Wardrobe Profile — VÉSTARA" },
      {
        name: "description",
        content: "Your wardrobe analytics, style intelligence, and personal preferences.",
      },
      { property: "og:title", content: "Smart Wardrobe Profile — VÉSTARA" },
      {
        property: "og:description",
        content: "Your wardrobe analytics, style intelligence, and personal preferences.",
      },
    ],
  }),
  component: ProfilePage,
});

type ProfileForm = {
  display_name: string;
  preferred_styles: string[];
  preferred_fits: string[];
  favorite_colors: string[];
  avoided_colors: string[];
  typical_occasions: string[];
  weather_enabled: boolean;
  weather_city: string;
  comfort_notes: string;
};

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email?.trim()) {
    return email.slice(0, 2).toUpperCase();
  }
  return "VÉ";
}

function ChipSelector({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-0.5">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((o) => {
          const active = value.includes(o);
          return (
            <button
              type="button"
              key={o}
              onClick={() => onChange(active ? value.filter((x) => x !== o) : [...value, o])}
              className={cn(
                "rounded-xl border px-3.5 py-1.5 text-xs capitalize transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-xs font-medium"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:border-bronze hover:text-foreground",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColorSelector({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-0.5">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {COLORS.map((c) => {
          const active = value.includes(c);
          return (
            <button
              type="button"
              key={c}
              onClick={() => onChange(active ? value.filter((x) => x !== c) : [...value, c])}
              className={cn(
                "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs capitalize transition-all",
                active
                  ? "border-bronze bg-bronze/10 text-foreground font-medium ring-1 ring-bronze/40"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:border-bronze/60 hover:text-foreground",
              )}
            >
              <span
                className="size-2.5 rounded-full border border-black/20 shadow-2xs"
                style={{
                  backgroundColor:
                    c === "white"
                      ? "#ffffff"
                      : c === "cream"
                        ? "#fdfbf7"
                        : c === "camel"
                          ? "#c19a6b"
                          : c === "navy"
                            ? "#000080"
                            : c === "olive"
                              ? "#808000"
                              : c === "burgundy"
                                ? "#800020"
                                : c === "light blue"
                                  ? "#add8e6"
                                  : c,
                }}
              />
              <span>{c}</span>
              {active && <Check className="size-3 text-bronze" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePage() {
  const profileQueryData = useQuery(profileQuery);
  const wardrobeQueryData = useQuery(wardrobeQuery);
  const feedbackQueryData = useQuery(feedbackQuery);
  const queryClient = useQueryClient();
  const resetFn = useServerFn(resetDemoData);
  const signOut = useSignOut();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm] = useState<ProfileForm | null>(null);

  // Synchronize form state from remote profile
  useEffect(() => {
    if (profileQueryData.data && !form) {
      setForm({
        display_name: profileQueryData.data.display_name ?? "",
        preferred_styles: profileQueryData.data.preferred_styles ?? [],
        preferred_fits: profileQueryData.data.preferred_fits ?? [],
        favorite_colors: profileQueryData.data.favorite_colors ?? [],
        avoided_colors: profileQueryData.data.avoided_colors ?? [],
        typical_occasions: profileQueryData.data.typical_occasions ?? [],
        weather_enabled: profileQueryData.data.weather_enabled ?? false,
        weather_city: profileQueryData.data.weather_city ?? "",
        comfort_notes: profileQueryData.data.comfort_notes ?? "",
      });
    }
  }, [profileQueryData.data, form]);

  // Profile preferences mutation
  const saveMutation = useMutation({
    mutationFn: async (v: ProfileForm) => {
      if (v.weather_enabled && !v.weather_city.trim()) {
        throw new Error("Please enter your city to enable live weather forecasts.");
      }
      const uid = await currentUserId();
      const { error } = await supabase.from("profiles").upsert({
        id: uid,
        display_name: v.display_name.trim() || null,
        preferred_styles: v.preferred_styles,
        preferred_fits: v.preferred_fits,
        favorite_colors: v.favorite_colors,
        avoided_colors: v.avoided_colors,
        typical_occasions: v.typical_occasions,
        weather_enabled: v.weather_enabled,
        weather_city: v.weather_city.trim() || null,
        comfort_notes: v.comfort_notes.trim() || null,
        onboarded: true,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["weather"] });
      toast.success("Profile preferences updated.");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update profile.");
    },
  });

  // Reset demo styling data mutation
  const resetMutation = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Styling history, chats, and feedback cleared.");
    },
    onError: () => toast.error("Reset operation failed."),
  });

  // Real avatar upload handling using Supabase Storage
  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file must be under 5 MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const uid = await currentUserId();
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${uid}/avatar-${Date.now()}.${ext}`;

      // Upload to wardrobe storage bucket under the user's folder
      const { error: uploadError } = await supabase.storage
        .from("wardrobe")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        throw uploadError;
      }

      // Record in virtual_models
      await supabase.from("virtual_models").upsert({
        user_id: uid,
        photo_path: filePath,
        updated_at: new Date().toISOString(),
      });

      // Update user metadata
      const { data: signed } = await supabase.storage
        .from("wardrobe")
        .createSignedUrl(filePath, 3600 * 24 * 365);

      if (signed?.signedUrl) {
        await supabase.auth.updateUser({
          data: { avatar_url: signed.signedUrl, photo_path: filePath },
        });
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["virtual-model"] });
      toast.success("Profile photo updated.");
    } catch (err: unknown) {
      console.error("Profile photo upload failed:", err);
      toast.error(
        "Could not upload photo. Photo storage requires the 'wardrobe' storage bucket in Supabase.",
      );
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Remove profile photo
  async function handleRemovePhoto() {
    setUploadingPhoto(true);
    try {
      const uid = await currentUserId();
      const photoPath = profileQueryData.data?.photo_path;

      if (photoPath) {
        await supabase.storage.from("wardrobe").remove([photoPath]);
      }

      await supabase
        .from("virtual_models")
        .update({ photo_path: null, updated_at: new Date().toISOString() })
        .eq("user_id", uid);

      await supabase.auth.updateUser({
        data: { avatar_url: null, photo_path: null },
      });

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["virtual-model"] });
      toast.success("Profile photo removed.");
    } catch (err) {
      console.error("Photo removal error:", err);
      toast.error("Could not remove photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (profileQueryData.isLoading || (!form && !profileQueryData.error)) {
    return (
      <AppShell>
        <LoadingState />
      </AppShell>
    );
  }

  if (profileQueryData.error || !form) {
    return (
      <AppShell>
        <ErrorState
          message="We couldn't load your style profile."
          onRetry={() => profileQueryData.refetch()}
        />
      </AppShell>
    );
  }

  // Derive genuine wardrobe statistics from actual database records
  const wardrobeItems = (wardrobeQueryData.data ?? []) as WardrobeItem[];
  const totalItems = wardrobeItems.length;

  const categoryCounts: Record<string, number> = {
    top: 0,
    bottom: 0,
    outerwear: 0,
    shoes: 0,
    accessory: 0,
  };

  const specificCategoryCounts: Record<string, number> = {};
  const colorCounts: Record<string, number> = {};

  for (const item of wardrobeItems) {
    const cat = item.category || "top";
    specificCategoryCounts[cat] = (specificCategoryCounts[cat] || 0) + 1;

    if (cat === "top" || cat === "shirt") categoryCounts.top++;
    else if (cat === "trousers" || cat === "jeans") categoryCounts.bottom++;
    else if (cat === "outerwear") categoryCounts.outerwear++;
    else if (cat === "shoes") categoryCounts.shoes++;
    else categoryCounts.accessory++;

    if (item.main_color) {
      const col = item.main_color.toLowerCase();
      colorCounts[col] = (colorCounts[col] || 0) + 1;
    }
  }

  const sortedDominantColors = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Derive feedback analytics
  const feedbackItems = feedbackQueryData.data ?? [];
  const positiveFeedbacks = feedbackItems.filter(
    (f) => f.action === "like" || f.action === "accept" || f.action === "save",
  );
  const negativeFeedbacks = feedbackItems.filter(
    (f) => f.action === "dislike" || f.action === "reject" || f.action === "swap",
  );

  const likedColorsMap: Record<string, number> = {};
  const dislikedColorsMap: Record<string, number> = {};

  for (const fb of feedbackItems) {
    const isPos = fb.action === "like" || fb.action === "accept";
    const targetMap = isPos ? likedColorsMap : dislikedColorsMap;
    if (Array.isArray(fb.colors)) {
      for (const c of fb.colors) {
        if (c) targetMap[c.toLowerCase()] = (targetMap[c.toLowerCase()] || 0) + 1;
      }
    }
  }

  const profileData = profileQueryData.data;
  const avatarUrl = profileData.avatar_url;
  const initials = getInitials(form.display_name, profileData.email);

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header Profile Identity Card */}
        <section className="rounded-3xl border border-border/80 bg-card/70 p-6 md:p-8 backdrop-blur-md shadow-card">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-5">
              {/* Photo Avatar with upload trigger */}
              <div className="relative group">
                <div className="relative size-20 md:size-24 shrink-0 overflow-hidden rounded-full border-2 border-border/80 bg-secondary/80 flex items-center justify-center shadow-soft">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={form.display_name || "Profile avatar"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-2xl md:text-3xl text-bronze tracking-wider">
                      {initials}
                    </span>
                  )}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  aria-label="Upload profile photo"
                  className="absolute bottom-0 right-0 rounded-full border border-border bg-background p-1.5 shadow-md hover:bg-secondary hover:text-bronze transition-colors"
                >
                  <Camera className="size-3.5" />
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground truncate">
                    {form.display_name || "Style Explorer"}
                  </h1>
                  <span
                    className="size-2 rounded-full bg-emerald-500 shrink-0"
                    title="Active session"
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{profileData.email || "Authenticated Member"}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Member since{" "}
                    {new Date(profileData.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={uploadingPhoto}
                    className="mt-2 text-[11px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="size-3" /> Remove photo
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 md:pt-0">
              <Button asChild variant="quiet" size="sm">
                <Link to="/wardrobe">
                  <Shirt className="size-4" /> Manage Wardrobe
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="size-4" /> Sign out
              </Button>
            </div>
          </div>

          {/* Wardrobe Quick Metrics Strip */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border/60 pt-6 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total Wardrobe
              </p>
              <p className="mt-1 font-display text-2xl text-foreground font-medium">
                {totalItems} pieces
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Active Categories
              </p>
              <p className="mt-1 font-display text-2xl text-foreground font-medium">
                {Object.values(categoryCounts).filter((c) => c > 0).length} of 5
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Stylist Feedback
              </p>
              <p className="mt-1 font-display text-2xl text-foreground font-medium">
                {feedbackItems.length} interactions
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Weather Layering
              </p>
              <p className="mt-1 font-display text-2xl text-foreground font-medium">
                {form.weather_enabled ? form.weather_city || "Enabled" : "Off"}
              </p>
            </div>
          </div>
        </section>

        {/* Tabbed Profile Sections */}
        <Tabs defaultValue="preferences" className="space-y-6">
          <TabsList className="bg-secondary/60 p-1 rounded-2xl">
            <TabsTrigger value="preferences" className="rounded-xl px-5 text-xs font-medium">
              Preferences & Style
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl px-5 text-xs font-medium">
              Wardrobe Breakdown ({totalItems})
            </TabsTrigger>
            <TabsTrigger value="insights" className="rounded-xl px-5 text-xs font-medium">
              AI Stylist Insights
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Style & Personal Preferences */}
          <TabsContent value="preferences" className="space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate(form);
              }}
              className="space-y-8 rounded-3xl border border-border/80 bg-card/60 p-6 md:p-8 backdrop-blur-md"
            >
              <div>
                <h2 className="font-display text-2xl text-foreground font-normal">
                  Personal Taste & Fit
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  VÉSTARA factors these choices into every outfit recommendation and swap.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    maxLength={60}
                    value={form.display_name}
                    placeholder="Your name"
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="accountEmail">Email Address</Label>
                  <Input
                    id="accountEmail"
                    disabled
                    value={profileData.email || ""}
                    className="bg-secondary/40 text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <ChipSelector
                label="Preferred Styles"
                description="Select aesthetic directions you feel best wearing."
                options={STYLES}
                value={form.preferred_styles}
                onChange={(v) => setForm({ ...form, preferred_styles: v })}
              />

              <ChipSelector
                label="Preferred Silhouette & Fits"
                description="Helps the stylist match balanced proportions."
                options={FITS}
                value={form.preferred_fits}
                onChange={(v) => setForm({ ...form, preferred_fits: v })}
              />

              <ColorSelector
                label="Favourite Palette"
                description="Pieces in these tones will be prioritized in core combinations."
                value={form.favorite_colors}
                onChange={(v) => setForm({ ...form, favorite_colors: v })}
              />

              <ColorSelector
                label="Colors to Avoid"
                description="The engine will penalize and avoid pairing these colors."
                value={form.avoided_colors}
                onChange={(v) => setForm({ ...form, avoided_colors: v })}
              />

              <ChipSelector
                label="Usual Occasions"
                description="Your frequent destinations for outfit planning."
                options={OCCASIONS.map((o) => o.value)}
                value={form.typical_occasions}
                onChange={(v) => setForm({ ...form, typical_occasions: v })}
              />

              {/* Weather Forecast Integration */}
              <div className="rounded-2xl border border-border/70 bg-secondary/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="weatherToggle"
                      className="flex items-center gap-2 text-sm font-medium"
                    >
                      <CloudSun className="size-4 text-bronze" /> Live Weather Intelligence
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically layers jackets in cold rain and recommends lightweight cotton in
                      summer heat.
                    </p>
                  </div>
                  <Switch
                    id="weatherToggle"
                    checked={form.weather_enabled}
                    onCheckedChange={(checked) => setForm({ ...form, weather_enabled: checked })}
                  />
                </div>

                {form.weather_enabled && (
                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="weatherCity">Your Home City</Label>
                    <Input
                      id="weatherCity"
                      placeholder="e.g. London, Tokyo, New York, Mumbai"
                      maxLength={80}
                      value={form.weather_city}
                      onChange={(e) => setForm({ ...form, weather_city: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Comfort Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="comfortNotes">Fabric & Sensory Comfort Notes</Label>
                <Input
                  id="comfortNotes"
                  maxLength={200}
                  placeholder="e.g. Prefer 100% natural cotton, avoid itchy knits or tight necklines"
                  value={form.comfort_notes}
                  onChange={(e) => setForm({ ...form, comfort_notes: e.target.value })}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border/60">
                <Button
                  type="submit"
                  variant="hero"
                  disabled={saveMutation.isPending}
                  className="px-7"
                >
                  {saveMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Saving…
                    </span>
                  ) : (
                    "Save profile changes"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="quiet"
                  disabled={resetMutation.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Reset styling history and feedback data? Your custom wardrobe items will be preserved.",
                      )
                    ) {
                      resetMutation.mutate();
                    }
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  <RotateCcw className="size-3.5 mr-1" /> Reset styling demo history
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* TAB 2: Real Wardrobe Analytics & Category Breakdown */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="rounded-3xl border border-border/80 bg-card/60 p-6 md:p-8 backdrop-blur-md space-y-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl text-foreground font-normal">
                    Wardrobe Inventory & Categories
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Real-time distribution of garments currently stored in your private database.
                  </p>
                </div>
                <Button asChild variant="quiet" size="sm">
                  <Link to="/wardrobe">View all items ({totalItems})</Link>
                </Button>
              </div>

              {totalItems === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 p-8 text-center space-y-3">
                  <Shirt className="size-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Your digital wardrobe is empty
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Add photos of your clothing pieces to start building occasion-aware outfits and
                    virtual 3D try-ons.
                  </p>
                  <Button asChild variant="hero" size="sm" className="mt-2">
                    <Link to="/wardrobe">Add your first piece</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {/* Category Breakdown Bars */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-foreground">Slot Distribution</h3>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        { key: "top", label: "Tops & Shirts", count: categoryCounts.top },
                        { key: "bottom", label: "Trousers & Jeans", count: categoryCounts.bottom },
                        {
                          key: "outerwear",
                          label: "Outerwear & Jackets",
                          count: categoryCounts.outerwear,
                        },
                        { key: "shoes", label: "Footwear", count: categoryCounts.shoes },
                        { key: "accessory", label: "Accessories", count: categoryCounts.accessory },
                      ].map((cat) => {
                        const pct = totalItems > 0 ? Math.round((cat.count / totalItems) * 100) : 0;
                        return (
                          <div
                            key={cat.key}
                            className="rounded-2xl border border-border/70 bg-secondary/30 p-4 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-foreground">{cat.label}</span>
                              <span className="text-muted-foreground">
                                {cat.count} <span aria-hidden="true">·</span> {pct}%
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full rounded-full bg-bronze transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sub-Category Specific Counts */}
                  <div className="space-y-3 pt-4 border-t border-border/60">
                    <h3 className="text-sm font-medium text-foreground">Detailed Categorization</h3>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((c) => {
                        const cnt = specificCategoryCounts[c.value] || 0;
                        return (
                          <div
                            key={c.value}
                            className="rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-xs flex items-center gap-2"
                          >
                            <span className="text-foreground">{c.label}:</span>
                            <span className="font-medium text-bronze">{cnt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dominant Wardrobe Colors */}
                  {sortedDominantColors.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-border/60">
                      <h3 className="text-sm font-medium text-foreground">
                        Dominant Palette in Your Closet
                      </h3>
                      <div className="flex flex-wrap gap-2.5">
                        {sortedDominantColors.map(([color, count]) => (
                          <div
                            key={color}
                            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 py-2 text-xs"
                          >
                            <span
                              className="size-3 rounded-full border border-black/20"
                              style={{ backgroundColor: color }}
                            />
                            <span className="capitalize text-foreground font-medium">{color}</span>
                            <span className="text-muted-foreground text-[11px]">({count})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: Feedback-Based Style Intelligence */}
          <TabsContent value="insights" className="space-y-6">
            <div className="rounded-3xl border border-border/80 bg-card/60 p-6 md:p-8 backdrop-blur-md space-y-8">
              <div>
                <h2 className="font-display text-2xl text-foreground font-normal">
                  Feedback-Learned Preferences
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  The AI Stylist continuously records your swaps, likes, and rejects to tailor
                  future recommendations.
                </p>
              </div>

              {/* Feedback Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-secondary/30 p-5 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ThumbsUp className="size-4 text-emerald-500" />
                    <span>Approved Combinations</span>
                  </div>
                  <p className="font-display text-3xl font-medium text-foreground">
                    {positiveFeedbacks.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Outfits accepted or marked as favourites
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-secondary/30 p-5 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ThumbsDown className="size-4 text-amber-500" />
                    <span>Swaps & Rejections</span>
                  </div>
                  <p className="font-display text-3xl font-medium text-foreground">
                    {negativeFeedbacks.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Pieces swapped out or replaced
                  </p>
                </div>

                <div className="rounded-2xl border border-border/70 bg-secondary/30 p-5 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="size-4 text-bronze" />
                    <span>Styling Precision</span>
                  </div>
                  <p className="font-display text-3xl font-medium text-foreground">
                    {feedbackItems.length > 0
                      ? `${Math.round((positiveFeedbacks.length / feedbackItems.length) * 100)}%`
                      : "Learning"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Agreement rate with suggested outfits
                  </p>
                </div>
              </div>

              {/* Learned Colors From Feedback */}
              <div className="grid gap-6 md:grid-cols-2 pt-4 border-t border-border/60">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Check className="size-4 text-emerald-500" /> Colors You Consistently Wear
                  </h3>
                  {Object.keys(likedColorsMap).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No color patterns identified yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(likedColorsMap).map(([color, count]) => (
                        <div
                          key={color}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs text-foreground"
                        >
                          <span
                            className="size-2.5 rounded-full border border-black/20"
                            style={{ backgroundColor: color }}
                          />
                          <span className="capitalize">{color}</span>
                          <span className="text-[10px] text-muted-foreground">({count}x)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                    <RotateCcw className="size-4 text-amber-500" /> Frequently Swapped Colors
                  </h3>
                  {Object.keys(dislikedColorsMap).length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No avoided color patterns recorded.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dislikedColorsMap).map(([color, count]) => (
                        <div
                          key={color}
                          className="flex items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-xs text-foreground"
                        >
                          <span
                            className="size-2.5 rounded-full border border-black/20"
                            style={{ backgroundColor: color }}
                          />
                          <span className="capitalize">{color}</span>
                          <span className="text-[10px] text-muted-foreground">({count}x)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Feedback Logs */}
              <div className="space-y-3 pt-4 border-t border-border/60">
                <h3 className="text-sm font-medium text-foreground">Recent Style Interactions</h3>
                {feedbackItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No interactions logged yet. Open the{" "}
                    <Link to="/stylist" className="text-bronze underline">
                      AI Stylist
                    </Link>{" "}
                    and generate an outfit to begin calibration.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {feedbackItems.slice(0, 5).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          {item.action === "like" || item.action === "accept" ? (
                            <ThumbsUp className="size-3.5 text-emerald-500" />
                          ) : (
                            <RotateCcw className="size-3.5 text-amber-500" />
                          )}
                          <span className="capitalize font-medium text-foreground">
                            {item.action} action {item.slot ? `on ${item.slot}` : ""}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
