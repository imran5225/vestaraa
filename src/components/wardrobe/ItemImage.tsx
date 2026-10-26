import { useState } from "react";
import { Shirt, ImageOff } from "lucide-react";
import type { WardrobeItem } from "@/lib/domain";
import { SAMPLE_IMAGES } from "@/lib/sample-images";
import { cn } from "@/lib/utils";

interface Props {
  item: Pick<WardrobeItem, "name" | "image_path" | "sample_key">;
  signedUrls?: Record<string, string> | undefined;
  className?: string;
  imageClassName?: string;
  aspectRatio?: "4/5" | "3/4" | "square" | "auto";
  fit?: "contain" | "cover";
}

/** Shows the garment photo (sample asset or signed storage URL), else a placeholder. */
export function ItemImage({
  item,
  signedUrls,
  className,
  imageClassName,
  aspectRatio = "4/5",
  fit = "contain",
}: Props) {
  const [hasError, setHasError] = useState(false);

  const src = item.sample_key
    ? SAMPLE_IMAGES[item.sample_key]
    : item.image_path
      ? signedUrls?.[item.image_path]
      : undefined;

  const aspectClass = {
    "4/5": "aspect-[4/5]",
    "3/4": "aspect-[3/4]",
    square: "aspect-square",
    auto: "",
  }[aspectRatio];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-surface/80 to-surface/40 p-2.5 transition-colors duration-300",
        aspectClass,
        className,
      )}
    >
      {src && !hasError ? (
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          onError={() => setHasError(true)}
          className={cn(
            "h-full w-full transition-transform duration-500 group-hover:scale-[1.03]",
            fit === "contain" ? "object-contain object-center" : "object-cover object-center",
            imageClassName,
          )}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground/70">
          {hasError ? (
            <>
              <ImageOff className="h-7 w-7 text-taupe/60" strokeWidth={1.2} />
              <span className="text-[11px] text-muted-foreground/60">Image unavailable</span>
            </>
          ) : (
            <>
              <Shirt className="h-8 w-8 text-taupe" strokeWidth={1.2} />
              <span className="text-xs">No photo</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
