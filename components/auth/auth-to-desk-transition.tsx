"use client";

import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/** Only the post-success exit. The camera belongs to the destination document. */
export function AuthToDeskTransition({ active }: { active: boolean }) {
  useLayoutEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    root.dataset.authRuntime = "paused";
    return () => { delete root.dataset.authRuntime; };
  }, [active]);

  if (!active || typeof document === "undefined") return null;
  return createPortal(<div className="desk-auth-exit" aria-hidden="true" />, document.body);
}
