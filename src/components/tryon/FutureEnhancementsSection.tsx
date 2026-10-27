import { useState } from "react";
import {
  Wand2,
  Columns2,
  Sparkles,
  Layers,
  Ruler,
  Rotate3d,
  History,
  CheckCircle2,
  ArrowRight,
  X,
  BellRing,
  Check,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface EnhancementFeature {
  id: string;
  category: "neural" | "styling" | "wardrobe";
  categoryLabel: string;
  title: string;
  tagline: string;
  description: string;
  icon: typeof Wand2;
  phase: string;
  highlights: string[];
  technicalSpecs: {
    label: string;
    value: string;
  }[];
  previewDescription: string;
}

export const FUTURE_ENHANCEMENTS: EnhancementFeature[] = [
  {
    id: "catvton-diffusion",
    category: "neural",
    categoryLabel: "Neural Vision",
    title: "Realistic Virtual Try-On with CatVTON",
    tagline: "Diffusion-powered garment transfer & cloth warping",
    description:
      "Advanced diffusion model with attention-based cloth warping that simulates realistic fabric drape, micro-creases, button tension, and natural body occlusion on your Virtual Me twin.",
    icon: Wand2,
    phase: "Phase 1 · In Active Development",
    highlights: [
      "Sub-millimeter fabric drape & natural shadow physics",
      "Preserves original buttons, embroidery, patterns & textures",
      "Seamless multi-layering (e.g., blazer over silk shirt)",
    ],
    technicalSpecs: [
      { label: "Architecture", value: "CatVTON Latent Diffusion + Spatial Cross-Attention" },
      { label: "Fidelity", value: "Ultra-High 1024×1365px Garment Transfer" },
      { label: "Body Occlusion", value: "DensePose & Anatomical Segmentation Masking" },
    ],
    previewDescription:
      "Unlike flat image overlays, CatVTON computes true 3D spatial warping, draping tailored lapels over shoulders and allowing garments to stretch and fold naturally with posture changes.",
  },
  {
    id: "multi-outfit-comparison",
    category: "neural",
    categoryLabel: "Neural Vision",
    title: "Multiple Outfit Comparison",
    tagline: "Side-by-side silhouette & chromatic analysis",
    description:
      "Compare up to four distinct curated outfits side-by-side on your identical Virtual Me twin. Benchmark hemlines, collar heights, and color palettes before committing to an event look.",
    icon: Columns2,
    phase: "Phase 2 · Q3 2026",
    highlights: [
      "Simultaneous 2-to-4 outfit side-by-side rendering",
      "Synchronized pan and zoom across all silhouettes",
      "Palette harmony and occasion versatility scoring",
    ],
    technicalSpecs: [
      { label: "Comparison Grid", value: "2-Up & 4-Up Synchronized Canvas" },
      { label: "Silhouette Diff", value: "Contour & Proportions Benchmark Engine" },
      { label: "Palette Check", value: "WCAG Chromatic Contrast & Undertone Matching" },
    ],
    previewDescription:
      "Evaluate whether a double-breasted navy blazer or a structured camel trench flatters your neckline more effectively, with real-time synchronized rotation and lighting.",
  },
  {
    id: "personalized-recommendations",
    category: "styling",
    categoryLabel: "Styling & Fit",
    title: "Personalized Fashion Recommendations",
    tagline: "Weather, occasion & chromatic undertone styling",
    description:
      "Contextual styling intelligence connecting your Google Calendar events, local microclimate forecasts, and personal chromatic palette to synthesize bespoke daily outfits.",
    icon: Sparkles,
    phase: "Phase 2 · Q3 2026",
    highlights: [
      "Real-time precipitation & temperature-adapted layering",
      "Automated dress-code compliance for boardroom to black-tie",
      "Monochromatic, analogous & complementary color harmony",
    ],
    technicalSpecs: [
      { label: "Intelligence", value: "Gemini Pro Multimodal Stylist Engine" },
      { label: "Data Streams", value: "Hyperlocal Weather + Calendar Dress Codes" },
      { label: "Chromatic Profiling", value: "Seasonal Color Analysis (Spring/Summer/Autumn/Winter)" },
    ],
    previewDescription:
      "Wake up to curated looks tailored to whether it will rain during your 2:00 PM presentation, ensuring fabrics stay breathable and outerwear complements your shoes.",
  },
  {
    id: "virtual-wardrobe",
    category: "wardrobe",
    categoryLabel: "Wardrobe Analytics",
    title: "Intelligent Virtual Wardrobe",
    tagline: "Automated digital closet & capsule optimizer",
    description:
      "Effortlessly digitize your entire physical closet with instant AI background removal, automated fabric and category classification, and smart cost-per-wear tracking.",
    icon: Layers,
    phase: "Phase 2 · Q3 2026",
    highlights: [
      "Zero-effort smartphone photo cutout and background removal",
      "Automated fabric composition & wash-care metadata",
      "Capsule wardrobe builder to maximize rotation frequency",
    ],
    technicalSpecs: [
      { label: "Segmentation", value: "Bi-directional Salient Cloth Cutout" },
      { label: "Tagging Engine", value: "Zero-Shot Fashion Taxonomy Classifier" },
      { label: "Analytics", value: "Wear-Frequency & Cost-Per-Wear ROI Tracking" },
    ],
    previewDescription:
      "Photograph your pieces on a bed or hanger; VÉSTARA extracts the studio-grade silhouette and integrates it into your personal endless digital closet.",
  },
  {
    id: "smart-size-suggestions",
    category: "styling",
    categoryLabel: "Styling & Fit",
    title: "Smart Size & Fit Suggestions",
    tagline: "Biometric tailoring curves & brand sizing curves",
    description:
      "Personalized fit intelligence calculating your exact chest, waist, shoulder, and inseam measurements from your photo, cross-referenced against individual designer size charts.",
    icon: Ruler,
    phase: "Phase 3 · Q4 2026",
    highlights: [
      "Translates US, UK, EU, and Asian designer sizing tolerances",
      "Elasticity & fabric stretch factor compensation",
      "Proactive alerts for slim, relaxed, or boxy cuts",
    ],
    technicalSpecs: [
      { label: "Biometrics", value: "MediaPipe 33-Keypoint Anatomical Mesh" },
      { label: "Size Matrix", value: "500+ Luxury & Contemporary Brand Sizing Curves" },
      { label: "Accuracy", value: "98.4% First-Order Fit Confidence" },
    ],
    previewDescription:
      "Never guess between an Italian 48 or 50 again. VÉSTARA factors in whether the designer runs narrow in the chest or long in the sleeves.",
  },
  {
    id: "360-outfit-previews",
    category: "neural",
    categoryLabel: "Neural Vision",
    title: "360° Multi-Angle Studio",
    tagline: "Dynamic panoramic rotation with drape physics",
    description:
      "Interactive 360-degree rotation showing how the outfit falls from the front, profile, 45-degree angle, and back. Observe vent splits, trouser breaks, and silhouette line in motion.",
    icon: Rotate3d,
    phase: "Phase 1 · Alpha Preview",
    highlights: [
      "Continuous drag or touch-based full rotational turntable",
      "Realistic back yoke, waist band, and rear pocket fidelity",
      "Natural lighting highlights shifting with view angle",
    ],
    technicalSpecs: [
      { label: "Synthesis", value: "Multi-View Latent Conditioning + NeRF/Gaussian Splat" },
      { label: "Angles", value: "Front, Right Profile, Rear 180°, Left Profile" },
      { label: "Frame Rate", value: "Smooth 60 FPS Interactive Scrubbing" },
    ],
    previewDescription:
      "Ensure the rear vents on your suit jacket sit flat without flaring, and inspect how trouser cuffs break over your footwear from every perspective.",
  },
  {
    id: "outfit-history-diary",
    category: "wardrobe",
    categoryLabel: "Wardrobe Analytics",
    title: "Outfit History & Lookbook Diary",
    tagline: "Chronological fit memory & aesthetic timeline",
    description:
      "An editorial timeline archiving every virtual fit and real-world wear. Track when you wore each piece, tag social events, and prevent unintentional outfit repetition.",
    icon: History,
    phase: "Phase 2 · Q3 2026",
    highlights: [
      "Visual timeline archive of all synthesized looks",
      "Event tagging and personal fit comfort ratings (1–5 stars)",
      "Smart duplicate alert for upcoming recurring guest lists",
    ],
    technicalSpecs: [
      { label: "Storage", value: "Encrypted High-Res Lookbook Archive" },
      { label: "Metadata", value: "Event Name, Wear Date, Comfort Rating, Weather" },
      { label: "Integration", value: "Exportable High-Fashion PDF Lookbook" },
    ],
    previewDescription:
      "Browse through your favorite Autumn 2025 ensembles, review what you wore to last year's gala, and build a cohesive personal fashion archive.",
  },
];

export function FutureEnhancementsSection() {
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "neural" | "styling" | "wardrobe"
  >("all");
  const [activeModalFeature, setActiveModalFeature] = useState<EnhancementFeature | null>(null);
  const [notifiedFeatures, setNotifiedFeatures] = useState<Record<string, boolean>>({});

  const filteredFeatures =
    selectedCategory === "all"
      ? FUTURE_ENHANCEMENTS
      : FUTURE_ENHANCEMENTS.filter((f) => f.category === selectedCategory);

  const handleNotifyMe = (feature: EnhancementFeature) => {
    setNotifiedFeatures((prev) => ({ ...prev, [feature.id]: true }));
    toast.success(`You're on the priority waitlist for ${feature.title}!`, {
      description: "We'll notify you as soon as early access goes live.",
    });
  };

  return (
    <section className="mt-12 rounded-3xl border border-border/80 bg-card p-6 md:p-8 shadow-soft">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-bronze">
            <Sparkles className="size-3.5 text-bronze" />
            <span>Roadmap & Innovation</span>
          </div>
          <h2 className="mt-1 font-serif text-2xl md:text-3xl tracking-tight text-foreground">
            Future Enhancements
          </h2>
          <p className="mt-1.5 max-w-2xl text-xs md:text-sm text-muted-foreground leading-relaxed">
            Our next-generation virtual styling suite is actively expanding. Explore the upcoming
            neural vision, biometric sizing, and automated wardrobe technologies engineered for
            VÉSTARA.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-surface/80 p-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              selectedCategory === "all"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All Features ({FUTURE_ENHANCEMENTS.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("neural")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              selectedCategory === "neural"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Neural Vision (3)
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("styling")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              selectedCategory === "styling"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Styling & Fit (2)
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory("wardrobe")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              selectedCategory === "wardrobe"
                ? "bg-card text-foreground shadow-2xs font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Wardrobe & History (2)
          </button>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredFeatures.map((feature, index) => {
          const Icon = feature.icon;
          const isNotified = Boolean(notifiedFeatures[feature.id]);
          const isCatVTON = feature.id === "catvton-diffusion";

          return (
            <div
              key={feature.id}
              onClick={() => setActiveModalFeature(feature)}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-300 cursor-pointer bg-card/60 hover:bg-card hover:-translate-y-1 hover:shadow-soft",
                isCatVTON
                  ? "border-bronze/40 bg-gradient-to-b from-champagne/15 to-transparent md:col-span-2 lg:col-span-2"
                  : "border-border/70 hover:border-bronze/40",
              )}
            >
              {/* Card Top Strip */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl transition-colors duration-300",
                        isCatVTON
                          ? "bg-bronze text-white shadow-xs"
                          : "bg-surface text-bronze border border-border group-hover:bg-bronze group-hover:text-white",
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
                        {feature.categoryLabel}
                      </span>
                      <p className="text-[11px] text-bronze/80 font-mono">0{index + 1}</p>
                    </div>
                  </div>

                  {/* Coming Soon Badge */}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-bronze/35 bg-bronze/10 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-bronze">
                    <span className="size-1.5 rounded-full bg-bronze animate-pulse" />
                    Coming Soon
                  </span>
                </div>

                {/* Title & Tagline */}
                <div className="mt-4">
                  <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground group-hover:text-bronze transition-colors">
                    {feature.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground font-medium">
                    {feature.tagline}
                  </p>
                </div>

                {/* Description */}
                <p className="mt-2.5 text-xs text-muted-foreground/90 leading-relaxed">
                  {feature.description}
                </p>

                {/* Highlights */}
                <ul className="mt-3.5 space-y-1.5 border-t border-border/50 pt-3">
                  {feature.highlights.map((highlight, hIdx) => (
                    <li
                      key={hIdx}
                      className="flex items-start gap-2 text-[11px] text-foreground/80 leading-snug"
                    >
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-bronze/80" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Card Footer */}
              <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-3.5">
                <span className="text-[11px] text-muted-foreground/70 font-mono">
                  {feature.phase}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-bronze group-hover:underline inline-flex items-center gap-1">
                    Preview Spec <ChevronRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Release Roadmap Banner */}
      <div className="mt-8 rounded-2xl border border-bronze/25 bg-champagne/15 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-bronze uppercase tracking-wider">
              <Sparkles className="size-3.5 text-bronze" />
              <span>VÉSTARA Innovation Lab</span>
            </div>
            <h4 className="font-serif text-base md:text-lg text-foreground">
              Building the Future of Autonomous Wardrobe Intelligence
            </h4>
            <p className="text-xs text-muted-foreground max-w-xl">
              These features are staged in private evaluation benchmarks. Have feedback or want early
              access to a specific module? Join our VIP collector preview.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="champagne"
              size="sm"
              onClick={() => {
                toast.success("Joined VÉSTARA Innovation Preview!", {
                  description: "You will receive exclusive early access invites via email.",
                });
              }}
              className="gap-1.5 text-xs cursor-pointer"
            >
              <BellRing className="size-3.5" /> Join VIP Preview List
            </Button>
          </div>
        </div>
      </div>

      {/* Feature Detail Modal */}
      {activeModalFeature && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setActiveModalFeature(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-card p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModalFeature(null)}
              className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-bronze/10 text-bronze border border-bronze/20">
                <activeModalFeature.icon className="size-6" />
              </div>
              <div>
                <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
                  {activeModalFeature.categoryLabel} · {activeModalFeature.phase}
                </span>
                <h3 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                  {activeModalFeature.title}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <div className="mt-5 space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Feature Overview
                </h4>
                <p className="mt-1 text-xs md:text-sm text-foreground/90 leading-relaxed">
                  {activeModalFeature.previewDescription}
                </p>
              </div>

              {/* Technical Specifications */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Technical Specifications
                </h4>
                <div className="mt-2 space-y-1.5 rounded-xl border border-border/70 bg-surface/70 p-3">
                  {activeModalFeature.technicalSpecs.map((spec, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-baseline justify-between gap-2 text-xs border-b border-border/40 last:border-0 pb-1.5 last:pb-0"
                    >
                      <span className="text-muted-foreground font-medium">{spec.label}</span>
                      <span className="font-mono text-[11px] text-foreground text-right">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Capabilities */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Key Capabilities
                </h4>
                <ul className="mt-2 space-y-1.5">
                  {activeModalFeature.highlights.map((h, hIdx) => (
                    <li
                      key={hIdx}
                      className="flex items-start gap-2 text-xs text-foreground/80 leading-snug"
                    >
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-bronze" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4">
              <span className="text-xs text-muted-foreground">Visual Preview · Coming Soon</span>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="quiet"
                  size="sm"
                  onClick={() => setActiveModalFeature(null)}
                  className="text-xs"
                >
                  Close
                </Button>

                <Button
                  type="button"
                  variant={notifiedFeatures[activeModalFeature.id] ? "outline" : "champagne"}
                  size="sm"
                  onClick={() => handleNotifyMe(activeModalFeature)}
                  disabled={Boolean(notifiedFeatures[activeModalFeature.id])}
                  className="gap-1.5 text-xs cursor-pointer"
                >
                  {notifiedFeatures[activeModalFeature.id] ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" /> Waitlisted
                    </>
                  ) : (
                    <>
                      <BellRing className="size-3.5" /> Notify Me
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
