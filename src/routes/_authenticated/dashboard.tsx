import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CloudSun, Shirt, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/States";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { Button } from "@/components/ui/button";
import { OCCASIONS } from "@/lib/domain";
import { outfitQuery, outfitsQuery, profileQuery, wardrobeQuery } from "@/lib/queries";
import { generateOutfit, getWeather, loadSampleWardrobe } from "@/lib/styling.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Today — VÉSTARA" },
      { name: "description", content: "Today's outfit, built from your wardrobe." },
      { property: "og:title", content: "Today — VÉSTARA" },
      { property: "og:description", content: "Today's outfit, built from your wardrobe." },
    ],
  }),
  component: Page,
});

export function useGenerate(onDone: (id: string) => void) {
  const qc = useQueryClient();
  const fn = useServerFn(generateOutfit);
  return useMutation({
    mutationFn: (v: { occasion: string; mood?: string | null }) => fn({ data: v }),
    onSuccess: (r) => {
      if (!r.ok) return void toast.error(r.reason);
      qc.invalidateQueries({ queryKey: ["outfits"] });
      onDone(r.outfitId);
    },
    onError: () => toast.error("Couldn't build an outfit. Please try again."),
  });
}

export function useLoadSamples() {
  const qc = useQueryClient();
  const fn = useServerFn(loadSampleWardrobe);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["wardrobe"] });
      toast.success(
        r.added ? `Added ${r.added} sample pieces.` : "Sample wardrobe already loaded.",
      );
    },
    onError: () => toast.error("Couldn't add the sample wardrobe."),
  });
}

function Page() {
  const profile = useQuery(profileQuery);
  const wardrobe = useQuery(wardrobeQuery);
  const recent = useQuery(outfitsQuery("all", 1));
  const weatherFn = useServerFn(getWeather);
  const weather = useQuery({
    queryKey: ["weather"],
    queryFn: () => weatherFn(),
    staleTime: 15 * 60 * 1000,
  });
  const [occasion, setOccasion] = useState("casual");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const shownId = currentId ?? recent.data?.[0]?.id ?? null;
  const outfit = useQuery(outfitQuery(shownId));
  const gen = useGenerate(setCurrentId);
  const samples = useLoadSamples();

  const name = profile.data?.display_name?.split(" ")[0];
  const count = wardrobe.data?.length ?? 0;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Today"
        title={name ? `Good to see you, ${name}.` : "Your look for today"}
        body="Pick the occasion and we'll build a complete outfit from your wardrobe."
      />

      {profile.data && !profile.data.onboarded && (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-champagne/30 p-4 text-sm">
          <span>Tell us your style and favourite colours for sharper suggestions.</span>
          <Button asChild size="sm" variant="quiet">
            <Link to="/profile">Set up your profile</Link>
          </Button>
        </div>
      )}

      {weather.data?.status === "ok" && (
        <p className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <CloudSun className="h-4 w-4 text-bronze" /> {weather.data.weather.city}:{" "}
          {Math.round(weather.data.weather.temperatureC)}°C, {weather.data.weather.description}
        </p>
      )}

      {wardrobe.isLoading ? (
        <LoadingState label="Loading your wardrobe" />
      ) : wardrobe.error ? (
        <ErrorState message="We couldn't load your wardrobe." onRetry={() => wardrobe.refetch()} />
      ) : count === 0 ? (
        <EmptyState
          icon={<Shirt className="h-8 w-8" />}
          title="Your wardrobe is empty"
          body="Add a few pieces — at least a top, a bottom and shoes — or try the sample wardrobe to explore."
          action={
            <>
              <Button asChild variant="hero">
                <Link to="/wardrobe">Add clothes</Link>
              </Button>
              <Button variant="quiet" disabled={samples.isPending} onClick={() => samples.mutate()}>
                Load sample wardrobe
              </Button>
            </>
          }
        />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setOccasion(o.value)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors",
                  occasion === o.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:border-bronze",
                )}
              >
                {o.label}
              </button>
            ))}
            <Button
              variant="hero"
              className="ml-auto"
              disabled={gen.isPending}
              onClick={() => gen.mutate({ occasion })}
            >
              <Sparkles className={cn(gen.isPending && "animate-pulse")} />{" "}
              {gen.isPending ? "Styling…" : "Style me"}
            </Button>
          </div>
          {outfit.isLoading ? (
            <LoadingState label="Loading your look" />
          ) : outfit.data ? (
            <OutfitCard outfit={outfit.data} onReplaced={setCurrentId} />
          ) : (
            <EmptyState title="No look yet" body="Choose an occasion and tap “Style me”." />
          )}
        </div>
      )}
    </AppShell>
  );
}
