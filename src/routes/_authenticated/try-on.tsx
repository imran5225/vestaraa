import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Download, Flag, Maximize2, Bookmark, RotateCcw, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState, PageHeader } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { generateTryOn } from "@/lib/tryon.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/try-on")({
  head: () => ({
    meta: [
      { title: "Virtual Try-On — VÉSTARA" },
      { name: "description", content: "What if I wear this? Preview outfits on your own photo with AI." },
      { property: "og:title", content: "Virtual Try-On — VÉSTARA" },
      { property: "og:description", content: "Preview outfits on your own photo with AI." },
    ],
  }),
  component: Page,
});

const OCCASIONS = ["college", "casual", "formal", "party", "travel"];
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_MB = 10;

type Look = {
  id: string; person_path: string; garment_path: string | null; result_path: string; description: string;
  occasion: string | null; saved: boolean; reported: boolean; created_at: string;
  styling: { outfit_name?: string; styling_reason?: string; footwear?: string[]; accessories?: string[]; alternatives?: string[]; styling_tips?: string[] };
};

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Please sign in again.");
  return data.user.id;
}

/** Validates type, size, readability and dimensions. Returns an error message or null. */
async function validateImage(file: File, minSide = 384): Promise<string | null> {
  if (!TYPES.includes(file.type)) return "Please use a JPG, PNG or WebP image.";
  if (file.size > MAX_MB * 1024 * 1024) return `Images must be under ${MAX_MB} MB.`;
  try {
    const bmp = await createImageBitmap(file);
    const ok = Math.min(bmp.width, bmp.height) >= minSide;
    bmp.close();
    return ok ? null : `The image is too small — at least ${minSide}px on each side.`;
  } catch {
    return "That image couldn't be read. Try another file.";
  }
}

async function upload(file: File, folder: string) {
  const id = await uid();
  const ext = file.type.split("/")[1] ?? "jpg";
  const path = `${id}/tryon/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("wardrobe").upload(path, file, { contentType: file.type });
  if (error) throw new Error("Upload failed. Please try again.");
  return path;
}

function useSigned(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  return useQuery({
    queryKey: ["signed", ...list],
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("wardrobe").createSignedUrls(list, 3600);
      return Object.fromEntries((data ?? []).map((d) => [d.path ?? "", d.signedUrl]));
    },
  });
}

const modelQuery = {
  queryKey: ["virtual-model"],
  queryFn: async () => {
    const { data } = await supabase.from("virtual_models").select("*").maybeSingle();
    return data;
  },
};
const looksQuery = {
  queryKey: ["tryon-looks"],
  queryFn: async () => {
    const { data, error } = await supabase.from("tryon_looks").select("*").order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return (data ?? []) as unknown as Look[];
  },
};

function Page() {
  const model = useQuery(modelQuery);
  const [skipped, setSkipped] = useState(false);
  if (model.isLoading) return <AppShell><LoadingState /></AppShell>;
  const m = model.data;
  const needsOnboarding = !skipped && (!m || (!m.onboarding_done && !m.photo_path));
  return <AppShell>{needsOnboarding ? <Onboarding onSkip={() => setSkipped(true)} /> : <Studio />}</AppShell>;
}

// ---------- Onboarding ----------

function Onboarding({ onSkip }: { onSkip: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const qc = useQueryClient();
  async function skip() {
    const id = await uid();
    await supabase.from("virtual_models").upsert({ user_id: id, onboarding_done: true });
    qc.invalidateQueries({ queryKey: ["virtual-model"] });
    onSkip();
  }
  if (step === 1)
    return (
      <div className="glass mx-auto max-w-xl rounded-3xl p-8 text-center fade-up">
        <p className="eyebrow">Virtual Try-On</p>
        <h1 className="mt-3 font-display text-4xl">Welcome to VÉSTARA Try-On</h1>
        <p className="mt-4 text-muted-foreground">Upload one full-body photo and preview different outfits on yourself with AI. Results are AI-generated 2D previews — a styling aid, not an exact fit.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="hero" onClick={() => setStep(2)}>Create My Virtual Model</Button>
          <Button variant="quiet" onClick={skip}>Skip for now</Button>
        </div>
      </div>
    );
  return <ModelUploader onDone={() => qc.invalidateQueries({ queryKey: ["virtual-model"] })} onCancel={skip} />;
}

function ModelUploader({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function pick(f?: File) {
    if (!f) return;
    const err = await validateImage(f, 512);
    if (err) return void toast.error(err);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  async function save() {
    if (!file || !consent) return;
    setBusy(true);
    try {
      const path = await upload(file, "model");
      const id = await uid();
      const { error } = await supabase.from("virtual_models").upsert({ user_id: id, photo_path: path, consent_at: new Date().toISOString(), onboarding_done: true, updated_at: new Date().toISOString() });
      if (error) throw new Error("Couldn't save your photo.");
      toast.success("Your virtual model is ready");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="glass mx-auto max-w-2xl rounded-3xl p-6 sm:p-8 fade-up">
      <p className="eyebrow">Step 2</p>
      <h2 className="mt-2 font-display text-3xl">Upload a full-body photo</h2>
      <p className="mt-2 text-sm text-muted-foreground">Best results: good light, a plain background, your whole body in view, standing naturally. JPG, PNG or WebP, up to {MAX_MB} MB.</p>
      <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="mt-6 grid gap-6 sm:grid-cols-[220px_1fr]">
        <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-2xl border bg-surface">
          {preview ? <img src={preview} alt="Your photo preview" className="h-full w-full object-cover" /> : <Camera className="size-8 text-muted-foreground" />}
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="quiet" onClick={() => input.current?.click()}><Upload /> {file ? "Replace photo" : "Choose photo"}</Button>
            {file && <Button variant="ghost" onClick={() => { setFile(null); setPreview(null); }}><Trash2 /> Remove</Button>}
          </div>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
            <span>I agree that VÉSTARA may store this photo privately in my account and send it to its AI service to create try-on previews. It is never public, never used for training, and I can delete it any time.</span>
          </label>
          <div className="flex gap-2">
            <Button variant="hero" disabled={!file || !consent || busy} onClick={save}>{busy ? "Uploading…" : "Save my model"}</Button>
            {onCancel && <Button variant="ghost" onClick={onCancel}>Skip for now</Button>}
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
  const gen = useServerFn(generateTryOn);
  const [changeModel, setChangeModel] = useState(false);
  const [garment, setGarment] = useState<File | null>(null);
  const [garmentPreview, setGarmentPreview] = useState<string | null>(null);
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
  const signed = useSigned([photo, ...(looks.data ?? []).flatMap((l) => [l.result_path, l.person_path])]);
  const url = (p?: string | null) => (p ? signed.data?.[p] : undefined);

  const run = useMutation({
    mutationFn: async (opts: { refine?: Look }) => {
      setError(null);
      const garmentPath = !opts.refine && garment ? await upload(garment, "garments") : null;
      return gen({
        data: opts.refine
          ? { personPath: opts.refine.result_path, garmentPath: null, description: refineText.trim(), occasion: opts.refine.occasion, extras: null, parentId: opts.refine.id }
          : { personPath: photo!, garmentPath, description: description.trim(), occasion, extras: extras.trim() || null, parentId: null },
      });
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["tryon-looks"] });
      setActiveId(r.id);
      setRefineText("");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    onError: (e) => setError((e as Error).message || "Something went wrong."),
  });

  async function pickGarment(f?: File) {
    if (!f) return;
    const err = await validateImage(f, 256);
    if (err) return void toast.error(err);
    setGarment(f);
    setGarmentPreview(URL.createObjectURL(f));
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
    const paths = [photo, ...(looks.data ?? []).flatMap((l) => [l.result_path, l.garment_path])].filter((p): p is string => Boolean(p));
    if (paths.length) await supabase.storage.from("wardrobe").remove(paths);
    await supabase.from("tryon_looks").delete().eq("user_id", id);
    await supabase.from("virtual_models").update({ photo_path: null, consent_at: null }).eq("user_id", id);
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

  if (!photo || changeModel)
    return (
      <>
        <PageHeader eyebrow="Virtual Try-On" title="What if I wear this?" body="Start by adding a full-body photo." />
        <ModelUploader onDone={() => { setChangeModel(false); qc.invalidateQueries({ queryKey: ["virtual-model"] }); }} onCancel={photo ? () => setChangeModel(false) : undefined} />
      </>
    );

  return (
    <>
      <PageHeader eyebrow="Virtual Try-On" title="What if I wear this?" body="Upload a clothing photo or describe an outfit, and see an AI preview on your own photo." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Viewing area */}
        <section ref={resultRef} className="rounded-3xl border bg-gradient-to-b from-surface to-card p-4 sm:p-6">
          {run.isPending ? (
            <div className="flex aspect-[3/4] max-h-[70vh] w-full animate-pulse flex-col items-center justify-center rounded-2xl bg-secondary text-center text-muted-foreground">
              <Wand2 className="mb-3 size-8" />
              <p className="font-display text-xl text-foreground">Generating your look…</p>
              <p className="mt-1 text-sm">This usually takes 30–60 seconds.</p>
            </div>
          ) : active ? (
            <ResultView look={active} before={url(active.person_path)} after={url(active.result_path)} />
          ) : (
            <div className="mx-auto max-w-sm">
              {url(photo) ? <img src={url(photo)} alt="Your model photo" className="w-full rounded-2xl object-cover" /> : <div className="aspect-[3/4] rounded-2xl bg-secondary" />}
              <p className="mt-3 text-center text-xs text-muted-foreground">Your model photo — private to you</p>
            </div>
          )}
          {error && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 p-3 text-sm">
              <span>{error}</span>
              <Button size="sm" variant="quiet" onClick={() => run.mutate(active && refineText ? { refine: active } : {})}><RotateCcw /> Retry</Button>
            </div>
          )}
          {active && !run.isPending && (
            <div className="mt-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="quiet" onClick={() => { setActiveId(null); setGarment(null); setGarmentPreview(null); setDescription(""); }}>Try Another Outfit</Button>
                <Button size="sm" variant="quiet" onClick={() => { setActiveId(null); garmentInput.current?.click(); }}>Change Clothing</Button>
                <Button size="sm" variant={active.saved ? "champagne" : "quiet"} onClick={() => update(active.id, { saved: !active.saved }, active.saved ? "Removed from saved" : "Look saved")}><Bookmark /> {active.saved ? "Saved" : "Save Look"}</Button>
                <Button size="sm" variant="quiet" onClick={() => downloadLook(active)}><Download /> Download</Button>
                <Button size="sm" variant="ghost" disabled={active.reported} onClick={() => update(active.id, { reported: true }, "Thanks — we've noted this result is wrong")}><Flag /> {active.reported ? "Reported" : "Report issue"}</Button>
                <Button size="sm" variant="ghost" onClick={() => removeLook(active)}><Trash2 /> Delete</Button>
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (refineText.trim()) run.mutate({ refine: active }); }}>
                <Input value={refineText} maxLength={300} onChange={(e) => setRefineText(e.target.value)} placeholder="Refine This Look — e.g. try a black jacket" aria-label="Refine this look" />
                <Button type="submit" variant="hero" disabled={!refineText.trim()}>Refine</Button>
              </form>
            </div>
          )}
        </section>

        {/* Controls */}
        <aside className="space-y-5 rounded-3xl border bg-card p-5">
          <div className="flex items-center gap-3">
            {url(photo) && <img src={url(photo)} alt="" className="size-14 rounded-xl object-cover" />}
            <div className="flex-1 text-sm"><p className="font-medium">Your model</p><button className="text-muted-foreground underline" onClick={() => setChangeModel(true)}>Use a different photo</button></div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Clothing photo <span className="text-muted-foreground">(optional)</span></p>
            <input ref={garmentInput} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => pickGarment(e.target.files?.[0])} />
            {garmentPreview ? (
              <div className="flex items-center gap-3">
                <img src={garmentPreview} alt="Clothing" className="size-20 rounded-xl object-cover" />
                <div className="flex flex-col items-start gap-1">
                  <Button size="sm" variant="quiet" onClick={() => garmentInput.current?.click()}>Replace</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setGarment(null); setGarmentPreview(null); }}>Remove</Button>
                </div>
              </div>
            ) : (
              <Button variant="quiet" className="w-full" onClick={() => garmentInput.current?.click()}><Upload /> Upload shirt, dress, jacket…</Button>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Or describe the outfit</p>
            <Textarea value={description} maxLength={600} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. A cream linen shirt with olive trousers" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Occasion</p>
            <div className="flex flex-wrap gap-2">
              {OCCASIONS.map((o) => (
                <button key={o} onClick={() => setOccasion(o)} className={cn("rounded-full border px-3 py-1 text-sm capitalize", occasion === o ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>{o}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Colours, shoes, accessories <span className="text-muted-foreground">(optional)</span></p>
            <Input value={extras} maxLength={300} onChange={(e) => setExtras(e.target.value)} placeholder="e.g. white sneakers, silver watch" />
          </div>
          <Button variant="hero" className="w-full" disabled={run.isPending || (!garment && !description.trim())} onClick={() => run.mutate({})}>
            <Wand2 /> {run.isPending ? "Generating…" : "Generate My Look"}
          </Button>
          <p className="text-xs text-muted-foreground">AI-generated 2D preview. Fit, size and fabric are not guaranteed.</p>
          <button className="text-xs text-destructive underline" onClick={removePhotoAndLooks}>Delete my photo and all looks</button>
        </aside>
      </div>

      {!!looks.data?.length && (
        <section className="mt-10">
          <h2 className="mb-4 font-display text-2xl">Your looks</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {looks.data.map((l) => (
              <button key={l.id} onClick={() => { setActiveId(l.id); resultRef.current?.scrollIntoView({ behavior: "smooth" }); }} className={cn("group relative overflow-hidden rounded-2xl border text-left", activeId === l.id && "ring-2 ring-primary")}>
                {url(l.result_path) ? <img src={url(l.result_path)} alt={l.styling.outfit_name ?? "Generated look"} loading="lazy" className="aspect-[3/4] w-full object-cover" /> : <div className="aspect-[3/4] bg-secondary" />}
                <div className="p-2 text-xs"><p className="truncate font-medium">{l.styling.outfit_name || l.description || "Look"}</p>{l.saved && <p className="text-muted-foreground">Saved</p>}</div>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ResultView({ look, before, after }: { look: Look; before?: string | undefined; after?: string | undefined }) {
  const [pos, setPos] = useState(50);
  const [big, setBig] = useState(false);
  const s = look.styling;
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <div className="relative mx-auto aspect-[3/4] max-h-[70vh] overflow-hidden rounded-2xl bg-secondary">
          {after && <img src={after} alt="AI preview of you in the outfit" className="absolute inset-0 h-full w-full object-cover" />}
          {before && <img src={before} alt="Original photo" className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-background/90" style={{ left: `${pos}%` }} />
          <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wide">Before</span>
          <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] uppercase tracking-wide">AI preview</span>
          <button onClick={() => setBig(true)} aria-label="View larger" className="absolute bottom-2 right-2 rounded-full bg-background/80 p-2"><Maximize2 className="size-4" /></button>
        </div>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Before and after comparison" className="mt-3 w-full accent-[var(--primary)]" />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground"><button onClick={() => setPos(100)}>Original</button><button onClick={() => setPos(0)}>AI preview</button></div>
      </div>
      <div className="space-y-4 text-sm">
        <p className="eyebrow">AI-generated preview</p>
        <h3 className="font-display text-3xl">{s.outfit_name || "Your look"}</h3>
        {look.description && <p className="text-muted-foreground">{look.description}{look.occasion ? ` · ${look.occasion}` : ""}</p>}
        {s.styling_reason ? <p>{s.styling_reason}</p> : <p className="text-muted-foreground">Styling notes weren't available for this look.</p>}
        <List title="Footwear" items={s.footwear} />
        <List title="Accessories" items={s.accessories} />
        <List title="Alternatives" items={s.alternatives} />
        <List title="Styling tips" items={s.styling_tips} />
      </div>
      <Dialog open={big} onOpenChange={setBig}>
        <DialogContent className="max-w-3xl p-2">
          <DialogTitle className="sr-only">AI preview</DialogTitle>
          {after && <img src={after} alt="AI preview, large" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function List({ title, items }: { title: string; items?: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}
