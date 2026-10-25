import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/layout/SiteChrome";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — VÉSTARA" },
      { name: "description", content: "VÉSTARA terms information." },
      { property: "og:title", content: "Terms — VÉSTARA" },
      { property: "og:description", content: "VÉSTARA terms information." },
    ],
  }),
  component: () => (
    <LegalPage title="Terms">
      <p>This page is a placeholder. Final terms content still needs to be written.</p>
    </LegalPage>
  ),
});
