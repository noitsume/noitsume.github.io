/** Download only the public visual chunk while the session request is in flight. */
export function preloadDeskScene(destination: string) {
  if (new URL(destination, location.origin).pathname !== "/dashboard") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  void import("@/components/dashboard/desk-scene").catch(() => { /* CSS fallback remains available. */ });
}
