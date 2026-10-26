import { useState, useRef, useCallback, useEffect } from "react";
import { Download, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  outfitName?: string;
  onTryAnotherOutfit?: () => void;
  className?: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  outfitName = "Custom Ensemble",
  onTryAnotherOutfit,
  className,
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50); // percentage 0 - 100
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clamped = Math.max(0, Math.min(rect.width, x));
    const percent = (clamped / rect.width) * 100;
    setSliderPosition(percent);
  }, []);

  const handleMouseDown = () => setIsDragging(true);

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
    };
  }, [isDragging, handleMove]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = afterImage;
    a.download = `vestara-look-${outfitName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;
    a.click();
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Slider Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
        onClick={(e) => handleMove(e.clientX)}
        className="group relative aspect-[3/4] w-full max-w-lg cursor-ew-resize select-none overflow-hidden rounded-3xl border border-border/80 bg-surface shadow-lift"
      >
        {/* 'After' Image (Virtual Try-On Output, full background) */}
        <img
          src={afterImage}
          alt={`Try-On: ${outfitName}`}
          className="absolute inset-0 h-full w-full object-cover object-top"
          draggable={false}
        />

        {/* 'Before' Image (Original User Photo, clipped horizontally) */}
        <div
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={beforeImage}
            alt="Original Photo"
            className="absolute inset-0 h-full max-w-none object-cover object-top"
            style={{
              width: containerWidth > 0 ? `${containerWidth}px` : "100%",
              height: "100%",
            }}
            draggable={false}
          />
        </div>

        {/* Divider Bar & Handle */}
        <div
          className="pointer-events-none absolute inset-y-0"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Vertical line */}
          <div className="absolute inset-y-0 -left-[1px] w-[2px] bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)]" />

          {/* Central Handle Button */}
          <div className="absolute top-1/2 -left-4 -translate-y-1/2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-foreground/90 text-white shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-4 3 4 3m8-6l4 3-4 3" />
            </svg>
          </div>
        </div>

        {/* Badges / Pill Tags */}
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-md">
          Original Photo
        </div>
        <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-bronze/90 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
          <Sparkles className="size-3.5" />
          Virtual Try-On
        </div>

        {/* Bottom Helper Bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 text-white">
          <p className="text-sm font-medium tracking-wide">{outfitName}</p>
          <p className="text-xs text-white/70">Drag slider left/right to inspect transformation</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="champagne" onClick={handleDownload} className="gap-2">
          <Download className="size-4" /> Download Look
        </Button>
        {onTryAnotherOutfit && (
          <Button variant="quiet" onClick={onTryAnotherOutfit} className="gap-2">
            <RefreshCw className="size-4" /> Try Another Outfit
          </Button>
        )}
      </div>
    </div>
  );
}
