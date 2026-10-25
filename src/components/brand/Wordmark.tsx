import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Wordmark({ to = "/", className }: { to?: "/" | "/dashboard"; className?: string }) {
  return (
    <Link
      to={to}
      className={cn("font-display text-2xl tracking-[0.18em] text-foreground", className)}
      aria-label="VÉSTARA home"
    >
      VÉSTARA
    </Link>
  );
}
