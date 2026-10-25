import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ redirect: z.string().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — VÉSTARA" },
      { name: "description", content: "Sign in or create your VÉSTARA account." },
      { property: "og:title", content: "Sign in — VÉSTARA" },
      { property: "og:description", content: "Sign in or create your VÉSTARA account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const search = Route.useSearch();
  const targetRedirect = search.redirect || "/dashboard";

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: targetRedirect });
    });
  }, [navigate, targetRedirect]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth` },
          });
    setBusy(false);
    if (error) return void toast.error(error.message);
    if (mode === "up") toast.success("Check your email to confirm your account.");
    else navigate({ to: targetRedirect });
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (r.error) toast.error("Google sign-in failed.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <Wordmark to="/" />
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            ← Back to Home
          </Link>
        </div>
        <h1 className="mt-6 text-4xl">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          Sign in to access your digital wardrobe, live stylist chat, and virtual try-on.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "in" ? "Sign in" : "Sign up"}
          </Button>
        </form>
        <Button variant="quiet" className="mt-3 w-full" onClick={google}>
          Continue with Google
        </Button>
        <div className="relative my-4 text-center">
          <span className="bg-background px-2 text-xs text-muted-foreground">or</span>
        </div>
        <Button
          variant="ghost"
          className="w-full border border-dashed border-border"
          onClick={() => navigate({ to: targetRedirect })}
        >
          Explore in Guest Mode
        </Button>
        <div className="mt-6 text-center">
          <button
            className="text-sm text-muted-foreground underline"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
          >
            {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
          </button>
        </div>
      </div>
    </main>
  );
}
