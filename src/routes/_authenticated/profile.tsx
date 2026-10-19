import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/common/States";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — VÉSTARA" }, { name: "description", content: "Profile in VÉSTARA." }, { property: "og:title", content: "Profile — VÉSTARA" }, { property: "og:description", content: "Profile in VÉSTARA." }] }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <PageHeader eyebrow="VÉSTARA" title="Profile" body="This screen is still being built." />
    </AppShell>
  );
}
