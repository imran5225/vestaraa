import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/layout/SiteChrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — VÉSTARA" }, { name: "description", content: "VÉSTARA privacy information." }, { property: "og:title", content: "Privacy — VÉSTARA" }, { property: "og:description", content: "VÉSTARA privacy information." }] }),
  component: () => (
    <LegalPage title="Privacy">
      <p>This page is a placeholder. Final privacy content still needs to be written.</p>
    </LegalPage>
  ),
});
