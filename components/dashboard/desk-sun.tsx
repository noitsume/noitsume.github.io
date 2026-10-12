"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, Color, Object3D, SRGBColorSpace, type DirectionalLight, type Fog, type HemisphereLight, type SpotLight } from "three";
import type { DeskAtmosphere } from "@/lib/dashboard/day-cycle";

/** A light cookie projects a window onto every receiving object, not a flat overlay. */
function useWindowCookie() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#050709"; ctx.fillRect(0, 0, 512, 512);
    ctx.filter = "blur(3px)"; ctx.fillStyle = "#fff9e7";
    for (const x of [67, 266]) for (const y of [48, 264]) ctx.fillRect(x, y, 180, 198);
    const map = new CanvasTexture(canvas); map.colorSpace = SRGBColorSpace; return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function DeskSun({ atmosphere }: { atmosphere: RefObject<DeskAtmosphere> }) {
  const { invalidate } = useThree();
  const sky = useRef<HemisphereLight>(null), fill = useRef<DirectionalLight>(null), sun = useRef<SpotLight>(null);
  const cookie = useWindowCookie();
  const colors = useMemo(() => ({ night: new Color("#191713"), day: new Color("#dce5e2"), background: new Color() }), []);
  const target = useMemo(() => { const object = new Object3D(); object.position.set(.6, 0, -.5); return object; }, []);
  useEffect(() => {
    const refresh = () => invalidate();
    document.addEventListener("kenangin:desk-light-frame", refresh);
    invalidate();
    return () => document.removeEventListener("kenangin:desk-light-frame", refresh);
  }, [invalidate]);
  useFrame(({ scene }) => {
    const { day, night } = atmosphere.current;
    if (sky.current) sky.current.intensity = .8 * night + 2.1 * day;
    if (fill.current) fill.current.intensity = 1.25 * night + 1.6 * day;
    if (sun.current) sun.current.intensity = 920 * day;
    scene.environmentIntensity = .45 * night + .65 * day;
    colors.background.lerpColors(colors.night, colors.day, day / Math.max(.001, day + night)).multiplyScalar(Math.max(.002, day + night));
    (scene.background as Color)?.copy(colors.background);
    (scene.fog as Fog)?.color.copy(colors.background);
  });
  return <>
    <color attach="background" args={["#191713"]} />
    <fog attach="fog" args={["#191713", 17, 48]} />
    <hemisphereLight ref={sky} args={["#c7d6ca", "#3e2c1c", .8]} />
    <directionalLight ref={fill} position={[-6, 8, 4]} color="#ffedce" intensity={1.25} />
    <primitive object={target} />
    <spotLight ref={sun} name="Morning / window sunlight" position={[-9, 10, 9]} target={target}
      color="#fff0cf" intensity={0} angle={.57} penumbra={.55} decay={2} map={cookie}
      castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-.0002} shadow-normalBias={.035}
      shadow-camera-near={1} shadow-camera-far={45} />
  </>;
}
