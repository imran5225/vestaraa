import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Menu, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const NAVIGATION_LINKS = [
  { to: "/", label: "Home" },
  { to: "/wardrobe", label: "My Wardrobe" },
  { to: "/stylist", label: "AI Stylist" },
  { to: "/try-on", label: "Virtual Try-On" },
  { to: "/recommendations", label: "Looks" },
  { to: "/profile", label: "Profile" },
] as const;

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };
}

export function Navbar({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const signOut = useSignOut();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsSignedIn(Boolean(data.user));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setIsSignedIn(Boolean(session?.user));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <header className={cn("sticky top-0 z-40 border-b glass", className)}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Wordmark to="/" className="text-xl" />

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main Navigation">
          {NAVIGATION_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "bg-secondary font-medium text-foreground shadow-xs" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Medium-screen Navigation Links */}
        <nav
          className="hidden items-center gap-1 md:flex lg:hidden"
          aria-label="Main Navigation Tablet"
        >
          {NAVIGATION_LINKS.filter((item) => item.to !== "/recommendations").map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "bg-secondary font-medium text-foreground shadow-xs" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Action: Sign In or Sign Out */}
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex"
              onClick={signOut}
              title="Sign out of account"
            >
              <LogOut className="size-4" /> Sign out
            </Button>
          ) : (
            <Button asChild variant="quiet" size="sm" className="hidden md:inline-flex">
              <Link to="/auth">
                <LogIn className="size-4" /> Sign in
              </Link>
            </Button>
          )}

          {/* Mobile Drawer Navigation */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background">
              <SheetTitle className="font-display text-2xl font-normal tracking-[0.18em]">
                VÉSTARA
              </SheetTitle>
              <p className="mt-1 text-xs text-muted-foreground">Your Personal AI Style Agent</p>

              <nav className="mt-8 flex flex-col gap-1.5" aria-label="Mobile Navigation">
                {NAVIGATION_LINKS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                    activeProps={{ className: "bg-secondary font-medium text-foreground" }}
                  >
                    <span>{item.label}</span>
                    <span className="text-xs text-taupe">→</span>
                  </Link>
                ))}

                <div className="mt-6 border-t pt-4">
                  {isSignedIn ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setOpen(false);
                        signOut();
                      }}
                    >
                      <LogOut className="mr-2 size-4" /> Sign out
                    </Button>
                  ) : (
                    <Button asChild variant="hero" className="w-full justify-center">
                      <Link to="/auth" onClick={() => setOpen(false)}>
                        <LogIn className="mr-2 size-4" /> Sign in
                      </Link>
                    </Button>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
