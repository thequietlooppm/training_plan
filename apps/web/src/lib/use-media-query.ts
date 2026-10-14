import { useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query. Returns false where `matchMedia` is
 * unavailable (non-browser test environments), so callers get the
 * mobile-first default.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
    () => false,
  );
}
