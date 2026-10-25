/**
 * Centralized client-side application error logger.
 */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[VÉSTARA Error]", error, context);
}
