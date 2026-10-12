"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

/** A gesture chooses one destination. Playback is permitted only after it lands. */
export function useSectionNavigation(started: boolean, motion: boolean, total: number) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const state = useRef({ index: 0, frame: 0, settled: false });
  const [activeIndex, setActiveIndex] = useState(0);
  const [settled, setSettled] = useState(false);

  const go = useCallback((requested: number, instant = false) => {
    const root = scrollerRef.current;
    if (!root) return;
    const slides = Array.from(root.querySelectorAll<HTMLElement>("[data-receiver-slide]"));
    const index = Math.max(0, Math.min(total - 1, requested));
    const slide = slides[index];
    if (!slide) return;
    cancelAnimationFrame(state.current.frame);
    state.current.index = index; state.current.settled = false;
    setActiveIndex(index); setSettled(false);
    root.dataset.settled = "false";
    // Stop synchronously, before React's effects run on the next commit.
    root.querySelectorAll("video").forEach(video => video.pause());
    root.closest(".receiver-experience")?.querySelector<HTMLAudioElement>('audio[data-audio-layer="section"]')?.pause();
    const start = root.scrollTop;
    const destination = index * root.clientHeight;
    const duration = motion && !instant && Math.abs(destination - start) > 1 ? 420 : 0;
    const began = performance.now();
    const paint = () => slides.forEach((element, position) => element.style.setProperty("--scroll-progress", String(motion ? Math.max(-1, Math.min(1, position - root.scrollTop / Math.max(1, root.clientHeight))) : 0)));
    const animate = (now: number) => {
      const progress = duration ? Math.min(1, (now - began) / duration) : 1;
      root.scrollTop = start + (destination - start) * (1 - Math.pow(1 - progress, 3));
      paint();
      if (progress < 1) { state.current.frame = requestAnimationFrame(animate); return; }
      root.scrollTop = destination; paint();
      // Commit playback on the following frame, after layout has reached center.
      state.current.frame = requestAnimationFrame(() => {
        state.current.settled = true; root.dataset.settled = "true"; setSettled(true);
        slide.focus({ preventScroll: true });
      });
    };
    state.current.frame = requestAnimationFrame(animate);
  }, [motion, total]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || !started) return;
    const navigation = state.current;
    let wheelLast = 0, wheelSum = 0, wheelConsumed = false;
    let touch: { x: number; y: number; target: EventTarget | null; consumed: boolean } | null = null;
    // Long letters/captions have their own scroll area. A gesture inside it is
    // reserved for reading; navigation buttons remain available at every length.
    const readingArea = (target: EventTarget | null) => {
      const element = target instanceof Element ? target.closest<HTMLElement>("[data-section-content]") : null;
      return Boolean(element && element.scrollHeight > element.clientHeight + 2);
    };
    const inputControl = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || inputControl(event.target)) return;
      if (readingArea(event.target) && state.current.settled) return;
      event.preventDefault();
      const now = performance.now();
      if (now - wheelLast > 180) { wheelSum = 0; wheelConsumed = false; }
      wheelLast = now;
      if (wheelConsumed || !state.current.settled) { wheelConsumed = true; return; }
      wheelSum += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? root.clientHeight : 1);
      if (Math.abs(wheelSum) < 18) return;
      wheelConsumed = true;
      const next = Math.max(0, Math.min(total - 1, state.current.index + Math.sign(wheelSum)));
      if (next !== state.current.index) go(next);
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || inputControl(event.target) || readingArea(event.target)) { touch = null; return; }
      touch = { x: event.touches[0].clientX, y: event.touches[0].clientY, target: event.target, consumed: false };
    };
    const touchMove = (event: TouchEvent) => {
      if (!touch || event.touches.length !== 1) return;
      const dy = touch.y - event.touches[0].clientY, dx = touch.x - event.touches[0].clientX;
      if (Math.abs(dy) <= Math.abs(dx)) return;
      event.preventDefault();
      if (touch.consumed || !state.current.settled || Math.abs(dy) < 40) return;
      touch.consumed = true;
      const next = Math.max(0, Math.min(total - 1, state.current.index + Math.sign(dy)));
      if (next !== state.current.index) go(next);
    };
    const touchEnd = () => { touch = null; };
    let height = root.clientHeight;
    const resize = new ResizeObserver(() => {
      if (height === root.clientHeight) return;
      height = root.clientHeight; go(state.current.index, true);
    });
    // Scrollbars, accessibility tools, and focus scrolling still land at a full
    // section. Only our animation owns intermediate scroll offsets.
    const scroll = () => {
      if (state.current.settled && Math.abs(root.scrollTop - state.current.index * root.clientHeight) > 1) {
        go(Math.round(root.scrollTop / Math.max(1, root.clientHeight)), true);
      }
    };
    root.addEventListener("wheel", wheel, { passive: false });
    root.addEventListener("touchstart", touchStart, { passive: true });
    root.addEventListener("touchmove", touchMove, { passive: false });
    root.addEventListener("touchend", touchEnd); root.addEventListener("touchcancel", touchEnd);
    root.addEventListener("scroll", scroll, { passive: true }); resize.observe(root);
    go(state.current.index, true);
    return () => {
      cancelAnimationFrame(navigation.frame); resize.disconnect();
      root.removeEventListener("wheel", wheel); root.removeEventListener("touchstart", touchStart);
      root.removeEventListener("touchmove", touchMove); root.removeEventListener("touchend", touchEnd); root.removeEventListener("touchcancel", touchEnd);
      root.removeEventListener("scroll", scroll);
    };
  }, [started, total, go]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest("button, input, textarea, select, video, audio, a, [contenteditable=true]")) return;
    const content = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-section-content]") : null;
    if (content && content.scrollHeight > content.clientHeight + 2) return;
    const direction = event.key === "ArrowDown" || event.key === "PageDown" || event.key === " " && !event.shiftKey ? 1 : event.key === "ArrowUp" || event.key === "PageUp" || event.key === " " && event.shiftKey ? -1 : 0;
    if (direction) {
      event.preventDefault();
      if (!event.repeat) go(state.current.index + direction);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault(); if (!event.repeat) go(event.key === "Home" ? 0 : total - 1);
    }
  }
  return { scrollerRef, activeIndex, settled, go, onKeyDown };
}
