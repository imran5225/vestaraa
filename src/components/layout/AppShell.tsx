import type { ReactNode } from "react";
import { Navbar, useSignOut, NAVIGATION_LINKS } from "./Navbar";

export { useSignOut, NAVIGATION_LINKS };

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-5 py-10 md:py-14">{children}</main>
    </div>
  );
}
