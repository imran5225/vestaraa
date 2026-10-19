import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/dashboard", label: "Today" },
  { to: "/wardrobe", label: "Wardrobe" },
  { to: "/recommendations", label: "Looks" },
  { to: "/stylist", label: "Stylist" },
  { to: "/profile", label: "Profile" },
] as const;

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((n) => (
        <Link
          key={n.to}
          to={n.to}
          onClick={onNavigate}
          className="rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "bg-secondary text-foreground" }}
        >
          {n.label}
        </Link>
      ))}
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b glass">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Wordmark to="/dashboard" className="text-xl" />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLinks />
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden md:inline-flex" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-background">
                <SheetTitle className="font-display text-2xl font-normal tracking-[0.18em]">VÉSTARA</SheetTitle>
                <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
                  <NavLinks onNavigate={() => setOpen(false)} />
                  <Button variant="ghost" className="mt-4 justify-start" onClick={signOut}>
                    <LogOut /> Sign out
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 md:py-14">{children}</main>
    </div>
  );
}
