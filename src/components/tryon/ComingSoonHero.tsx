import { useState } from "react";
import { Sparkles, BellRing, Check, Wand2, Rotate3d, Ruler, ArrowRight, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

export function ComingSoonHero() {
  const navigate = useNavigate();
  const [isNotified, setIsNotified] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const handleNotify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsNotified(true);
    toast.success("You are on the VÉSTARA Virtual Try-On priority list!", {
      description: "We'll notify you as soon as the CatVTON neural engine goes live.",
    });
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-bronze/35 bg-gradient-to-b from-champagne/25 via-card/80 to-card p-6 md:p-10 shadow-soft mb-8">
      {/* Decorative luxury background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-bronze/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-champagne/30 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
        {/* Prominent Coming Soon Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-bronze/40 bg-bronze/10 px-4 py-1 text-xs font-semibold tracking-wider text-bronze uppercase">
          <span className="size-2 rounded-full bg-bronze animate-pulse" />
          <span>Coming Soon · Neural Try-On</span>
        </div>

        {/* Main Headline */}
        <h1 className="mt-4 font-serif text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-foreground leading-tight">
          AI Virtual Try-On is <span className="italic text-bronze">Coming Soon</span>
        </h1>

        {/* Detailed Editorial Description */}
        <p className="mt-3.5 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
          We are engineering our next-generation realistic virtual try-on experience powered by{" "}
          <strong className="font-semibold text-foreground">CatVTON neural diffusion</strong>, 360°
          volumetric rotation, and precision biometric tailoring curves. Soon, you will be able to
          experience any garment draped photorealistically onto your person with authentic fabric
          folds, lighting shadows, and natural body proportions.
        </p>

        {/* Key Feature Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/90 px-3 py-1.5 text-foreground/90 shadow-2xs">
            <Wand2 className="size-3.5 text-bronze" />
            <span>CatVTON Neural Cloth Warping</span>
            <span className="text-[10px] text-bronze font-medium">· Coming Soon</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/90 px-3 py-1.5 text-foreground/90 shadow-2xs">
            <Rotate3d className="size-3.5 text-bronze" />
            <span>360° Multi-Angle Studio</span>
            <span className="text-[10px] text-bronze font-medium">· Coming Soon</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border/80 bg-surface/90 px-3 py-1.5 text-foreground/90 shadow-2xs">
            <Ruler className="size-3.5 text-bronze" />
            <span>Smart Biometric Fit</span>
            <span className="text-[10px] text-bronze font-medium">· Coming Soon</span>
          </div>
        </div>

        {/* Interactive Waitlist Action */}
        <div className="mt-7 w-full max-w-md">
          {isNotified ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
              <Check className="size-4 text-emerald-600" />
              <span>You're on the priority VIP preview list! We will notify you at launch.</span>
            </div>
          ) : (
            <form onSubmit={handleNotify} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="Enter your email for early access…"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="flex-1 rounded-xl border border-border/80 bg-card px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-bronze"
              />
              <Button
                type="submit"
                variant="champagne"
                size="sm"
                className="gap-1.5 text-xs h-10 px-4 shrink-0"
              >
                <BellRing className="size-3.5" /> Notify Me
              </Button>
            </form>
          )}
        </div>

        {/* Navigation to active areas */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
          <span>In the meantime, explore:</span>
          <button
            type="button"
            onClick={() => navigate({ to: "/wardrobe" })}
            className="inline-flex items-center gap-1 font-medium text-bronze hover:underline cursor-pointer"
          >
            <Shirt className="size-3.5" /> My Wardrobe
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => navigate({ to: "/stylist" })}
            className="inline-flex items-center gap-1 font-medium text-bronze hover:underline cursor-pointer"
          >
            <Sparkles className="size-3.5" /> AI Stylist
          </button>
        </div>
      </div>
    </section>
  );
}
