import { useState, useRef, useCallback, useEffect } from "react";
import { Download, ChevronLeft, ChevronRight, Rotate3d, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiAngleViews {
  front: string;
  left: string;
  back: string;
  right: string;
}

interface RotateViewViewerProps {
  views: MultiAngleViews;
  outfitName?: string;
  className?: string;
}

const ANGLES = [
  { key: "front" as const, label: "Front View", degrees: 0 },
  { key: "left" as const, label: "Left Profile", degrees: 90 },
  { key: "back" as const, label: "Back View", degrees: 180 },
  { key: "right" as const, label: "Right Profile", degrees: 270 },
];

export function RotateViewViewer({
  views,
  outfitName = "Lookbook Ensemble",
  className,
}: RotateViewViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentAngle = ANGLES[currentIndex] ?? ANGLES[0]!;
  const currentImage = views[currentAngle.key];

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % 4);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + 4) % 4);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      setIsDragging(true);
      dragStartX.current = e.touches[0].clientX;
    }
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX.current;
      const threshold = 45; // pixels to step one view
      if (deltaX > threshold) {
        handlePrev();
        dragStartX.current = e.clientX;
      } else if (deltaX < -threshold) {
        handleNext();
        dragStartX.current = e.clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      const deltaX = e.touches[0].clientX - dragStartX.current;
      const threshold = 45;
      if (deltaX > threshold) {
        handlePrev();
        dragStartX.current = e.touches[0].clientX;
      } else if (deltaX < -threshold) {
        handleNext();
        dragStartX.current = e.touches[0].clientX;
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
  }, [isDragging, handleNext, handlePrev]);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = currentImage;
    a.download = `vestara-look-${currentAngle.key}-${outfitName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.jpg`;
    a.click();
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {/* 360 Viewport Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="group relative aspect-[3/4] w-full max-w-lg cursor-grab active:cursor-grabbing select-none overflow-hidden rounded-3xl border border-border/80 bg-surface shadow-lift"
      >
        {/* Active Angle Photo */}
        <img
          src={currentImage}
          alt={`${currentAngle.label} - ${outfitName}`}
          className="absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-200"
          draggable={false}
        />

        {/* Top Floating Badge */}
        <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
          <Rotate3d className="size-3.5 text-bronze" />
          <span>360° Rotate View</span>
          <span className="text-white/60">·</span>
          <span>{currentAngle.degrees}°</span>
        </div>

        {/* Current Angle Label */}
        <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-bronze/90 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-md">
          {currentAngle.label}
        </div>

        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/70 hover:scale-105 active:scale-95"
          aria-label="Previous angle"
        >
          <ChevronLeft className="size-5" />
        </button>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-all hover:bg-black/70 hover:scale-105 active:scale-95"
          aria-label="Next angle"
        >
          <ChevronRight className="size-5" />
        </button>

        {/* Bottom Helper Bar */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 text-white">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium tracking-wide">{outfitName}</span>
            <span className="text-white/70">Drag left/right to rotate</span>
          </div>
        </div>
      </div>

      {/* Angle Selector Tabs & Stepper */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {ANGLES.map((angle, idx) => (
          <button
            key={angle.key}
            onClick={() => setCurrentIndex(idx)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              currentIndex === idx
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/80 bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            <Compass className="size-3" />
            <span>{angle.label}</span>
          </button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <Button variant="champagne" size="sm" onClick={handleDownload} className="gap-2 text-xs">
          <Download className="size-3.5" /> Download Current Angle ({currentAngle.label})
        </Button>
      </div>
    </div>
  );
}
