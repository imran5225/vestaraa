import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/States";

export const Route = createFileRoute("/_authenticated/wardrobe")({
  head: () => ({ meta: [{ title: "Wardrobe — VÉSTARA" }, { name: "description", content: "Wardrobe in VÉSTARA." }, { property: "og:title", content: "Wardrobe — VÉSTARA" }, { property: "og:description", content: "Wardrobe in VÉSTARA." }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader eyebrow="VÉSTARA" title="Wardrobe" body="This screen is still being built." />
    </AppShell>
  );
}
