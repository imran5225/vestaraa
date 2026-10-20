import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/common/States";
import { OutfitCard } from "@/components/outfits/OutfitCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { outfitsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/recommendations")({
  head: () => ({ meta: [{ title: "Looks — VÉSTARA" }, { name: "description", content: "Your saved and recent outfits." }, { property: "og:title", content: "Looks — VÉSTARA" }, { property: "og:description", content: "Your saved and recent outfits." }] }),
  component: Page,
});

function Page() {
  const [filter, setFilter] = useState<"all" | "saved">("all");
  const q = useQuery(outfitsQuery(filter, 30));
  return (
    <AppShell>
      <PageHeader eyebrow="Looks" title="Your outfits" body="Every look we've built for you. Save the ones you love."
        actions={<Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "saved")}><TabsList><TabsTrigger value="all">Recent</TabsTrigger><TabsTrigger value="saved">Saved</TabsTrigger></TabsList></Tabs>} />
      {q.isLoading ? <LoadingState /> : q.error ? <ErrorState message="We couldn't load your looks." onRetry={() => q.refetch()} /> :
        !q.data?.length ? <EmptyState title={filter === "saved" ? "No saved looks yet" : "No looks yet"} body="Head to Today and tap “Style me” to get your first outfit." /> : (
          <div className="grid gap-6 lg:grid-cols-2">{q.data.map((o) => <OutfitCard key={o.id} outfit={o} />)}</div>
        )}
    </AppShell>
  );
}
