import { Shirt } from "lucide-react";
import type { WardrobeItem } from "@/lib/domain";
import { SAMPLE_IMAGES } from "@/lib/sample-images";
import { cn } from "@/lib/utils";

interface Props {
  item: Pick<WardrobeItem, "name" | "image_path" | "sample_key">;
  signedUrls?: Record<string, string> | undefined;
  className?: string;
}

/** Shows the garment photo (sample asset or signed storage URL), else a placeholder. */
export function ItemImage({ item, signedUrls, className }: Props) {
  const src = item.sample_key
    ? SAMPLE_IMAGES[item.sample_key]
    : item.image_path
      ? signedUrls?.[item.image_path]
      : undefined;
  return (
    <div className={cn("relative aspect-[4/5] overflow-hidden rounded-xl bg-surface", className)}>
      {src ? (
        <img src={src} alt={item.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-taupe">
          <Shirt className="h-8 w-8" strokeWidth={1.2} />
          <span className="text-xs">No photo</span>
        </div>
      )}
    </div>
  );
}
