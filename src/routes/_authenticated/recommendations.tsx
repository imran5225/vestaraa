import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/States";

export const Route = createFileRoute("/_authenticated/recommendations")({
  head: () => ({ meta: [{ title: "Recommendations — VÉSTARA" }, { name: "description", content: "Recommendations in VÉSTARA." }, { property: "og:title", content: "Recommendations — VÉSTARA" }, { property: "og:description", content: "Recommendations in VÉSTARA." }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader eyebrow="VÉSTARA" title="Recommendations" body="This screen is still being built." />
    </AppShell>
  );
}
