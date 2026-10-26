import { useEffect, useState } from "react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
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
        const storedUser =
          typeof window !== "undefined" ? localStorage.getItem("vestara_username") : null;
        const storedToken =
          typeof window !== "undefined" ? localStorage.getItem("vestara_session_token") : null;
        const isDemo =
          typeof window !== "undefined" && localStorage.getItem("vestara_demo_user") === "true";

        // Active username or demo session
        if (storedUser || storedToken || isDemo) {
          if (isMounted) {
            setIsAuthenticated(true);
            setChecking(false);
          }
          return;
        }

        const {
          data: { session },
          error,
        } = await supabase.auth
          .getSession()
          .catch(() => ({ data: { session: null }, error: null }));

        if (!isMounted) return;

        // Double check in case storage was updated during async lookup
        const doubleCheckUser =
          typeof window !== "undefined" ? localStorage.getItem("vestara_username") : null;
        if (doubleCheckUser) {
          setIsAuthenticated(true);
          setChecking(false);
          return;
        }

        if (error || !session) {
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
        const doubleCheckUser =
          typeof window !== "undefined" ? localStorage.getItem("vestara_username") : null;
        if (doubleCheckUser && isMounted) {
          setIsAuthenticated(true);
          setChecking(false);
          return;
        }
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

    // Listen to Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      const hasCustomSession =
        typeof window !== "undefined" && Boolean(localStorage.getItem("vestara_username"));
      const isDemo =
        typeof window !== "undefined" && localStorage.getItem("vestara_demo_user") === "true";

      // If user is authenticated via custom username session or demo, do NOT kick them out on !session!
      if (hasCustomSession || isDemo) {
        if (event === "SIGNED_OUT") {
          localStorage.removeItem("vestara_username");
          localStorage.removeItem("vestara_session_token");
          localStorage.removeItem("vestara_demo_user");
          setIsAuthenticated(false);
          await queryClient.cancelQueries();
          queryClient.clear();
          navigate({ to: "/auth", replace: true });
        } else {
          setIsAuthenticated(true);
        }
        return;
      }

      if (event === "SIGNED_OUT" || !session) {
        setIsAuthenticated(false);
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
