import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/layout/SiteChrome";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — VÉSTARA" }, { name: "description", content: "VÉSTARA contact information." }, { property: "og:title", content: "Contact — VÉSTARA" }, { property: "og:description", content: "VÉSTARA contact information." }] }),
  component: () => (
    <LegalPage title="Contact">
      <p>This page is a placeholder. Final contact content still needs to be written.</p>
    </LegalPage>
  ),
});
