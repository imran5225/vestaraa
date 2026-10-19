import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Wordmark />
        <nav className="flex items-center gap-1 text-sm" aria-label="Site">
          <Link to="/" hash="features" className="hidden rounded-full px-4 py-2 text-muted-foreground hover:text-foreground sm:inline">Features</Link>
          <Link to="/" hash="how-it-works" className="hidden rounded-full px-4 py-2 text-muted-foreground hover:text-foreground sm:inline">How It Works</Link>
          <Button asChild variant="quiet" size="sm" className="ml-2">
            <Link to="/auth">Sign In</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <Wordmark className="text-xl" />
          <p className="mt-2 text-sm text-muted-foreground">From wardrobe to the right outfit — powered by AI.</p>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground" aria-label="Legal">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/contact" className="hover:text-foreground">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-5 py-16">
        <p className="eyebrow">VÉSTARA</p>
        <h1 className="mt-2 text-5xl">{title}</h1>
        <div className="mt-8 space-y-4 leading-relaxed text-foreground/85">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
