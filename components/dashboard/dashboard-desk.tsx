"use client";

import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { releaseDeskArrival } from "@/lib/dashboard/arrival";
import { DeskFallback } from "./desk-fallback";
import { DeskArrivalOverlay, DeskTourOverlay } from "./desk-controls";
import { DeskDayCycle } from "./desk-day-cycle";
import type { DeskAtmosphere } from "@/lib/dashboard/day-cycle";

// Never rendered on the server: `enabled` is set after mounting. Keep the lazy
// boundary inside the backdrop so a slow visual chunk cannot suspend the shell.
const DeskScene = lazy(() => import("./desk-scene"));

class DeskBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function DashboardDesk() {
  const { theme } = useTheme();
  const host = useRef<HTMLDivElement>(null);
  const atmosphere = useRef<DeskAtmosphere>({ day: 0, night: 1, active: false });
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => {
    setFailed(true);
    host.current?.removeAttribute("data-ready");
    releaseDeskArrival();
    document.dispatchEvent(new Event("kenangin:desk-ready"));
  }, []);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const element = host.current;
    const update = () => {
      setEnabled(!media.matches);
      if (media.matches) { element?.removeAttribute("data-ready"); releaseDeskArrival(); }
    };
    update();
    media.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
      if (!element?.isConnected) releaseDeskArrival();
    };
  }, []);

  return <><div className="dashboard-desk" ref={host} aria-hidden="true" data-renderer={failed || !enabled ? "static" : "webgl"}>
    <DeskFallback />
    {enabled && !failed && <DeskBoundary onFailure={fail}>
      <Suspense fallback={null}><DeskScene theme={theme} host={host} atmosphere={atmosphere} onFailure={fail} /></Suspense>
    </DeskBoundary>}
    <div className="dashboard-desk__vignette" />
  </div><DeskArrivalOverlay /><DeskTourOverlay /><DeskDayCycle host={host} atmosphere={atmosphere} /></>;
}
