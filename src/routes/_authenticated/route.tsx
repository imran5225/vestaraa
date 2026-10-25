import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedGuard,
});

function AuthenticatedGuard() {
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error || !session) {
          // Store return path so the user is returned here after login
          const currentPath =
            typeof window !== "undefined"
              ? window.location.pathname + window.location.search
              : "/dashboard";

          navigate({
            to: "/auth",
            search: { redirect: currentPath },
            replace: true,
          });
          return;
        }

        setIsAuthenticated(true);
      } catch (err) {
        console.error("Session verification failed:", err);
        if (isMounted) {
          navigate({ to: "/auth", replace: true });
        }
      } finally {
        if (isMounted) {
          setChecking(false);
        }
      }
    }

    verifySession();

    // Listen to auth events (logout, token expiry, login)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_OUT" || !session) {
        setIsAuthenticated(false);
        // Clear all cached private queries
        await queryClient.cancelQueries();
        queryClient.clear();
        navigate({ to: "/auth", replace: true });
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setIsAuthenticated(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, queryClient]);

  // Prevent flash of private content during session initialization
  if (checking) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <div className="space-y-1">
          <p className="font-display text-lg tracking-wide text-foreground">VÉSTARA</p>
          <p className="text-xs text-muted-foreground">Verifying secure session...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, do not render child routes while redirecting
  if (!isAuthenticated) {
    return null;
  }

  return <Outlet />;
}
