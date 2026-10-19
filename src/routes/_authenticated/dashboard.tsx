import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/States";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VÉSTARA" }, { name: "description", content: "Dashboard in VÉSTARA." }, { property: "og:title", content: "Dashboard — VÉSTARA" }, { property: "og:description", content: "Dashboard in VÉSTARA." }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader eyebrow="VÉSTARA" title="Dashboard" body="This screen is still being built." />
    </AppShell>
  );
}
