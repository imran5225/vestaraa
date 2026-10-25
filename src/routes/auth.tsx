import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) =>
    z
      .object({
        redirect: z.string().optional(),
        reset: z.string().optional(),
      })
      .parse(s),
  head: () => ({
    meta: [
      { title: "Sign In & Security — VÉSTARA" },
      {
        name: "description",
        content: "Sign in or create your VÉSTARA account to access your digital wardrobe.",
      },
      { property: "og:title", content: "Sign In & Security — VÉSTARA" },
      {
        property: "og:description",
        content: "Sign in or create your VÉSTARA account to access your digital wardrobe.",
      },
    ],
  }),
  component: AuthPage,
});

type AuthMode = "in" | "up" | "forgot" | "reset";

function formatAuthError(err: Error | { message: string } | null): string {
  if (!err) return "An unexpected error occurred. Please try again.";
  const msg = err.message || String(err);
  if (/invalid login credentials/i.test(msg)) {
    return "Incorrect email address or password. Please double-check and try again.";
  }
  if (/invalid api key/i.test(msg)) {
    return "Authentication configuration issue: Invalid API key. Please ensure VITE_SUPABASE_PUBLISHABLE_KEY is configured correctly.";
  }
  if (/user already registered/i.test(msg)) {
    return "An account with this email already exists. Please sign in instead.";
  }
  if (/email not confirmed/i.test(msg)) {
    return "Your email address has not been confirmed yet. Please check your inbox for the confirmation email.";
  }
  if (/password.*(short|least|characters)/i.test(msg)) {
    return "Password must be at least 8 characters long.";
  }
  if (/network|fetch|connection/i.test(msg)) {
    return "Network connection issue. Please check your internet connection.";
  }
  return msg;
}

function GoogleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const targetRedirect = search.redirect || "/dashboard";

  const [mode, setMode] = useState<AuthMode>(search.reset ? "reset" : "in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [emailSentNotice, setEmailSentNotice] = useState<string | null>(null);

  // Real-time password constraint checks
  const passwordConstraints = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumberOrSpecial: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    matchesConfirm:
      mode === "up" || mode === "reset"
        ? confirmPassword.length > 0 && password === confirmPassword
        : true,
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (data.user) {
        setCurrentUserEmail(data.user.email ?? "Active Member");
        if (mode !== "reset" && !search.reset) {
          navigate({ to: targetRedirect });
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setCurrentUserEmail(session.user.email ?? "Active Member");
        if (
          (event === "SIGNED_IN" || event === "USER_UPDATED") &&
          mode !== "reset" &&
          !search.reset
        ) {
          toast.success("Welcome to VÉSTARA.");
          navigate({ to: targetRedirect });
        }
      }
    });

    // Check for password recovery hash in URL
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setMode("reset");
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, targetRedirect, mode, search.reset]);

  async function handleLogout() {
    setBusy(true);
    await supabase.auth.signOut();
    setCurrentUserEmail(null);
    setBusy(false);
    toast.success("Signed out successfully.");
  }

  async function handleResendConfirmation() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return void toast.error("Please enter a valid email address above first.");
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: cleanEmail,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Could not resend confirmation email.");
    } else {
      toast.success(
        `Verification email sent to ${cleanEmail}. Please check your inbox and spam folder.`,
      );
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setEmailSentNotice(null);

    // Validation checks
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return void toast.error("Please enter a valid email address.");
    }

    if (mode === "up" || mode === "reset") {
      if (mode === "up" && !fullName.trim()) {
        return void toast.error("Please enter your full name.");
      }
      if (!passwordConstraints.minLength) {
        return void toast.error("Password must be at least 8 characters long.");
      }
      if (!passwordConstraints.hasUpper) {
        return void toast.error("Password must contain at least one uppercase letter (A-Z).");
      }
      if (!passwordConstraints.hasLower) {
        return void toast.error("Password must contain at least one lowercase letter (a-z).");
      }
      if (!passwordConstraints.hasNumberOrSpecial) {
        return void toast.error(
          "Password must contain at least one number or special character (0-9, !, @, #, etc.).",
        );
      }
      if (password !== confirmPassword) {
        return void toast.error("Passwords do not match. Please re-enter your password.");
      }
    } else if (mode === "in") {
      if (!password) {
        return void toast.error("Please enter your password.");
      }
    }

    setBusy(true);

    try {
      if (mode === "in") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          if (/email not confirmed/i.test(error.message)) {
            setEmailSentNotice(
              `This account (${cleanEmail}) is pending email verification. If you previously created it before disabling email confirmation, click the link sent to your inbox, or confirm the user in your Supabase Dashboard (Authentication → Users). You can also click below to resend the verification email.`,
            );
          }
          toast.error(formatAuthError(error));
          setBusy(false);
          return;
        }

        if (data.user) {
          toast.success("Welcome back to VÉSTARA.");
          navigate({ to: targetRedirect });
        }
      } else if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              display_name: fullName.trim(),
            },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });

        if (error) {
          toast.error(formatAuthError(error));
          setBusy(false);
          return;
        }

        // Initialize user profile record in public.profiles table
        if (data.user) {
          try {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              display_name: fullName.trim(),
              preferred_styles: ["casual", "smart-casual"],
              preferred_fits: ["regular"],
              favorite_colors: ["navy", "white", "camel"],
              avoided_colors: [],
              typical_occasions: ["casual", "work"],
              weather_enabled: false,
              weather_city: null,
              comfort_notes: "",
              updated_at: new Date().toISOString(),
            });
          } catch (profileErr) {
            console.warn("Profile init warning:", profileErr);
          }
        }

        // If session exists immediately, log in directly without requiring email validation
        if (data.session) {
          toast.success("Account created successfully!");
          navigate({ to: targetRedirect });
          return;
        }

        // Attempt direct login in case email confirmation is not required by project
        const immediateSignIn = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (immediateSignIn.data?.session) {
          toast.success("Account created and signed in!");
          navigate({ to: targetRedirect });
          return;
        }

        setEmailSentNotice(
          `Account created for ${cleanEmail}! Supabase currently requires email confirmation. Please check your inbox for the verification email. (Important: In Supabase Dashboard → Authentication → Providers → Email, remember to click the green "Save" button at the bottom after toggling "Confirm email" OFF for changes to take effect).`,
        );
        toast.success("Account created! Check email if confirmation is required.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/auth?reset=true`,
        });

        if (error) {
          toast.error(formatAuthError(error));
          setBusy(false);
          return;
        }

        setEmailSentNotice(
          `If an account exists for ${cleanEmail}, a password reset link has been sent to your inbox.`,
        );
        toast.success("Password reset email sent.");
      } else if (mode === "reset") {
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
          toast.error(formatAuthError(error));
          setBusy(false);
          return;
        }

        toast.success("Password updated successfully! You can now sign in.");
        setMode("in");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: unknown) {
      toast.error(formatAuthError(err as Error));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleAuth() {
    setGoogleBusy(true);
    try {
      const redirectOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${redirectOrigin}/auth?redirect=${encodeURIComponent(targetRedirect)}`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) {
        if (/not enabled|not configured/i.test(error.message)) {
          toast.error(
            "Google sign-in is not yet enabled with credentials in your Supabase Dashboard (Authentication → Providers → Google).",
          );
        } else {
          toast.error(error.message || "Google sign-in could not be completed.");
        }
        setGoogleBusy(false);
        return;
      }

      if (data?.url && typeof window !== "undefined") {
        // Pre-flight check to verify provider credentials are fully saved in Supabase
        try {
          const preflight = await fetch(data.url, { method: "GET", redirect: "manual" });
          if (preflight.status === 400) {
            const body = await preflight.json().catch(() => null);
            if (
              body?.msg?.includes("missing OAuth secret") ||
              body?.msg?.includes("Unsupported provider")
            ) {
              toast.error(
                "Google Client Secret is missing in Supabase. In Supabase Dashboard → Authentication → Providers → Google, paste your Client Secret and click Save.",
                { duration: 8000 },
              );
              setGoogleBusy(false);
              return;
            }
          }
        } catch {
          // If preflight check network fails due to CORS or redirect, continue to standard browser redirection
        }

        window.location.href = data.url;
      }
    } catch (err: unknown) {
      toast.error((err as Error)?.message || "Google authentication could not be completed.");
      setGoogleBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border/80 bg-card/60 p-8 shadow-card backdrop-blur-xl sm:p-10">
        <div className="flex items-center justify-between">
          <Wordmark to="/" />
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Home
          </Link>
        </div>

        {currentUserEmail && (
          <div className="mt-6 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span className="truncate text-foreground font-medium">
                Signed in as <span className="text-bronze">{currentUserEmail}</span>
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
        )}

        <div className="mt-6">
          <h1 className="font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
            {mode === "in" && "Welcome back"}
            {mode === "up" && "Create your atelier"}
            {mode === "forgot" && "Reset password"}
            {mode === "reset" && "Set new password"}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {mode === "in" &&
              "Sign in to access your digital wardrobe, live stylist chat, and virtual 3D try-on."}
            {mode === "up" &&
              "Join VÉSTARA to build your private wardrobe, save custom outfits, and explore personalized styling."}
            {mode === "forgot" &&
              "Enter your email address and we'll send you a secure link to reset your password."}
            {mode === "reset" && "Enter your new password below (minimum 8 characters)."}
          </p>
        </div>

        {emailSentNotice && (
          <div className="mt-5 space-y-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="leading-relaxed">{emailSentNotice}</p>
            </div>
            <div className="flex items-center justify-between border-t border-emerald-500/20 pt-2 text-[11px]">
              <span className="text-muted-foreground">Didn't receive the email?</span>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={busy}
                className="font-medium text-emerald-700 underline transition-colors hover:no-underline dark:text-emerald-300"
              >
                Resend verification email
              </button>
            </div>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="fullname">Full name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullname"
                  type="text"
                  placeholder="e.g. Eleanor Vance"
                  required
                  autoComplete="name"
                  className="pl-10"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode !== "reset" && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@domain.com"
                  required
                  autoComplete="email"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw">{mode === "reset" ? "New password" : "Password"}</Label>
                {mode === "in" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmailSentNotice(null);
                      setMode("forgot");
                    }}
                    className="text-xs text-muted-foreground hover:text-bronze transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pw"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete={mode === "up" ? "new-password" : "current-password"}
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
          )}

          {(mode === "up" || mode === "reset") && (
            <div className="space-y-1.5">
              <Label htmlFor="confirmPw">Confirm password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPw"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pl-10 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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

          {(mode === "up" || mode === "reset") && (
            <div className="rounded-2xl border border-border/70 bg-card/40 p-3.5 text-xs space-y-2">
              <span className="font-medium text-foreground text-[11px] uppercase tracking-wider block">
                Password Requirements
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-muted-foreground">
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordConstraints.minLength
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : ""
                  }`}
                >
                  {passwordConstraints.minLength ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mx-1 shrink-0" />
                  )}
                  <span>At least 8 characters</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordConstraints.hasUpper
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : ""
                  }`}
                >
                  {passwordConstraints.hasUpper ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mx-1 shrink-0" />
                  )}
                  <span>Uppercase letter (A-Z)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordConstraints.hasLower
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : ""
                  }`}
                >
                  {passwordConstraints.hasLower ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mx-1 shrink-0" />
                  )}
                  <span>Lowercase letter (a-z)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 transition-colors ${
                    passwordConstraints.hasNumberOrSpecial
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : ""
                  }`}
                >
                  {passwordConstraints.hasNumberOrSpecial ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-muted-foreground/40 mx-1 shrink-0" />
                  )}
                  <span>Number or symbol (0-9, #, $)</span>
                </div>
              </div>
              {confirmPassword.length > 0 && (
                <div
                  className={`flex items-center gap-1.5 pt-1.5 border-t border-border/50 text-[11px] transition-colors ${
                    passwordConstraints.matchesConfirm
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {passwordConstraints.matchesConfirm ? (
                    <Check className="size-3.5 text-emerald-500 shrink-0" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-amber-500 mx-1 shrink-0" />
                  )}
                  <span>
                    {passwordConstraints.matchesConfirm
                      ? "Passwords match"
                      : "Passwords do not match"}
                  </span>
                </div>
              )}
            </div>
          )}

          <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={busy}>
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                {mode === "in" && "Signing in..."}
                {mode === "up" && "Creating account..."}
                {mode === "forgot" && "Sending reset link..."}
                {mode === "reset" && "Updating password..."}
              </span>
            ) : (
              <span>
                {mode === "in" && "Sign in"}
                {mode === "up" && "Create account"}
                {mode === "forgot" && "Send reset link"}
                {mode === "reset" && "Set new password"}
              </span>
            )}
          </Button>
        </form>

        {(mode === "in" || mode === "up") && (
          <>
            <div className="relative my-5 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/80" />
              </div>
              <span className="relative bg-card/60 px-3 text-xs uppercase tracking-wider text-muted-foreground font-medium">
                or
              </span>
            </div>

            <Button
              variant="quiet"
              className="w-full h-11 border border-border/80 hover:bg-muted/40 transition-colors flex items-center justify-center gap-2.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              onClick={handleGoogleAuth}
              disabled={busy || googleBusy}
              type="button"
              aria-label={mode === "up" ? "Sign up with Google" : "Continue with Google"}
            >
              {googleBusy ? (
                <>
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="size-4 shrink-0" />
                  <span>{mode === "up" ? "Sign up with Google" : "Continue with Google"}</span>
                </>
              )}
            </Button>
          </>
        )}

        <div className="mt-6 flex flex-col gap-2 text-center text-xs text-muted-foreground">
          {mode === "in" && (
            <button
              type="button"
              className="hover:text-foreground transition-colors underline"
              onClick={() => {
                setEmailSentNotice(null);
                setMode("up");
              }}
            >
              Don't have an account? Sign up
            </button>
          )}

          {mode === "up" && (
            <button
              type="button"
              className="hover:text-foreground transition-colors underline"
              onClick={() => {
                setEmailSentNotice(null);
                setMode("in");
              }}
            >
              Already have an account? Sign in
            </button>
          )}

          {(mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              className="hover:text-foreground transition-colors underline"
              onClick={() => {
                setEmailSentNotice(null);
                setMode("in");
              }}
            >
              ← Back to Sign in
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
