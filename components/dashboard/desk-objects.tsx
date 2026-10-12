"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei/core/RoundedBox";
import { CanvasTexture, Color, CubicBezierCurve3, DoubleSide, Quaternion, SRGBColorSpace, Vector2, Vector3, type MeshBasicMaterial } from "three";
import type { DeskAtmosphere } from "@/lib/dashboard/day-cycle";

type LampPower = { atmosphere: RefObject<DeskAtmosphere>; pose: RefObject<{ lamp: number }> };

function seededRandom() {
  let seed = 42;
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}

function useDeskTexture(kind: "wood" | "album" | "letter" | "photo") {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = kind === "wood" ? 1024 : 512;
    canvas.height = kind === "wood" ? 512 : 640;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width, h = canvas.height;
    const random = seededRandom();
    ctx.fillStyle = { wood: "#574637", album: "#314239", letter: "#e9debd", photo: "#ebdec5" }[kind];
    ctx.fillRect(0, 0, w, h);
    if (kind === "wood") {
      for (let i = 0; i < 1100; i++) {
        const y = random() * h;
        ctx.strokeStyle = `rgba(${random() > .5 ? "210,169,119" : "15,9,6"},${.015 + random() * .07})`;
        ctx.lineWidth = .3 + random() * 1.6;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 24) {
          const yy = y + Math.sin(x * .006 + y * .025) * 3.5 + Math.sin(x * .012 + y * .01) * 1.4;
          if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    } else if (kind === "album") {
      for (let i = 0; i < 640; i += 3) {
        ctx.fillStyle = "rgba(255,240,200,.025)"; ctx.fillRect(0, i, w, 1);
      }
      ctx.strokeStyle = "#a58c5f"; ctx.lineWidth = 2; ctx.strokeRect(30, 30, 452, 580);
      ctx.textAlign = "center"; ctx.fillStyle = "#d5bf8d";
      ctx.font = "13px sans-serif"; ctx.fillText("K E N A N G I N", 256, 205);
      ctx.font = "italic 55px Georgia"; ctx.fillText("Cerita", 256, 288); ctx.fillText("kita.", 256, 353);
      ctx.font = "13px sans-serif"; ctx.fillText("SIMPAN YANG BERARTI", 256, 456);
      ctx.beginPath(); ctx.arc(256, 511, 14, 0, Math.PI * 2); ctx.stroke();
    } else if (kind === "letter") {
      ctx.fillStyle = "#9b7352"; ctx.font = "italic 38px Georgia";
      ctx.fillText("Untuk yang berarti,", 52, 128);
      ctx.fillStyle = "#b6a584";
      for (let i = 0; i < 8; i++) ctx.fillRect(54, 195 + i * 34, i === 7 ? 195 : 350, 2);
      ctx.font = "italic 32px Georgia"; ctx.fillStyle = "#9b7352"; ctx.fillText("dari hati.", 272, 522);
    } else {
      const sky = ctx.createLinearGradient(0, 40, 0, 440);
      sky.addColorStop(0, "#3c5558"); sky.addColorStop(.6, "#c09e72"); sky.addColorStop(1, "#dabe86");
      ctx.fillStyle = sky; ctx.fillRect(28, 28, 456, 456);
      ctx.fillStyle = "#f6d49b"; ctx.beginPath(); ctx.arc(348, 157, 42, 0, 7); ctx.fill();
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ["#687468", "#455e56", "#243f39"][layer]; ctx.beginPath(); ctx.moveTo(28, 484);
        for (let x = 28; x <= 484; x += 8) ctx.lineTo(x, 275 + layer * 61 + Math.sin(x * .014 + layer * 2) * 48 + Math.sin(x * .032) * 9);
        ctx.lineTo(484, 484); ctx.fill();
      }
      ctx.fillStyle = "#796955"; ctx.font = "italic 29px Georgia"; ctx.fillText("suatu hari, bersama.", 53, 554);
    }
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [kind]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function Rod({ from, to, radius = .045, color = "#b59862" }: { from: [number, number, number]; to: [number, number, number]; radius?: number; color?: string }) {
  const transform = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to);
    return { center: a.clone().add(b).multiplyScalar(.5), length: a.distanceTo(b), rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.sub(a).normalize()) };
  }, [from, to]);
  return <mesh position={transform.center} quaternion={transform.rotation} castShadow>
    <cylinderGeometry args={[radius, radius, transform.length, 16]} />
    <meshStandardMaterial color={color} metalness={.78} roughness={.3} />
  </mesh>;
}

function Lamp({ x, atmosphere, pose }: { x: number } & LampPower) {
  const bulb = useRef<MeshBasicMaterial>(null);
  const colors = useMemo(() => ({ off: new Color("#383f32"), on: new Color("#ffe0a2") }), []);
  useFrame(() => bulb.current?.color.lerpColors(colors.off, colors.on, atmosphere.current.night * pose.current.lamp));
  const profile = useMemo(() => [new Vector2(.08, .43), new Vector2(.17, .42), new Vector2(.19, .32), new Vector2(.29, .17), new Vector2(.57, -.02), new Vector2(.73, -.16), new Vector2(.74, -.21)], []);
  const cable = useMemo(() => new CubicBezierCurve3(new Vector3(.25, .04, .15), new Vector3(1.4, .03, .4), new Vector3(1.2, .03, -1.3), new Vector3(1.2, -.6, -2.4)), []);
  return <group position={[x, 0, -1.8]} name="Atelier / brass reading lamp">
    <mesh position={[0, .09, 0]} castShadow receiveShadow>
      <cylinderGeometry args={[.54, .58, .16, 48]} /><meshStandardMaterial color="#26392f" metalness={.5} roughness={.32} />
    </mesh>
    <mesh position={[0, .17, 0]}><cylinderGeometry args={[.3, .37, .02, 40]} /><meshStandardMaterial color="#9f8453" metalness={.8} roughness={.3} /></mesh>
    <Rod from={[0, .18, 0]} to={[.15, 1.8, -.25]} />
    <Rod from={[.15, 1.8, -.25]} to={[-.7, 2.65, .15]} />
    <mesh position={[.15, 1.8, -.25]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.11, .11, .16, 24]} /><meshStandardMaterial color="#c3a779" metalness={.7} roughness={.25} /></mesh>
    <group position={[-.7, 2.5, .15]} rotation={[0, 0, -.22]}>
      <mesh castShadow><latheGeometry args={[profile, 64]} /><meshStandardMaterial color="#243c32" metalness={.42} roughness={.3} side={DoubleSide} /></mesh>
      <mesh position={[0, -.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.726, .018, 8, 64]} /><meshStandardMaterial color="#d4b678" metalness={.8} roughness={.28} /></mesh>
      <mesh position={[0, -.19, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[.706, 48]} /><meshBasicMaterial ref={bulb} color="#ffe0a2" toneMapped={false} side={DoubleSide} /></mesh>
    </group>
    <mesh><tubeGeometry args={[cable, 30, .02, 8, false]} /><meshStandardMaterial color="#161914" roughness={.8} /></mesh>
  </group>;
}

export function DeskObjects({ dark, spread, atmosphere, pose }: { dark: boolean; spread: number } & LampPower) {
  const wood = useDeskTexture("wood"), album = useDeskTexture("album"), letter = useDeskTexture("letter"), photo = useDeskTexture("photo");
  const stitching = useMemo(() => {
    const points: number[] = [];
    const x = 3.4 * spread - .09, front = 2.5, back = -1.8;
    for (let z = back; z < front; z += .11) for (const side of [-x, x]) points.push(side, .061, z, side, .061, Math.min(z + .045, front));
    for (let a = -x; a < x; a += .11) for (const edge of [back, front]) points.push(a, .061, edge, Math.min(a + .045, x), .061, edge);
    return new Float32Array(points);
  }, [spread]);
  return <group name="Meja Kenangan">
    <RoundedBox args={[14, .32, 8]} radius={.12} smoothness={3} position={[0, -.18, 0]} castShadow receiveShadow name="Walnut / rounded solid edge">
      <meshStandardMaterial color="#664b34" map={wood} roughness={.54} metalness={.05} />
    </RoundedBox>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.011, 0]} receiveShadow>
      <planeGeometry args={[13.78, 7.78]} /><meshStandardMaterial map={wood} color="#a28a70" roughness={.72} />
    </mesh>
    {[-5.8, 5.8].flatMap(x => [-2.9, 2.9].map(z => <Rod key={`${x}:${z}`} from={[x, -.25, z]} to={[x * 1.08, -3.3, z * 1.08]} radius={.1} color="#383630" />))}
    <RoundedBox args={[6.8 * spread, .045, 4.5]} radius={.06} smoothness={2} position={[0, .035, .35]} receiveShadow name="Leather / writing mat">
      <meshStandardMaterial color="#2e322a" roughness={.94} />
    </RoundedBox>
    <lineSegments name="Leather / saddle stitching">
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[stitching, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#81785e" transparent opacity={.48} />
    </lineSegments>
    <group position={[-4.55 * spread, .04, -.5]} rotation={[0, -.19, 0]} name="Album / linen and gold foil">
      <RoundedBox args={[2.15, .27, 2.95]} radius={.045} smoothness={2} castShadow><meshStandardMaterial color="#cfc3a4" roughness={.95} /></RoundedBox>
      {[-.145, .145].map(y => <RoundedBox key={y} args={[2.26, .055, 3.07]} radius={.025} smoothness={2} position={[0, y, 0]} castShadow><meshStandardMaterial color="#334237" roughness={.85} /></RoundedBox>)}
      <mesh position={[0, .175, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[2.2, 3]} /><meshStandardMaterial map={album} roughness={.86} /></mesh>
      <mesh position={[-.97, 0, 0]}><boxGeometry args={[.17, .34, 3.04]} /><meshStandardMaterial color="#293a2e" roughness={.9} /></mesh>
      <mesh position={[.64, .185, 0]}><boxGeometry args={[.045, .025, 3.13]} /><meshStandardMaterial color="#b99860" metalness={.2} roughness={.65} /></mesh>
    </group>
    <group position={[3.8 * spread, .065, 1.55]} rotation={[0, -.16, 0]} name="Letter / unfinished story">
      <mesh rotation={[-Math.PI / 2, 0, .07]} receiveShadow castShadow><boxGeometry args={[2.35, 2.7, .02]} /><meshStandardMaterial color="#b5a184" roughness={1} /></mesh>
      <mesh position={[.08, .03, -.08]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow><planeGeometry args={[2.25, 2.68]} /><meshStandardMaterial map={letter} roughness={1} /></mesh>
      <group position={[.96, .13, .14]} rotation={[0, .15, Math.PI / 2]}>
        <mesh castShadow><cylinderGeometry args={[.047, .047, 2.25, 20]} /><meshStandardMaterial color="#20332a" roughness={.25} metalness={.45} /></mesh>
        <mesh position={[0, -1.18, 0]}><coneGeometry args={[.047, .18, 16]} /><meshStandardMaterial color="#c9ac72" metalness={.9} roughness={.23} /></mesh>
        <mesh position={[0, .62, 0]}><cylinderGeometry args={[.05, .05, .045, 20]} /><meshStandardMaterial color="#d4b679" metalness={.9} roughness={.23} /></mesh>
      </group>
    </group>
    <group position={[-3.7 * spread, .26, 1.65]} rotation={[0, .2, 0]} name="Photographs / illustrated memories">
      <mesh rotation={[-Math.PI / 2, 0, -.12]} position={[-.24, -.06, -.18]} castShadow><boxGeometry args={[1.5, 1.88, .025]} /><meshStandardMaterial color="#b5a58d" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, .04]} castShadow receiveShadow><boxGeometry args={[1.5, 1.88, .025]} /><meshStandardMaterial color="#e4d3ac" /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, .04]} position={[0, .014, 0]}><planeGeometry args={[1.48, 1.86]} /><meshStandardMaterial map={photo} roughness={.72} /></mesh>
    </group>
    <group position={[1.45 * spread, .04, -2.6]} name="Envelope / wax seal" rotation={[0, .04, 0]}>
      <RoundedBox args={[2.1, .055, 1.3]} radius={.015} smoothness={2} castShadow receiveShadow><meshStandardMaterial color="#b19b77" roughness={.96} /></RoundedBox>
      <mesh position={[0, .08, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} scale={[1, 1, .06]}><coneGeometry args={[.66, .02, 4]} /><meshStandardMaterial color="#c9b28a" /></mesh>
      <mesh position={[0, .07, .12]}><cylinderGeometry args={[.18, .2, .045, 28]} /><meshStandardMaterial color="#9d493a" roughness={.57} metalness={.12} /></mesh>
      <mesh position={[0, .096, .12]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.125, .009, 6, 28]} /><meshStandardMaterial color="#c36b52" /></mesh>
    </group>
    <Lamp x={4.5 * spread} atmosphere={atmosphere} pose={pose} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.35, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color={dark ? "#1c1914" : "#c1ccc5"} roughness={1} /></mesh>
  </group>;
}
