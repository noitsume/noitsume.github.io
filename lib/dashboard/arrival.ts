export const DESK_ARRIVAL_KEY = "kenangin:desk-entry";
export const DESK_ARRIVAL_TTL_MS = 30_000;
export const AUTH_EXIT_MS = 160;

/** A visual hint only. Authentication and routing never depend on storage. */
export function prepareDeskArrival(destination: string) {
  try {
    sessionStorage.removeItem(DESK_ARRIVAL_KEY);
    if (new URL(destination, location.origin).pathname !== "/dashboard") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    sessionStorage.setItem(DESK_ARRIVAL_KEY, JSON.stringify({
      version: 2, at: Date.now(), destination: "/dashboard",
    }));
  } catch { /* The destination remains usable without a visual hand-off. */ }
}

/** Runs before paint; consumes the hint even if it is stale or malformed. */
export const deskArrivalBootstrap = `(() => {
  try {
    const key = ${JSON.stringify(DESK_ARRIVAL_KEY)};
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    const hint = JSON.parse(raw);
    const age = Date.now() - hint.at;
    const path = location.pathname;
    const eligible = path === "/dashboard"${process.env.NODE_ENV === "development" ? ' || path === "/dev/desk"' : ""};
    if (!eligible || hint.version !== 2 || hint.destination !== "/dashboard" ||
        typeof hint.at !== "number" || !Number.isFinite(age) || age < 0 || age > ${DESK_ARRIVAL_TTL_MS} ||
        matchMedia("(prefers-reduced-motion: reduce)").matches || document.visibilityState === "hidden") return;
    const root = document.documentElement;
    root.dataset.deskEntry = "pending";
    const release = () => {
      delete root.dataset.deskEntry;
      document.dispatchEvent(new Event("kenangin:desk-release"));
    };
    const deadline = setTimeout(() => {
      if (root.dataset.deskEntry === "pending") release();
    }, 1400);
    const failsafe = setTimeout(release, 4000);
    const skip = () => release();
    const hidden = () => { if (document.visibilityState === "hidden") release(); };
    addEventListener("pointerdown", skip, { once: true, capture: true });
    addEventListener("keydown", skip, { once: true, capture: true });
    addEventListener("wheel", skip, { once: true, capture: true, passive: true });
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("kenangin:desk-release", () => {
      clearTimeout(deadline); clearTimeout(failsafe);
      removeEventListener("pointerdown", skip, true);
      removeEventListener("keydown", skip, true);
      removeEventListener("wheel", skip, true);
      document.removeEventListener("visibilitychange", hidden);
    }, { once: true });
  } catch { /* No storage or invalid hint: show the dashboard normally. */ }
})();`;

export function releaseDeskArrival() {
  delete document.documentElement.dataset.deskEntry;
  document.dispatchEvent(new Event("kenangin:desk-release"));
}
