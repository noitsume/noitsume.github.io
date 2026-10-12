"use client";

import { useEffect, useRef, type RefObject } from "react";
import { gsap } from "gsap";
import { useTheme } from "@/components/theme/theme-provider";
import { releaseDeskArrival } from "@/lib/dashboard/arrival";
import { DAY_CYCLE_DURATION, sampleDeskDayCycle, type DeskAtmosphere } from "@/lib/dashboard/day-cycle";

export function DeskDayCycle({ host, atmosphere }: {
  host: RefObject<HTMLDivElement | null>; atmosphere: RefObject<DeskAtmosphere>;
}) {
  const { theme, registerTransition } = useTheme();
  const overlay = useRef<HTMLDivElement>(null);
  const stop = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (atmosphere.current.active) return;
    Object.assign(atmosphere.current, { day: theme === "light" ? 1 : 0, night: theme === "dark" ? 1 : 0 });
    document.dispatchEvent(new Event("kenangin:desk-light-frame"));
  }, [theme, atmosphere]);

  useEffect(() => {
    const unregister = registerTransition(({ to, commit }) => new Promise<void>(resolve => {
      stop.current?.();
      releaseDeskArrival();
      const surface = overlay.current;
      const shell = host.current?.closest<HTMLElement>(".app-shell--desk-studio");
      if (!surface || !shell) { commit(); resolve(); return; }
      const root = document.documentElement;
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      const groups = Array.from(shell.querySelectorAll<HTMLElement>(".top-navbar, .app-shell__left, .app-shell__main, .app-shell__right"));
      const saved = groups.map(el => ({ el, opacity: el.style.opacity, inert: el.inert }));
      const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const state = atmosphere.current;
      const clock = { time: 0 };
      const shade = surface.querySelector<HTMLElement>(".desk-day-cycle__shade")!;
      const glow = surface.querySelector<HTMLElement>(".desk-day-cycle__glow")!;
      const caption = surface.querySelector<HTMLElement>(".desk-day-cycle__caption")!;
      const timeline = gsap.timeline({ paused: true });
      const inspect = () => window.dispatchEvent(new CustomEvent("kenangin:day-cycle-context", {
        detail: { timeline, clock, to, atmosphere: state },
      }));
      let committed = false, finished = false;
      let deadline = 0;
      const applyTheme = () => { if (!committed) { committed = true; commit(); } };
      const draw = () => {
        const sample = sampleDeskDayCycle(clock.time, to);
        state.day = sample.day; state.night = sample.night;
        // Both renderers read the same sampled instant. A theme commit cannot
        // jump the physical lights while the room is still being revealed.
        if (sample.committed) applyTheme();
        const radius = Math.hypot(innerWidth, innerHeight) * sample.spread * 1.22;
        const feather = Math.max(90, Math.min(innerWidth, innerHeight) * .28);
        const origin = to === "light" ? "0% 100%" : "76% 24%";
        shade.style.opacity = String(sample.cover);
        shade.style.background = `radial-gradient(circle at ${origin}, transparent ${Math.max(0, radius - feather)}px, #090c0b ${radius}px)`;
        glow.style.opacity = String(sample.glow * (to === "light" ? .52 : .23));
        glow.style.transform = `scale(${.28 + sample.spread * 1.1})`;
        caption.style.opacity = String(sample.glow);
        groups.forEach(el => { el.style.opacity = String(sample.ui); });
        root.style.setProperty("--desk-cycle-ui", String(sample.ui));
        document.dispatchEvent(new Event("kenangin:desk-light-frame"));
      };
      const finish = () => {
        if (finished) return;
        finished = true; timeline.kill(); clearTimeout(deadline);
        applyTheme();
        state.day = to === "light" ? 1 : 0; state.night = to === "dark" ? 1 : 0; state.active = false;
        surface.hidden = true;
        saved.forEach(({ el, opacity, inert }) => { el.style.opacity = opacity; el.inert = inert; });
        delete root.dataset.deskCycle; root.style.removeProperty("--desk-cycle-ui");
        document.removeEventListener("visibilitychange", hidden);
        window.removeEventListener("keydown", escape);
        motion.removeEventListener("change", reduced);
        window.removeEventListener("kenangin:inspect-day-cycle", inspect);
        document.dispatchEvent(new Event("kenangin:desk-light-frame"));
        // The theme toggle is disabled until the provider resolves this promise.
        requestAnimationFrame(() => { if (focused?.isConnected) focused.focus({ preventScroll: true }); });
        stop.current = null; resolve();
      };
      const hidden = () => { if (document.hidden) finish(); };
      const reduced = () => { if (motion.matches) finish(); };
      const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") finish();
        if (event.key === "Tab") { event.preventDefault(); surface.querySelector("button")?.focus(); }
      };
      stop.current = finish;
      if (motion.matches || document.hidden) { finish(); return; }
      state.active = true;
      surface.dataset.destination = to;
      surface.hidden = false;
      root.dataset.deskCycle = to === "light" ? "morning" : "night";
      saved.forEach(({ el }) => { el.inert = true; });
      surface.querySelector("button")?.focus({ preventScroll: true });
      document.addEventListener("visibilitychange", hidden);
      window.addEventListener("keydown", escape);
      motion.addEventListener("change", reduced);
      if (process.env.NODE_ENV === "development") window.addEventListener("kenangin:inspect-day-cycle", inspect);
      draw();
      deadline = window.setTimeout(finish, (DAY_CYCLE_DURATION[to] + 1) * 1000);
      timeline.eventCallback("onComplete", finish).to(clock, {
        time: DAY_CYCLE_DURATION[to], duration: DAY_CYCLE_DURATION[to], ease: "none", onUpdate: draw,
      }).play();
    }));
    return () => { unregister(); stop.current?.(); };
  }, [registerTransition, host, atmosphere]);

  return <div ref={overlay} className="desk-day-cycle" hidden role="dialog" aria-modal="true" aria-label="Pergantian suasana meja">
    <div className="desk-day-cycle__shade" aria-hidden="true" />
    <div className="desk-day-cycle__glow" aria-hidden="true" />
    <div className="desk-day-cycle__caption" aria-hidden="true">
      <span className="desk-day-cycle__morning">CAHAYA PERTAMA<em>Ruang untuk cerita baru.</em></span>
      <span className="desk-day-cycle__night">MALAM KEMBALI<em>Hangat. Tenang. Milikmu.</em></span>
    </div>
    <button type="button" onClick={() => stop.current?.()}>Selesaikan transisi <span aria-hidden="true">↗</span></button>
  </div>;
}
