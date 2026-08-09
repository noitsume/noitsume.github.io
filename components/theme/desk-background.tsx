"use client";

import { useLayoutEffect, useRef } from "react";

export const DESK_ENTRY_STORAGE_KEY = "kenangin:desk-entry";

export function DeskSurface({ className = "" }: { className?: string }) {
  return (
    <div className={`desk-surface ${className}`.trim()} aria-hidden="true">
      <div className="desk-surface__wood" />
      <div className="desk-surface__grain" />
      <div className="desk-surface__diffusion" />
      <div className="desk-surface__lamp-beam" />
      <div className="desk-surface__lamp-spill" />
      <div className="desk-surface__lamp-core" />
      <div className="desk-surface__lamp-fixture" />
      <div className="desk-surface__sunlight">
        <div className="desk-surface__sun-spill" />
        <div className="desk-surface__sun-beam" />
      </div>
      <div className="desk-surface__vignette" />
    </div>
  );
}

export function DeskBackground() {
  const backgroundRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    try {
      if (window.sessionStorage.getItem(DESK_ENTRY_STORAGE_KEY) !== "1") return;

      const root = document.documentElement;
      const background = backgroundRef.current;

      window.sessionStorage.removeItem(DESK_ENTRY_STORAGE_KEY);
      root.dataset.deskArrival = "true";
      background?.classList.add("desk-background--entering");

      const timer = window.setTimeout(() => {
        background?.classList.remove("desk-background--entering");
        delete root.dataset.deskArrival;
      }, 900);

      return () => {
        window.clearTimeout(timer);
        background?.classList.remove("desk-background--entering");
        delete root.dataset.deskArrival;
      };
    } catch {
      return;
    }
  }, []);

  return (
    <div ref={backgroundRef} className="desk-background" aria-hidden="true">
      <DeskSurface />
    </div>
  );
}
