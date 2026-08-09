"use client";

import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AmbientBackground, DeskSurface } from "@/components/theme";

export const LOGOUT_TO_AUTH_DURATION_MS = 4700;
const DASHBOARD_DORMANT_MS = 520;

export function LogoutToAuthTransition({ active }: { active: boolean }) {
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    if (!active) return;

    const root = document.documentElement;
    root.dataset.logoutTransition = "auth";
    root.dataset.dashboardRuntime = "paused";

    const dormantTimer = window.setTimeout(() => {
      root.dataset.dashboardSceneDormant = "true";
    }, DASHBOARD_DORMANT_MS);

    return () => {
      window.clearTimeout(dormantTimer);
      delete root.dataset.logoutTransition;
      delete root.dataset.dashboardRuntime;
      delete root.dataset.dashboardSceneDormant;
    };
  }, [active]);

  if (!mounted || !active) return null;

  return createPortal(
    <div className="logout-transition" aria-hidden="true">
      <div className="logout-transition__desk-shot">
        <DeskSurface className="logout-transition__desk" />
      </div>

      <div className="logout-transition__room">
        <div className="logout-transition__room-glow" />
        <div className="logout-transition__retreat">
          <div className="logout-transition__walk-bob">
            <div className="logout-transition__distant-table">
              <div className="logout-transition__tabletop">
                <div className="logout-transition__table-surface" />
                <div className="logout-transition__table-edge" />
              </div>
              <span className="logout-transition__table-leg logout-transition__table-leg--left-back" />
              <span className="logout-transition__table-leg logout-transition__table-leg--right-back" />
              <span className="logout-transition__table-leg logout-transition__table-leg--left-front" />
              <span className="logout-transition__table-leg logout-transition__table-leg--right-front" />
            </div>
          </div>
        </div>
      </div>

      <div className="logout-transition__auth-return">
        <AmbientBackground />
        <div className="logout-transition__auth-haze" />
      </div>

      <div className="logout-transition__motion-blur" />
      <div className="logout-transition__turn-shade" />
      <div className="logout-transition__vignette" />
    </div>,
    document.body,
  );
}
