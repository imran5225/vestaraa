import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/States";

export const Route = createFileRoute("/_authenticated/stylist")({
  head: () => ({ meta: [{ title: "Stylist — VÉSTARA" }, { name: "description", content: "Stylist in VÉSTARA." }, { property: "og:title", content: "Stylist — VÉSTARA" }, { property: "og:description", content: "Stylist in VÉSTARA." }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader eyebrow="VÉSTARA" title="Stylist" body="This screen is still being built." />
    </AppShell>
  );
}
