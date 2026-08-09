"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DeskSurface } from "@/components/theme/desk-background";

const PREPARE_COMPLETE_MS = 2400;
const PREPARE_LABEL_FADE_MS = 1000;
export const AUTH_TO_DESK_CAMERA_START_MS = 4400;
const CAMERA_DURATION_MS = 5350;
export const AUTH_TO_DESK_DURATION_MS = AUTH_TO_DESK_CAMERA_START_MS + CAMERA_DURATION_MS;
const AUTH_SCENE_DORMANT_AFTER_CAMERA_MS = 900;

export function AuthToDeskTransition({
  active,
  username,
}: {
  active: boolean;
  username?: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const transitionRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    if (!active) return;

    const root = document.documentElement;
    root.dataset.authRuntime = "paused";
    root.dataset.deskPrelude = "loading";

    let transitionNode: HTMLDivElement | null = null;

    const cameraTimer = window.setTimeout(() => {
      root.dataset.authTransition = "desk";
      root.dataset.deskPrelude = "camera";
      transitionNode = transitionRef.current;
      transitionNode?.classList.add("desk-entry-transition--camera-active");
    }, AUTH_TO_DESK_CAMERA_START_MS);

    const dormantTimer = window.setTimeout(() => {
      root.dataset.authSceneDormant = "true";
    }, AUTH_TO_DESK_CAMERA_START_MS + AUTH_SCENE_DORMANT_AFTER_CAMERA_MS);

    return () => {
      window.clearTimeout(cameraTimer);
      window.clearTimeout(dormantTimer);
      delete root.dataset.authTransition;
      delete root.dataset.authRuntime;
      delete root.dataset.authSceneDormant;
      delete root.dataset.deskPrelude;
      transitionNode?.classList.remove("desk-entry-transition--camera-active");
    };
  }, [active]);

  if (!mounted || !active) return null;

  const safeUsername = username?.replace(/\s+/g, " ").trim() || "Owner";

  return createPortal(
    <div
      ref={transitionRef}
      className="desk-entry-transition"
      aria-hidden="true"
      style={
        {
          "--desk-prepare-complete": `${PREPARE_COMPLETE_MS}ms`,
          "--desk-prepare-label-fade": `${PREPARE_LABEL_FADE_MS}ms`,
          "--desk-camera-start": `${AUTH_TO_DESK_CAMERA_START_MS}ms`,
        } as CSSProperties
      }
    >
      <div className="desk-entry-transition__prelude">
        <div className="desk-entry-transition__prelude-aura" />
        <div className="desk-entry-transition__prelude-content">
          <div className="desk-entry-transition__prelude-mark" aria-hidden="true">
            <span>K</span>
            <i />
            <b />
          </div>

          <div className="desk-entry-transition__prelude-copy">
            <p className="desk-entry-transition__prelude-label desk-entry-transition__prelude-label--preparing">
              Mempersiapkan Ruang Kerja
            </p>
            <p className="desk-entry-transition__prelude-label desk-entry-transition__prelude-label--ready">
              Ruang kerja siap, <strong>{safeUsername}.</strong>
            </p>
          </div>

          <div className="desk-entry-transition__prelude-progress" aria-hidden="true">
            <span className="desk-entry-transition__prelude-progress-fill" />
            <i className="desk-entry-transition__prelude-progress-glint" />
          </div>
        </div>
        <div className="desk-entry-transition__prelude-sweep" />
      </div>

      <div className="desk-entry-transition__room">
        <div className="desk-entry-transition__room-glow" />
        <div className="desk-entry-transition__approach">
          <div className="desk-entry-transition__walk-bob">
            <div className="desk-entry-transition__distant-table">
              <div className="desk-entry-transition__tabletop">
                <div className="desk-entry-transition__table-surface" />
                <div className="desk-entry-transition__table-edge" />
              </div>
              <span className="desk-entry-transition__table-leg desk-entry-transition__table-leg--left-back" />
              <span className="desk-entry-transition__table-leg desk-entry-transition__table-leg--right-back" />
              <span className="desk-entry-transition__table-leg desk-entry-transition__table-leg--left-front" />
              <span className="desk-entry-transition__table-leg desk-entry-transition__table-leg--right-front" />
            </div>
          </div>
        </div>
      </div>

      <div className="desk-entry-transition__topshot">
        <DeskSurface className="desk-entry-transition__desk" />
      </div>

      <div className="desk-entry-transition__turn-shade" />
      <div className="desk-entry-transition__motion-blur" />
      <div className="desk-entry-transition__motion-vignette" />
    </div>,
    document.body,
  );
}
