"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei/core/Environment";
import { Lightformer } from "@react-three/drei/core/Lightformer";
import { gsap } from "gsap";
import { Object3D, PCFShadowMap, type SpotLight } from "three";
import { releaseDeskArrival } from "@/lib/dashboard/arrival";
import { DESK_CAMERA_DURATION, sampleDeskCamera } from "@/lib/dashboard/desk-camera";
import { DeskObjects } from "./desk-objects";
import { DeskLight } from "./desk-light";
import { DeskSun } from "./desk-sun";
import type { DeskAtmosphere } from "@/lib/dashboard/day-cycle";

type Props = { theme: "dark" | "light"; host: RefObject<HTMLDivElement | null>; atmosphere: RefObject<DeskAtmosphere>; onFailure: () => void };
const markDesk = (name: string) => { if (process.env.NODE_ENV === "development") performance.mark(`desk:${name}`); };
markDesk("module");

function DeskWorld({ theme, host, atmosphere, onFailure }: Props) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const pose = useRef({ progress: 1, x: 0, y: 0, lamp: 1 });
  const lamp = useRef<SpotLight>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const mode = useRef<"workspace" | "arrival" | "tour">("workspace");
  const started = useRef(false);
  const dark = theme === "dark";
  const aspect = size.width / Math.max(1, size.height);
  const { spread } = sampleDeskCamera(1, aspect);
  const lampTarget = useMemo(() => {
    const target = new Object3D(); target.position.set(.65, 0, .6); return target;
  }, []);

  useFrame(() => {
    const view = sampleDeskCamera(pose.current.progress, aspect);
    camera.position.set(view.position[0] + pose.current.x, view.position[1] + pose.current.y, view.position[2]);
    camera.lookAt(view.target[0] + pose.current.x * .35, view.target[1], view.target[2]);
    if (lamp.current) {
      lamp.current.intensity = 58 * atmosphere.current.night * pose.current.lamp;
    }
  });

  useEffect(() => {
    markDesk("mount");
    let cancelled = false, firstFrame = 0, ready = false;
    const root = document.documentElement;
    const element = host.current;
    const motion = pose.current;
    const shell = element?.closest<HTMLElement>(".app-shell--desk-studio");
    const groups = shell ? Array.from(shell.querySelectorAll<HTMLElement>(".top-navbar, .app-shell__left, .app-shell__main, .app-shell__right")) : [];
    const context = gsap.context(() => {}, shell ?? undefined);
    const clearUi = () => groups.forEach(el => {
      el.style.removeProperty("opacity"); el.style.removeProperty("transform"); el.inert = false;
    });
    const hideUi = () => {
      groups.forEach(el => { el.inert = true; });
      gsap.set(groups, { opacity: 0, y: 18 });
    };
    const notifyTour = (open: boolean) => document.dispatchEvent(new CustomEvent("kenangin:desk-tour", { detail: open }));
    const finish = () => {
      const wasTour = mode.current === "tour";
      timeline.current?.kill(); timeline.current = null;
      gsap.killTweensOf(pose.current);
      Object.assign(pose.current, { progress: 1, x: 0, y: 0, lamp: 1 });
      mode.current = "workspace";
      clearUi(); delete root.dataset.deskEntry; delete root.dataset.deskView;
      notifyTour(false); invalidate();
      if (wasTour) shell?.querySelector<HTMLButtonElement>(".desk-explore-button")?.focus({ preventScroll: true });
    };
    const reveal = (at: number) => {
      timeline.current?.to(groups, { opacity: 1, y: 0, duration: .44, stagger: .025, ease: "power2.out" }, at);
    };
    const explore = () => {
      if (!ready || document.hidden || atmosphere.current.active || mode.current !== "workspace") return;
      window.scrollTo({ top: 0, behavior: "instant" });
      mode.current = "tour"; root.dataset.deskView = "tour"; notifyTour(true);
      groups.forEach(el => { el.inert = true; });
      context.add(() => {
        timeline.current = gsap.timeline()
          .to(groups, { opacity: 0, y: 18, duration: .3, ease: "power2.in" }, 0)
          .to(pose.current, { progress: .3, duration: 1.5, ease: "power2.inOut", onUpdate: invalidate }, .08);
      });
    };
    const returnToWorkspace = () => {
      if (mode.current !== "tour") return;
      timeline.current?.kill(); gsap.killTweensOf(pose.current);
      notifyTour(false);
      context.add(() => {
        timeline.current = gsap.timeline({ onComplete: finish })
          .to(pose.current, { progress: 1, x: 0, y: 0, lamp: 1, duration: 1.25, ease: "power2.inOut", onUpdate: invalidate });
        reveal(.85);
      });
    };
    const pointer = (event: PointerEvent) => {
      if (mode.current !== "tour" || event.pointerType !== "mouse" || (timeline.current?.isActive() ?? false)) return;
      gsap.to(pose.current, { x: (event.clientX / innerWidth - .5) * .65, y: (.5 - event.clientY / innerHeight) * .32, duration: .8, overwrite: "auto", ease: "power2.out", onUpdate: invalidate });
    };
    const skip = (event: Event) => {
      if (mode.current === "arrival") releaseDeskArrival();
      else if (event instanceof KeyboardEvent && event.key === "Escape") returnToWorkspace();
    };
    const hidden = () => { if (document.hidden) releaseDeskArrival(); };
    const dimLamp = (event: Event) => {
      if (mode.current !== "tour") return;
      gsap.to(pose.current, { lamp: (event as CustomEvent<boolean>).detail ? 1 : .15, duration: .65, overwrite: "auto", onUpdate: invalidate });
    };
    const start = async () => {
      markDesk("compile-start");
      try { await gl.compileAsync(scene, camera); } catch { if (!cancelled) onFailure(); return; }
      markDesk("compile-end");
      if (cancelled) return;
      const arrival = !started.current && root.dataset.deskEntry === "pending" && !document.hidden;
      pose.current.progress = arrival ? 0 : 1;
      invalidate();
      firstFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        started.current = true;
        ready = true; element?.setAttribute("data-ready", "true");
        markDesk("ready");
        document.dispatchEvent(new Event("kenangin:desk-ready"));
        if (!arrival || root.dataset.deskEntry !== "pending") { finish(); return; }
        mode.current = "arrival"; root.dataset.deskEntry = "running";
        markDesk("arrival-start");
        context.add(() => {
          hideUi();
          timeline.current = gsap.timeline({ onComplete: () => { markDesk("arrival-end"); finish(); releaseDeskArrival(); } })
            .to(pose.current, { progress: 1, duration: DESK_CAMERA_DURATION, ease: "none", onUpdate: invalidate });
          reveal(1.95);
        });
      });
    };
    document.addEventListener("kenangin:desk-release", finish);
    document.addEventListener("kenangin:desk-explore", explore);
    document.addEventListener("kenangin:desk-return", returnToWorkspace);
    document.addEventListener("kenangin:desk-lamp", dimLamp);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    window.addEventListener("wheel", skip, { passive: true, capture: true });
    void start();
    return () => {
      cancelled = true; cancelAnimationFrame(firstFrame);
      document.removeEventListener("kenangin:desk-release", finish);
      document.removeEventListener("kenangin:desk-explore", explore);
      document.removeEventListener("kenangin:desk-return", returnToWorkspace);
      document.removeEventListener("kenangin:desk-lamp", dimLamp);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
      window.removeEventListener("wheel", skip, true);
      context.revert();
      // React's development probe mounts, cleans up, then mounts this effect.
      // Cancelling preparation must not consume the still-pending login hint.
      if (mode.current !== "workspace" || !element?.isConnected) finish();
      else { timeline.current = null; gsap.killTweensOf(motion); clearUi(); }
      element?.removeAttribute("data-ready");
      document.dispatchEvent(new Event("kenangin:desk-ready"));
    };
  }, [gl, scene, camera, host, atmosphere, invalidate, onFailure]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const expose = () => window.dispatchEvent(new CustomEvent("kenangin:desk-context", { detail: {
      scene, renderer: gl, camera, timeline: timeline.current, progress: pose.current.progress,
      mode: mode.current, atmosphere: { ...atmosphere.current }, invalidate,
    } }));
    window.addEventListener("kenangin:inspect-desk", expose);
    return () => window.removeEventListener("kenangin:inspect-desk", expose);
  }, [scene, gl, camera, atmosphere, invalidate]);

  return <>
    <DeskSun atmosphere={atmosphere} />
    <primitive object={lampTarget} />
    <spotLight ref={lamp} position={[4.5 * spread - .7, 2.29, -1.65]} target={lampTarget}
      name="Night / reading light" color="#ffd398" intensity={58} angle={1.07} penumbra={.8} decay={2}
      castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-.00025} shadow-normalBias={.035} />
    <Environment resolution={128} frames={1} environmentIntensity={.45}>
      <Lightformer form="rect" intensity={3} color="#ffe2b3" scale={[8, 3, 1]} position={[-4, 6, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <Lightformer form="rect" intensity={1.5} color="#a3c3ca" scale={[4, 8, 1]} position={[5, 3, -5]} rotation={[0, -Math.PI / 4, 0]} />
    </Environment>
    <DeskObjects dark={dark} spread={spread} atmosphere={atmosphere} pose={pose} />
    <DeskLight spread={spread} atmosphere={atmosphere} pose={pose} />
  </>;
}

export default function DeskScene(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = container.current;
    el?.addEventListener("webglcontextlost", props.onFailure, true);
    return () => el?.removeEventListener("webglcontextlost", props.onFailure, true);
  }, [props.onFailure]);
  return <div className="dashboard-desk__canvas" ref={container}>
    <Canvas frameloop="demand" dpr={[1, 1.5]} shadows={{ type: PCFShadowMap }} camera={{ fov: 42, near: .1, far: 80, position: [0, 11.8, 7.8] }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}
      onCreated={({ camera }) => { camera.lookAt(0, 0, .2); }}>
      <DeskWorld {...props} />
    </Canvas>
  </div>;
}
