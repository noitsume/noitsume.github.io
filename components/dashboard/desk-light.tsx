"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, Matrix4, Vector3, type Mesh, type ShaderMaterial } from "three";
import type { DeskAtmosphere } from "@/lib/dashboard/day-cycle";

const vertex = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragment = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uPower;
  void main() {
    float width = mix(1.0, 0.09, vUv.y);
    float r = abs(vUv.x * 2.0 - 1.0) / width;
    float feather = exp(-r * r * 5.0) * (1.0 - smoothstep(.65, 1.0, r));
    float ends = smoothstep(.0, .42, vUv.y) * (1.0 - smoothstep(.88, 1.0, vUv.y));
    gl_FragColor = vec4(uColor, feather * ends * .065 * uPower);
    #include <colorspace_fragment>
  }
`;

/** A feathered shaft aligned with the physical spotlight; no fullscreen bloom pass. */
export function DeskLight({ spread, atmosphere, pose }: { spread: number; atmosphere: RefObject<DeskAtmosphere>; pose: RefObject<{ lamp: number }> }) {
  const shaft = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const frame = useMemo(() => {
    const source = new Vector3(4.5 * spread - .7, 2.29, -1.65), target = new Vector3(.65, .04, .6);
    return { center: source.clone().add(target).multiplyScalar(.5), length: source.distanceTo(target), axis: source.sub(target).normalize(), x: new Vector3(), z: new Vector3(), basis: new Matrix4() };
  }, [spread]);
  const uniforms = useMemo(() => ({ uColor: { value: new Color("#ffd49b") }, uPower: { value: 1 } }), []);
  useFrame(({ camera }) => {
    if (!shaft.current || !material.current) return;
    frame.z.subVectors(camera.position, frame.center).normalize();
    frame.x.crossVectors(frame.axis, frame.z).normalize();
    frame.z.crossVectors(frame.x, frame.axis).normalize();
    shaft.current.quaternion.setFromRotationMatrix(frame.basis.makeBasis(frame.x, frame.axis, frame.z));
    material.current.uniforms.uPower.value = pose.current.lamp * atmosphere.current.night;
  });
  return <mesh ref={shaft} position={frame.center} name="Lamp / suspended light" renderOrder={2}>
    <planeGeometry args={[4, frame.length]} />
    <shaderMaterial ref={material} vertexShader={vertex} fragmentShader={fragment} uniforms={uniforms} transparent depthWrite={false} side={DoubleSide} />
  </mesh>;
}
