import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bookmark, BookmarkCheck, Check, Heart, RefreshCw, Shirt, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { ItemImage } from "@/components/wardrobe/ItemImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { occasionLabel, SLOT_LABELS, type Slot } from "@/lib/domain";
import { useSignedUrls, type OutfitView } from "@/lib/queries";
import { recordFeedback, swapOutfitItem } from "@/lib/styling.functions";
import { cn } from "@/lib/utils";

interface Props {
  outfit: OutfitView;
  onReplaced?: (newOutfitId: string) => void;
  compact?: boolean;
}

export function OutfitCard({ outfit, onReplaced, compact }: Props) {
  const qc = useQueryClient();
  const feedbackFn = useServerFn(recordFeedback);
  const swapFn = useServerFn(swapOutfitItem);
  const signed = useSignedUrls(outfit.pieces.map((p) => p.item.image_path).filter((p): p is string => Boolean(p)));
  const missing = outfit.piece_count - outfit.pieces.length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["outfits"] });
    qc.invalidateQueries({ queryKey: ["outfit", outfit.id] });
    qc.invalidateQueries({ queryKey: ["feedback"] });
  };

  const feedback = useMutation({
    mutationFn: (action: "love" | "dislike" | "save" | "unsave" | "worn") => feedbackFn({ data: { outfitId: outfit.id, action } }),
    onSuccess: (_d, action) => {
      refresh();
      const msg = { love: "Loved — we'll lean into looks like this.", dislike: "Noted. We'll steer away from this combination.", save: "Saved to your looks.", unsave: "Removed from saved looks.", worn: "Marked as worn today." }[action];
      toast.success(msg);
    },
    onError: () => toast.error("Couldn't record that. Please try again."),
  });

  const swap = useMutation({
    mutationFn: (slot: Slot) => swapFn({ data: { outfitId: outfit.id, slot } }),
    onSuccess: (r) => {
      if (!r.ok) { toast.error(r.reason); return; }
      refresh();
      toast.success("Piece swapped — the rest of the look stays.");
      onReplaced?.(r.outfitId);
    },
    onError: () => toast.error("Swap failed. Please try again."),
  });

  const saved = outfit.status === "saved";
  const busy = feedback.isPending || swap.isPending;

  return (
    <article className="rounded-2xl border bg-card p-5 shadow-soft fade-up">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{occasionLabel(outfit.occasion)}</span>
          {outfit.mood && <Badge variant="secondary" className="rounded-full font-normal">{outfit.mood}</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="rounded-full font-normal">{outfit.source === "ai" ? "AI stylist" : "Style engine"}</Badge>
          {outfit.status === "rejected" && <Badge variant="outline" className="rounded-full font-normal">Not for me</Badge>}
          {outfit.worn_at && <Badge variant="outline" className="rounded-full font-normal">Worn</Badge>}
        </div>
      </header>

      <div className={cn("grid gap-3", outfit.pieces.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3", compact && "grid-cols-4 sm:grid-cols-5")}>
        {outfit.pieces.map((p) => (
          <figure key={p.slot} className="group">
            <ItemImage item={p.item} signedUrls={signed.data} />
            <figcaption className="mt-2">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">{SLOT_LABELS[p.slot]}</p>
              <p className="truncate text-sm">{p.item.name}</p>
            </figcaption>
          </figure>
        ))}
      </div>
      {missing > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {missing} piece{missing > 1 ? "s were" : " was"} removed from your wardrobe since this look was created.
        </p>
      )}

      {!compact && <p className="mt-5 text-[0.95rem] leading-relaxed text-foreground/85">{outfit.explanation}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => feedback.mutate("love")} aria-label="Love this">
          <Heart /> Love this
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => feedback.mutate("dislike")} aria-label="Not for me">
          <ThumbsDown /> Not for me
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="quiet" disabled={busy}>
              <RefreshCw className={cn(swap.isPending && "animate-spin")} /> Swap a piece
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {outfit.pieces.map((p) => (
              <DropdownMenuItem key={p.slot} onSelect={() => swap.mutate(p.slot)}>
                <Shirt className="h-4 w-4" /> Swap {SLOT_LABELS[p.slot].toLowerCase()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant={saved ? "champagne" : "quiet"} disabled={busy} onClick={() => feedback.mutate(saved ? "unsave" : "save")}>
          {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "Saved" : "Save outfit"}
        </Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => feedback.mutate("worn")}>
          <Check /> Wear this look
        </Button>
      </div>
    </article>
  );
}
