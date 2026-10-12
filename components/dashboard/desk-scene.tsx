"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { gsap } from "gsap";
import { Color, DoubleSide, Matrix4, Quaternion, Vector3, type Mesh, type SpotLight } from "three";
import { releaseDeskArrival } from "@/lib/dashboard/arrival";

type Props = { theme: "dark" | "light"; host: RefObject<HTMLDivElement | null>; onFailure: () => void };

const beamVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const beamFragment = `
  varying vec2 vUv;
  uniform vec3 uColor;
  void main() {
    float width = mix(1.0, 0.055, vUv.y);
    float across = abs(vUv.x * 2.0 - 1.0) / width;
    float feather = exp(-across * across * 4.5) * (1.0 - smoothstep(0.7, 1.0, across));
    float ends = smoothstep(0.0, 0.4, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y));
    float alpha = feather * ends * 0.095;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const contactFragment = `
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    gl_FragColor = vec4(0.02, 0.016, 0.012, (1.0 - smoothstep(0.15, 1.0, r)) * 0.34);
    #include <colorspace_fragment>
  }
`;

// Palette-calibrated wood: analytic penumbra, subtle grain and no image transfer.
// The spot and this material share the same source/target; DOM keeps its own color.
const woodVertex = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const woodFragment = `
  varying vec3 vWorld;
  uniform vec3 uBase;
  uniform vec3 uSoft;
  uniform vec3 uPool;
  uniform vec3 uSource;
  uniform vec3 uTarget;
  uniform float uDark;
  void main() {
    vec3 ray = vWorld - uSource;
    float theta = dot(normalize(ray), normalize(uTarget - uSource));
    float spot = smoothstep(0.76, 0.985, theta) / (1.0 + dot(ray, ray) * 0.028);
    float daylight = exp(-dot(vWorld.xz - vec2(-4.0, 3.0), vWorld.xz - vec2(-4.0, 3.0)) * 0.016);
    float wash = mix(daylight * 0.42, spot * 0.48, uDark);
    float broad = sin(vWorld.z * 5.2 + sin(vWorld.x * 0.33) * 0.4) * 0.5 + 0.5;
    vec3 color = mix(uBase, uSoft, broad * 0.14);
    color = mix(color, uPool, wash);
    float grain = sin(vWorld.z * 265.0 + sin(vWorld.x * 1.3) * 1.6) * 0.008;
    color *= 1.0 + grain;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor.rgb += (dither - 0.5) / 255.0;
  }
`;

function Arm({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const geometry = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to);
    return { center: a.clone().add(b).multiplyScalar(.5), length: a.distanceTo(b), rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.sub(a).normalize()) };
  }, [from, to]);
  return <mesh position={geometry.center} quaternion={geometry.rotation}>
    <cylinderGeometry args={[.035, .035, geometry.length, 12]} />
    <meshStandardMaterial color="#302c27" metalness={.7} roughness={.37} />
  </mesh>;
}

function DeskWorld({ theme, host, onFailure }: Props) {
  const { gl, scene, camera, size, invalidate } = useThree();
  const light = useRef<SpotLight>(null);
  const target = useRef<Mesh>(null);
  const shaft = useRef<Mesh>(null);
  const pose = useRef({ progress: 1 });
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const started = useRef(false);
  const dark = theme === "dark";
  const aspect = size.width / Math.max(1, size.height);
  const lampX = Math.min(8, 8.44 * aspect * .43);
  const head = useMemo(() => new Vector3(lampX, 2.25, -3.2), [lampX]);
  const aim = useMemo(() => new Vector3(lampX - 2.25, .015, .6), [lampX]);
  const beam = useMemo(() => ({
    center: head.clone().add(aim).multiplyScalar(.5),
    length: head.distanceTo(aim),
    rotation: new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), aim.clone().sub(head).normalize()),
  }), [head, aim]);
  const beamUniforms = useMemo(() => ({ uColor: { value: new Color("#ffc77d") } }), []);
  const beamBasis = useMemo(() => ({ x: new Vector3(), y: new Vector3(), z: new Vector3(), matrix: new Matrix4() }), []);
  const woodUniforms = useMemo(() => ({
    uBase: { value: new Color(dark ? "#12110f" : "#eeeae2") },
    uSoft: { value: new Color(dark ? "#29231b" : "#e3ded4") },
    uPool: { value: new Color(dark ? "#80603b" : "#fff6e5") },
    uSource: { value: head }, uTarget: { value: aim }, uDark: { value: dark ? 1 : 0 },
  }), [dark, head, aim]);

  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
    invalidate();
  }, [dark, head, aim, woodUniforms, invalidate]);

  useFrame(() => {
    const p = pose.current.progress;
    // One writer for the camera; GSAP owns progress, Fiber owns rendering.
    camera.position.set((1 - p) * .65, 8.2 + p * 2.8, 5.2 * (1 - p) + .35 * p);
    camera.lookAt(0, 0, .8 * (1 - p));
    // A feathered light card faces the camera around its source/target axis.
    // It has no cone silhouette or circular end cap to expose during the move.
    if (shaft.current) {
      const { x, y, z, matrix } = beamBasis;
      y.subVectors(head, aim).normalize();
      z.subVectors(camera.position, beam.center).normalize();
      x.crossVectors(y, z).normalize();
      z.crossVectors(x, y).normalize();
      shaft.current.quaternion.setFromRotationMatrix(matrix.makeBasis(x, y, z));
    }
  });

  useEffect(() => {
    let cancelled = false;
    let firstFrame = 0;
    const root = document.documentElement;
    const shell = host.current?.closest<HTMLElement>(".app-shell--desk-studio");
    const groups = shell ? Array.from(shell.querySelectorAll<HTMLElement>(".top-navbar, .app-shell__left, .app-shell__main, .app-shell__right")) : [];
    const clearUi = () => groups.forEach(el => { el.style.removeProperty("opacity"); el.style.removeProperty("transform"); });
    const finish = () => {
      timeline.current?.kill();
      timeline.current = null;
      pose.current.progress = 1;
      clearUi();
      delete root.dataset.deskEntry;
      invalidate();
    };
    const ctx = gsap.context(() => {}, shell ?? undefined);
    const start = async () => {
      try { await gl.compileAsync(scene, camera); } catch { if (!cancelled) onFailure(); return; }
      if (cancelled) return;
      const arrival = !started.current && root.dataset.deskEntry === "pending" && document.visibilityState === "visible";
      started.current = true;
      pose.current.progress = arrival ? 0 : 1;
      // Pre-render the exact start pose before allowing the timeline to move.
      invalidate();
      firstFrame = requestAnimationFrame(() => {
        if (cancelled) return;
        host.current?.setAttribute("data-ready", "true");
        if (!arrival || root.dataset.deskEntry !== "pending") { finish(); return; }
        root.dataset.deskEntry = "running";
        ctx.add(() => {
          gsap.set(groups, { opacity: 0, y: 12 });
          timeline.current = gsap.timeline({ onComplete: () => { finish(); releaseDeskArrival(); } })
            .to(pose.current, { progress: 1, duration: 1.45, ease: "power2.inOut", onUpdate: invalidate }, 0)
            .to(groups, { opacity: 1, y: 0, duration: .48, stagger: .04, ease: "power2.out" }, 1.03);
        });
      });
    };
    document.addEventListener("kenangin:desk-release", finish);
    void start();
    return () => {
      cancelled = true; cancelAnimationFrame(firstFrame);
      document.removeEventListener("kenangin:desk-release", finish);
      ctx.revert(); timeline.current = null; clearUi();
    };
  }, [gl, scene, camera, host, invalidate, onFailure]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const expose = () => window.dispatchEvent(new CustomEvent("kenangin:desk-context", { detail: { scene, renderer: gl, camera, timeline: timeline.current, progress: pose.current.progress } }));
    window.addEventListener("kenangin:inspect-desk", expose);
    return () => window.removeEventListener("kenangin:inspect-desk", expose);
  }, [scene, gl, camera]);

  return <>
    <color attach="background" args={[dark ? "#100f0d" : "#eeeae2"]} />
    <ambientLight intensity={dark ? .75 : 2.1} color={dark ? "#d7c6af" : "#fff5e3"} />
    <mesh position={[0, -.16, 0]} name="Desk / solid edge">
      <boxGeometry args={[32, .3, 14]} />
      <meshStandardMaterial color={dark ? "#171510" : "#b3a797"} roughness={.9} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} name="Desk / grain">
      <planeGeometry args={[32, 14]} />
      <shaderMaterial vertexShader={woodVertex} fragmentShader={woodFragment} uniforms={woodUniforms} toneMapped={false} />
    </mesh>
    <mesh ref={target} position={aim} visible={false}><sphereGeometry args={[.01, 4, 4]} /><meshBasicMaterial /></mesh>
    <spotLight ref={light} position={head} color="#ffc77d" intensity={dark ? 48 : 0} angle={.67} penumbra={1} decay={2} distance={15} />
    {!dark && <directionalLight position={[-5, 7, 6]} intensity={1.5} color="#fff6e2" />}
    <group visible={dark} name="Desk / practical lamp">
      <mesh position={[lampX + .3, .07, -4]} scale={[1.25, 1, .82]}>
        <cylinderGeometry args={[.46, .49, .12, 40]} />
        <meshStandardMaterial color="#24211d" metalness={.6} roughness={.4} />
      </mesh>
      <Arm from={[lampX + .3, .12, -4]} to={[lampX + .65, 1.65, -4.1]} />
      <Arm from={[lampX + .65, 1.65, -4.1]} to={[lampX, 2.4, -3.2]} />
      <group position={head} quaternion={beam.rotation}>
        <mesh>
          <cylinderGeometry args={[.2, .47, .45, 48, 1, true]} />
          <meshStandardMaterial color="#363029" metalness={.65} roughness={.36} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -.225, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[.446, 48]} />
          <meshBasicMaterial color="#ffe2b0" side={DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={shaft} position={beam.center} name="Desk / feathered light" renderOrder={1}>
        <planeGeometry args={[5.3, beam.length]} />
        <shaderMaterial vertexShader={beamVertex} fragmentShader={beamFragment} uniforms={beamUniforms} transparent depthWrite={false} depthTest={false} side={DoubleSide} />
      </mesh>
      <mesh position={[lampX + .3, .006, -3.95]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, .65, 1]}>
        <planeGeometry args={[1.5, 1.5]} />
        <shaderMaterial vertexShader={beamVertex} fragmentShader={contactFragment} transparent depthWrite={false} />
      </mesh>
    </group>
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
    <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ fov: 42, near: .1, far: 60, position: [0, 11, .35] }}
      gl={{ antialias: true, alpha: false, powerPreference: "low-power" }}>
      <DeskWorld {...props} />
    </Canvas>
  </div>;
}
