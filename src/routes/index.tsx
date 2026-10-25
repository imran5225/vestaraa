import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Camera, CloudSun, MessageCircle, Sparkles } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome";
import { Button } from "@/components/ui/button";
import { SAMPLE_IMAGES } from "@/lib/sample-images";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VÉSTARA — Your Personal AI Style Agent" },
      {
        name: "description",
        content:
          "Photograph your clothes and get occasion-aware outfits built only from what you already own.",
      },
      { property: "og:title", content: "VÉSTARA — Your Personal AI Style Agent" },
      {
        property: "og:description",
        content: "Occasion-aware outfits built from the clothes you already own.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Camera,
    title: "Digitise your wardrobe",
    body: "Snap a photo and the AI suggests the category, colour, pattern and season for each piece.",
  },
  {
    icon: Sparkles,
    title: "Outfits for the occasion",
    body: "College, work, evening or travel — get complete looks from clothes you actually own.",
  },
  {
    icon: CloudSun,
    title: "Weather-aware",
    body: "Turn on live weather and your looks layer up or lighten up automatically.",
  },
  {
    icon: MessageCircle,
    title: "A stylist to talk to",
    body: "Ask to swap the shoes, make it smarter, or plan a dinner look — in plain words.",
  },
];

function Landing() {
  const imgs = Object.values(SAMPLE_IMAGES).slice(0, 4);
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-24">
          <div className="fade-up">
            <p className="eyebrow">Your personal AI style agent</p>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-7xl">
              Dress well from the wardrobe you already have.
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              VÉSTARA learns your clothes and your taste, then builds the right outfit for every day
              and every occasion.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/auth">
                  Get started <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="quiet" size="lg">
                <Link to="/" hash="how-it-works">
                  How it works
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {imgs.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                className={`aspect-[4/5] w-full rounded-2xl object-cover shadow-soft ${i % 2 ? "mt-8" : ""}`}
              />
            ))}
          </div>
        </section>

        <section id="features" className="border-t bg-surface/40">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <p className="eyebrow">Features</p>
            <h2 className="mt-2 text-4xl">Everything a stylist does, in your pocket.</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                  <f.icon className="h-6 w-6 text-bronze" strokeWidth={1.5} />
                  <h3 className="mt-4 text-xl">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-20">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-2 text-4xl">Three steps to a better morning.</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              "Add your clothes — or try the sample wardrobe.",
              "Tell us your style, favourite colours and city.",
              "Pick an occasion and get a complete look, with reasons.",
            ].map((s, i) => (
              <li key={s} className="border-t pt-6">
                <span className="font-display text-5xl text-bronze">0{i + 1}</span>
                <p className="mt-3 text-lg">{s}</p>
              </li>
            ))}
          </ol>
          <Button asChild variant="hero" size="lg" className="mt-12">
            <Link to="/auth">Create your wardrobe</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
