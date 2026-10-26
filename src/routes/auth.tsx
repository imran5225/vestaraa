import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  User,
  XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginWithUsername, registerWithUsername, USERNAME_REGEX } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) =>
    z
      .object({
        redirect: z.string().optional(),
        mode: z.enum(["in", "up"]).optional(),
      })
      .parse(s),
  head: () => ({
    meta: [
      { title: "Sign In — VÉSTARA" },
      {
        name: "description",
        content: "Sign in or create your VÉSTARA atelier with your username and password.",
      },
      { property: "og:title", content: "Sign In — VÉSTARA" },
      {
        property: "og:description",
        content: "Sign in or create your VÉSTARA atelier with your username and password.",
      },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "in" | "up";

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const targetRedirect = search.redirect || "/dashboard";

  const registerFn = useServerFn(registerWithUsername);
  const loginFn = useServerFn(loginWithUsername);

  const [mode, setMode] = useState<AuthMode>(search.mode === "up" ? "up" : "in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Synchronous constraint validations
  const isUsernameValid = USERNAME_REGEX.test(username.trim());
  const isPasswordLongEnough = password.length >= 8;
  const doPasswordsMatch = confirmPassword.length > 0 ? password === confirmPassword : false;

  useEffect(() => {
    let mounted = true;

    // Check stored username session
    const storedUser =
      typeof window !== "undefined" ? localStorage.getItem("vestara_username") : null;
    const isDemo =
      typeof window !== "undefined" && localStorage.getItem("vestara_demo_user") === "true";

    if (storedUser || isDemo) {
      setCurrentUsername(storedUser || "Demo Member");
      navigate({ to: targetRedirect, replace: true });
      return;
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.user) {
          const name =
            (data.user.user_metadata?.username as string) ||
            (data.user.user_metadata?.display_name as string) ||
            data.user.email?.split("@")[0] ||
            "Member";
          setCurrentUsername(name);
          navigate({ to: targetRedirect, replace: true });
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [navigate, targetRedirect]);

  async function handleLogout() {
    setBusy(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("vestara_username");
      localStorage.removeItem("vestara_session_token");
      localStorage.removeItem("vestara_demo_user");
    }
    await supabase.auth.signOut().catch(() => {});
    setCurrentUsername(null);
    await queryClient.cancelQueries();
    queryClient.clear();
    setBusy(false);
    toast.success("Signed out successfully.");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setServerError(null);

    const cleanUsername = username.trim().toLowerCase();

    // Frontend validation
    if (!cleanUsername) {
      return void setServerError("Please enter a username.");
    }

    if (mode === "up") {
      if (!isUsernameValid) {
        return void setServerError(
          "Username must be between 3 and 30 characters and contain only letters, numbers, and underscores.",
        );
      }
      if (!isPasswordLongEnough) {
        return void setServerError("Password must be at least 8 characters long.");
      }
      if (password !== confirmPassword) {
        return void setServerError("Passwords do not match. Please re-enter your password.");
      }
    } else {
      if (!password) {
        return void setServerError("Please enter your password.");
      }
    }

    setBusy(true);

    try {
      if (mode === "up") {
        const result = await registerFn({
          data: {
            username: cleanUsername,
            password,
            confirmPassword,
          },
        });

        if (!result.ok) {
          setServerError(result.error);
          toast.error(result.error);
          setBusy(false);
          return;
        }

        // Store session tokens and username
        if (typeof window !== "undefined") {
          localStorage.setItem("vestara_username", result.user.username);
          localStorage.setItem("vestara_session_token", result.session.access_token);
        }

        // Only call Supabase setSession if it's a real 3-part JWT
        if (result.session.access_token && result.session.access_token.split(".").length === 3) {
          try {
            await supabase.auth.setSession({
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token || "",
            });
          } catch {
            // Handled via local token attacher
          }
        }

        await queryClient.invalidateQueries();
        toast.success(`Welcome to VÉSTARA, ${result.user.username}!`);
        navigate({ to: targetRedirect, replace: true });
      } else {
        const result = await loginFn({
          data: {
            username: cleanUsername,
            password,
          },
        });

        if (!result.ok) {
          setServerError(result.error);
          toast.error(result.error);
          setBusy(false);
          return;
        }

        // Store session tokens and username
        if (typeof window !== "undefined") {
          localStorage.setItem("vestara_username", result.user.username);
          localStorage.setItem("vestara_session_token", result.session.access_token);
        }

        // Only call Supabase setSession if it's a real 3-part JWT
        if (result.session.access_token && result.session.access_token.split(".").length === 3) {
          try {
            await supabase.auth.setSession({
              access_token: result.session.access_token,
              refresh_token: result.session.refresh_token || "",
            });
          } catch {
            // Handled via local token attacher
          }
        }

        await queryClient.invalidateQueries();
        toast.success(`Welcome back, ${result.user.username}!`);
        navigate({ to: targetRedirect, replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed. Please try again.";
      setServerError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card/70 p-8 shadow-card backdrop-blur-xl sm:p-10">
        <div className="flex items-center justify-between">
          <Wordmark to="/" />
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Home
          </Link>
        </div>

        {currentUsername && (
          <div className="mt-6 rounded-2xl border border-bronze/30 bg-champagne/15 p-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="text-foreground font-medium">
                  Signed in as <span className="text-bronze font-semibold">{currentUsername}</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                disabled={busy}
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
              >
                Sign out
              </Button>
            </div>
            <div className="mt-3 pt-2.5 border-t border-border/50">
              <Button asChild variant="hero" size="sm" className="w-full h-8 text-xs font-medium">
                <Link to={targetRedirect}>
                  Continue to your atelier <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-full border border-border/80 bg-surface/60 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setServerError(null);
                setMode("in");
              }}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-all ${
                mode === "in"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setServerError(null);
                setMode("up");
              }}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-all ${
                mode === "up"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create account
            </button>
          </div>

          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            {mode === "in" ? "Welcome back" : "Create your atelier"}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {mode === "in"
              ? "Sign in with your username and password to access your wardrobe, recommendations, and styling."
              : "Choose a unique username and password. No email address or verification required."}
          </p>
        </div>

        {serverError && (
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive dark:text-red-400">
            <XCircle className="mt-0.5 size-4 shrink-0" />
            <p className="leading-relaxed">{serverError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="username"
                type="text"
                placeholder={mode === "up" ? "e.g. eleanor_vance" : "Your username"}
                required
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
                className="pl-10 text-sm"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (serverError) setServerError(null);
                }}
              />
            </div>
            {mode === "up" && username.length > 0 && !isUsernameValid && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                3–30 characters, letters, numbers, and underscores only.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                className="pl-10 pr-10 text-sm"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (serverError) setServerError(null);
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pl-10 pr-10 text-sm"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (serverError) setServerError(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === "up" && (
            <div className="rounded-2xl border border-border/70 bg-card/40 p-3.5 text-xs space-y-2">
              <span className="font-medium text-foreground text-[11px] uppercase tracking-wider block">
                Requirements
              </span>
              <div className="space-y-1.5 text-muted-foreground">
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    isUsernameValid ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
                  }`}
                >
                  {isUsernameValid ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mx-1 shrink-0" />
                  )}
                  <span>Username: 3–30 alphanumeric or underscore characters</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    isPasswordLongEnough ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
                  }`}
                >
                  {isPasswordLongEnough ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mx-1 shrink-0" />
                  )}
                  <span>Password: At least 8 characters</span>
                </div>
                {confirmPassword.length > 0 && (
                  <div
                    className={`flex items-center gap-1.5 pt-1 border-t border-border/40 text-[11px] transition-colors ${
                      doPasswordsMatch
                        ? "text-emerald-600 dark:text-emerald-400 font-medium"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {doPasswordsMatch ? (
                      <Check className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-amber-500 mx-1 shrink-0" />
                    )}
                    <span>{doPasswordsMatch ? "Passwords match" : "Passwords do not match"}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-sm font-medium mt-2" disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {mode === "in" ? "Signing in..." : "Creating account..."}
              </span>
            ) : (
              <span>{mode === "in" ? "Sign in" : "Create account"}</span>
            )}
          </Button>
        </form>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border/70" />
          </div>
          <span className="relative bg-card/70 px-3 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            or
          </span>
        </div>

        <Button
          variant="outline"
          className="w-full h-10 border border-border/80 hover:bg-muted/40 transition-colors flex items-center justify-center gap-2 text-xs font-medium cursor-pointer"
          onClick={() => {
            if (typeof window !== "undefined") {
              localStorage.setItem("vestara_username", "demo");
              localStorage.setItem("vestara_session_token", "demo-session-token");
              localStorage.setItem("vestara_demo_user", "true");
            }
            toast.success("Welcome! Exploring as Demo Member.");
            navigate({ to: targetRedirect, replace: true });
          }}
          type="button"
        >
          <span>Explore Demo Atelier Directly</span>
        </Button>

        <div className="mt-6 flex flex-col gap-2 text-center text-xs text-muted-foreground">
          {mode === "in" ? (
            <button
              type="button"
              className="hover:text-foreground transition-colors underline cursor-pointer"
              onClick={() => {
                setServerError(null);
                setMode("up");
              }}
            >
              Don't have an account? Create an account
            </button>
          ) : (
            <button
              type="button"
              className="hover:text-foreground transition-colors underline cursor-pointer"
              onClick={() => {
                setServerError(null);
                setMode("in");
              }}
            >
              Already have an account? Sign in
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
