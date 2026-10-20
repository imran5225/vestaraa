import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorState, LoadingState, PageHeader } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { COLORS, FITS, OCCASIONS, STYLES } from "@/lib/domain";
import { currentUserId, profileQuery } from "@/lib/queries";
import { resetDemoData } from "@/lib/styling.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — VÉSTARA" }, { name: "description", content: "Your style preferences." }, { property: "og:title", content: "Profile — VÉSTARA" }, { property: "og:description", content: "Your style preferences." }] }),
  component: Page,
});

type Form = { display_name: string; preferred_styles: string[]; preferred_fits: string[]; favorite_colors: string[]; avoided_colors: string[]; typical_occasions: string[]; weather_enabled: boolean; weather_city: string; comfort_notes: string };

function Chips({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button type="button" key={o} onClick={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])}
            className={cn("rounded-full border px-3 py-1.5 text-xs capitalize", value.includes(o) ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-bronze")}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Page() {
  const q = useQuery(profileQuery);
  const qc = useQueryClient();
  const resetFn = useServerFn(resetDemoData);
  const [f, setF] = useState<Form | null>(null);
  useEffect(() => {
    if (q.data && !f) setF({
      display_name: q.data.display_name ?? "", preferred_styles: q.data.preferred_styles, preferred_fits: q.data.preferred_fits,
      favorite_colors: q.data.favorite_colors, avoided_colors: q.data.avoided_colors, typical_occasions: q.data.typical_occasions,
      weather_enabled: q.data.weather_enabled, weather_city: q.data.weather_city ?? "", comfort_notes: q.data.comfort_notes ?? "",
    });
  }, [q.data, f]);

  const save = useMutation({
    mutationFn: async (v: Form) => {
      if (v.weather_enabled && !v.weather_city.trim()) throw new Error("Enter a city to use live weather.");
      const id = await currentUserId();
      const { error } = await supabase.from("profiles").update({ ...v, display_name: v.display_name.trim() || null, weather_city: v.weather_city.trim() || null, comfort_notes: v.comfort_notes.trim() || null, onboarded: true }).eq("id", id);
      if (error) throw new Error("Couldn't save your profile.");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); qc.invalidateQueries({ queryKey: ["weather"] }); toast.success("Profile saved."); },
    onError: (e) => toast.error(e.message),
  });
  const reset = useMutation({
    mutationFn: () => resetFn(),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Looks, chats and sample clothes cleared."); },
    onError: () => toast.error("Reset failed."),
  });

  if (q.isLoading || (!f && !q.error)) return <AppShell><LoadingState /></AppShell>;
  if (q.error || !f) return <AppShell><ErrorState message="We couldn't load your profile." onRetry={() => q.refetch()} /></AppShell>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  return (
    <AppShell>
      <PageHeader eyebrow="Profile" title="Your style" body="The more we know, the better your outfits." />
      <form className="max-w-2xl space-y-8" onSubmit={(e) => { e.preventDefault(); save.mutate(f); }}>
        <div className="space-y-1.5"><Label htmlFor="dn">Name</Label><Input id="dn" maxLength={60} value={f.display_name} onChange={(e) => set("display_name", e.target.value)} /></div>
        <Chips label="Styles you like" options={STYLES} value={f.preferred_styles} onChange={(v) => set("preferred_styles", v)} />
        <Chips label="Preferred fits" options={FITS} value={f.preferred_fits} onChange={(v) => set("preferred_fits", v)} />
        <Chips label="Favourite colours" options={COLORS} value={f.favorite_colors} onChange={(v) => set("favorite_colors", v)} />
        <Chips label="Colours to avoid" options={COLORS} value={f.avoided_colors} onChange={(v) => set("avoided_colors", v)} />
        <Chips label="Usual occasions" options={OCCASIONS.map((o) => o.value)} value={f.typical_occasions} onChange={(v) => set("typical_occasions", v)} />
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between"><Label htmlFor="we">Use live weather</Label><Switch id="we" checked={f.weather_enabled} onCheckedChange={(v) => set("weather_enabled", v)} /></div>
          {f.weather_enabled && <Input placeholder="Your city, e.g. Mumbai" maxLength={80} value={f.weather_city} onChange={(e) => set("weather_city", e.target.value)} />}
        </div>
        <div className="space-y-1.5"><Label htmlFor="cn">Comfort notes</Label><Input id="cn" maxLength={200} placeholder="e.g. no tight collars" value={f.comfort_notes} onChange={(e) => set("comfort_notes", e.target.value)} /></div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="hero" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button>
          <Button type="button" variant="quiet" disabled={reset.isPending} onClick={() => confirm("Clear all looks, chats, feedback and sample clothes?") && reset.mutate()}>Reset demo data</Button>
        </div>
      </form>
    </AppShell>
  );
}
