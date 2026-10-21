import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Image as ImageIcon, Pencil, Plus, Shirt, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/States";
import { ItemImage } from "@/components/wardrobe/ItemImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, COLORS, PATTERNS, SEASONS, STYLES, categoryLabel, type WardrobeItem } from "@/lib/domain";
import { currentUserId, useSignedUrls, wardrobeQuery } from "@/lib/queries";
import { analyzeGarment } from "@/lib/styling.functions";
import { useLoadSamples } from "./dashboard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/wardrobe")({
  head: () => ({ meta: [{ title: "Wardrobe — VÉSTARA" }, { name: "description", content: "Your digital wardrobe." }, { property: "og:title", content: "Wardrobe — VÉSTARA" }, { property: "og:description", content: "Your digital wardrobe." }] }),
  component: Page,
});

type Draft = { id?: string; name: string; category: string; main_color: string; pattern: string; style: string; seasons: string[]; image_path: string | null };
const EMPTY: Draft = { name: "", category: "top", main_color: "white", pattern: "solid", style: "casual", seasons: [], image_path: null };

function Page() {
  const q = useQuery(wardrobeQuery);
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<Draft | null>(null);
  const samples = useLoadSamples();
  const items = (q.data ?? []).filter((i) => filter === "all" || i.category === filter);
  const signed = useSignedUrls(items.map((i) => i.image_path).filter((p): p is string => Boolean(p)));

  const del = useMutation({
    mutationFn: async (item: WardrobeItem) => {
      const { error } = await supabase.from("wardrobe_items").delete().eq("id", item.id);
      if (error) throw error;
      if (item.image_path) await supabase.storage.from("wardrobe").remove([item.image_path]);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wardrobe"] }); qc.invalidateQueries({ queryKey: ["outfits"] }); toast.success("Removed from your wardrobe."); },
    onError: () => toast.error("Couldn't remove that piece."),
  });

  return (
    <AppShell>
      <PageHeader eyebrow="Wardrobe" title="Your clothes" body={`${q.data?.length ?? 0} pieces. Outfits are only ever built from what's here.`}
        actions={<>
          <Button variant="quiet" disabled={samples.isPending} onClick={() => samples.mutate()}>Load samples</Button>
          <Button variant="hero" onClick={() => setEditing({ ...EMPTY })}><Plus /> Add piece</Button>
        </>} />
      <div className="mb-6 flex flex-wrap gap-2">
        {[{ value: "all", label: "All" }, ...CATEGORIES].map((c) => (
          <button key={c.value} onClick={() => setFilter(c.value)} className={cn("rounded-full border px-3 py-1.5 text-xs", filter === c.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-bronze")}>{c.label}</button>
        ))}
      </div>
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState message="We couldn't load your wardrobe." onRetry={() => q.refetch()} /> :
        !items.length ? <EmptyState icon={<Shirt className="h-8 w-8" />} title="Nothing here yet" body="Add a photo of a piece of clothing — the AI will fill in the details for you." action={<Button variant="hero" onClick={() => setEditing({ ...EMPTY })}>Add your first piece</Button>} /> : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((i) => (
              <div key={i.id} className="group">
                <ItemImage item={i} signedUrls={signed.data} />
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{categoryLabel(i.category)} · {i.main_color}</p>
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Edit ${i.name}`} onClick={() => setEditing({ id: i.id, name: i.name, category: i.category, main_color: i.main_color ?? "white", pattern: i.pattern ?? "solid", style: i.style ?? "casual", seasons: i.seasons, image_path: i.image_path })}><Pencil /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Delete ${i.name}`} onClick={() => confirm(`Remove “${i.name}”?`) && del.mutate(i)}><Trash2 /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      {editing && <ItemDialog draft={editing} onClose={() => setEditing(null)} />}
    </AppShell>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
}

type AiColor = { name: string; hex: string };
type AiIdea = { title: string; pieces: string[]; colour_reasoning: string };

function ItemDialog({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeGarment);
  const [d, setD] = useState<Draft>(draft);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detected, setDetected] = useState(false);
  const [colors, setColors] = useState<AiColor[]>([]);
  const [ideas, setIdeas] = useState<AiIdea[]>([]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const failMsg = "Couldn't analyse this photo, you can fill details manually.";

  async function pick(f: File | undefined) {
    if (!f) return;
    if (f.size > 5_000_000) return void toast.error("Please choose a photo under 5 MB.");
    setFile(f);
    const url = await fileToDataUrl(f);
    setPreview(url);
    setAnalyzing(true);
    setDetected(false);
    try {
      const r = await analyze({ data: { imageDataUrl: url } });
      if (r.status === "ok") {
        const s = r.suggestion;
        if (!s.isGarment) toast.warning("That doesn't look like clothing — please check the details.");
        setD((p) => ({ ...p, name: p.name || s.name, category: s.category, main_color: s.main_color, pattern: s.pattern, style: s.style, seasons: s.seasons }));
        setColors(s.dominant_colors.slice(0, 3));
        setIdeas(s.outfit_suggestions.slice(0, 3));
        setDetected(true);
      } else if (r.status === "error") {
        toast.error(/credits|busy|limit/i.test(r.message) ? r.message : failMsg);
      } else toast.error(failMsg);
    } catch { toast.error(failMsg); }
    setAnalyzing(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const uid = await currentUserId();
      let image_path = d.image_path;
      if (file) {
        const path = `${uid}/${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
        const up = await supabase.storage.from("wardrobe").upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        image_path = path;
      }
      const name = d.name.trim() || `${d.main_color} ${categoryLabel(d.category).split(" ")[0].toLowerCase()}`;
      const row = {
        name, category: d.category, main_color: d.main_color, pattern: d.pattern, style: d.style, seasons: d.seasons, image_path,
        ...(detected ? { ai_colors: colors, ai_outfit_suggestions: ideas } : {}),
      };
      const res = d.id ? await supabase.from("wardrobe_items").update(row).eq("id", d.id) : await supabase.from("wardrobe_items").insert({ ...row, user_id: uid });
      if (res.error) throw res.error;
      qc.invalidateQueries({ queryKey: ["wardrobe"] });
      toast.success(d.id ? "Saved." : "Added to your wardrobe.");
      onClose();
    } catch { toast.error("Couldn't save this piece. Please try again."); }
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{d.id ? "Edit piece" : "Add a piece"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Photo</Label>
            {preview && (
              <div className="relative h-40 w-fit overflow-hidden rounded-lg">
                <img src={preview} alt="" className="h-40 rounded-lg object-cover" />
                {analyzing && <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-background/60 to-transparent" />}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="quiet" asChild>
                <label className="cursor-pointer"><Camera /> Take photo
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
                </label>
              </Button>
              <Button type="button" variant="quiet" asChild>
                <label className="cursor-pointer"><ImageIcon /> From gallery
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
                </label>
              </Button>
            </div>
          </div>

          {analyzing && (
            <div className="space-y-2" role="status">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3 w-3 animate-pulse text-bronze" /> Analysing your piece…</p>
              <div className="h-6 w-2/3 animate-pulse rounded-full bg-muted" />
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
            </div>
          )}

          {detected && !analyzing && (
            <div className="fade-up space-y-2">
              <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3 w-3 text-bronze" /> AI detected</p>
              <div className="flex flex-wrap gap-1.5">
                {colors.map((c) => (
                  <span key={c.name + c.hex} className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs">
                    <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: c.hex }} />{c.name}
                  </span>
                ))}
                <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs capitalize">{d.style}</span>
                <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs capitalize">{d.pattern}</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5"><Label htmlFor="name">Name <span className="text-muted-foreground">(optional)</span></Label><Input id="name" value={d.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Navy oxford shirt" /></div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={d.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Seasons</Label>
            <div className="flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <button type="button" key={s} onClick={() => set("seasons", d.seasons.includes(s) ? d.seasons.filter((x) => x !== s) : [...d.seasons, s])}
                  className={cn("rounded-full border px-3 py-1 text-xs capitalize transition-colors", d.seasons.includes(s) ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>{s}</button>
              ))}
            </div>
          </div>

          {detected && !analyzing && ideas.length > 0 && (
            <div className="fade-up space-y-2">
              <Label>Outfit ideas</Label>
              <div className="space-y-2">
                {ideas.map((o) => (
                  <div key={o.title} className="rounded-xl border bg-card p-3">
                    <p className="text-sm font-medium">{o.title}</p>
                    <p className="mt-1 text-xs">{o.pieces.join(" · ")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{o.colour_reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" variant="hero" className="w-full" disabled={saving || analyzing}>{saving ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
