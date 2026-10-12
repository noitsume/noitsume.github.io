"use client";

import { Component, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Color, ShaderMaterial, Vector3, Vector4 } from "three";
import { gsap } from "gsap";
import { scenePose, type AuraSignals } from "@/lib/receiver/aura-state";
import type { SceneAtmosphere } from "@/lib/studio/contracts";

type World = NonNullable<SceneAtmosphere["world"]>;
type Props = {
  root: RefObject<HTMLElement | null>; signals: RefObject<AuraSignals>;
  motion: boolean; playing: boolean; opened: boolean; index: number;
  reading: boolean; emphasis: boolean; intensity: number; background: boolean;
  primary: string; accent: string; world: World; backgroundWorld: World; sharpAccents: boolean;
};
const worldId = (world: World) => ({ rain: 0, flow: 1, spectrum: 2, light: 3, resonance: 4 })[world];
const vertex = "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}";
const fragment = `
precision highp float;
varying vec2 vUv;
uniform float uAspect,uOpen,uSpread,uTurn,uBackTime,uFrontTime,uBackWorld,uFrontWorld,uEnvironment,uFrontVisible,uBackVisible,uSharp;
uniform vec4 uBack,uFront;
uniform vec3 uPrimary,uColor;
uniform vec3 uBackEvents[6],uFrontEvents[6];
uniform float uBackSpectrum[16],uFrontSpectrum[16];
float hash(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
float ring(vec2 p,vec2 c,float radius,float width){return exp(-abs(length(p-c)-radius)/width);}
vec3 family(vec2 p,float t,vec4 signal,float world,bool front){
  vec3 color=vec3(0.0);
  float border=smoothstep(.18,.54,abs(p.x)/max(uAspect,.7));
  float space=front ? smoothstep(.13,.42,length(p/vec2(max(uAspect*.65,.65),.85))) : .45+.55*border;
  // Persistent soft points: positions are derived from media time, not a wall clock.
  for(int i=0;i<22;i++){
    float f=float(i), seed=hash(f+8.0);
    vec2 c=vec2((hash(f+29.0)-.5)*uAspect*1.2,(hash(f+70.0)-.5)*1.1);
    c+=vec2(sin(t*.09+seed*19.0),cos(t*.07+seed*23.0))*(.018+signal.x*.025);
    float r=.002+seed*seed*.012, d=length(p-c);
    float point=exp(-d*d/(r*r))*.45+exp(-d*d/(r*r*24.0))*.055;
    color+=mix(uPrimary,uColor,seed)*point*(.35+signal.x*.65)*space;
  }
  if(world<.5){
    for(int i=0;i<6;i++){
      vec3 event=front ? uFrontEvents[i] : uBackEvents[i];
      float age=t-event.x;
      float valid=step(0.0,age)*(1.0-step(3.0,age))*event.y;
      vec2 center=vec2((hash(event.z+18.0)-.5)*uAspect*.98,(hash(event.z+31.0)-.5)*.85);
      if(front) center.x=sign(center.x)*(.21*uAspect+abs(center.x)*.36);
      float radius=.014+age*(.10+event.y*.1);
      float wave=ring(p,center,radius,.0016+age*.002)*exp(-age*1.1);
      wave+=ring(p,center,radius*.72,.002)*exp(-age*1.6)*.28;
      float drop=exp(-length(p-center)*100.0)*exp(-age*8.0);
      color+=mix(uPrimary,uColor,hash(event.z))*valid*(wave*.38+drop*.32)*space;
    }
  }else if(world<1.5){
    for(int i=0;i<5;i++){
      float f=float(i), y=sin(p.x*2.6+t*.16+f*.8)*(.12+signal.y*.1)+(f-2.0)*.12;
      float ribbon=exp(-abs(p.y-y)*(85.0-f*10.0));
      color+=mix(uPrimary,uColor,f/4.0)*ribbon*(.028+signal.x*.07+signal.w*.06)*space;
    }
    for(int i=0;i<16;i++){
      float f=float(i), speed=.018+hash(f)*.024;
      vec2 c=vec2((hash(f+82.0)-.5)*uAspect,fract(hash(f+1.0)+t*speed)-.5);
      c.x+=sin(c.y*5.0+t*.3+f)*.09;
      float dust=exp(-length(p-c)*180.0);
      color+=uColor*dust*(.15+signal.z*.2+signal.w*.3)*space;
    }
  }else if(world<2.5){
    float angle=atan(p.y,p.x), radius=length(p);
    for(int i=0;i<16;i++){
      float f=float(i), band=front ? uFrontSpectrum[i] : uBackSpectrum[i];
      float r=.16+f*.022+sin(angle*3.0+t*.12+f*.5)*(.008+band*.028);
      float line=exp(-abs(radius-r)*300.0);
      color+=mix(uPrimary,uColor,f/15.0)*line*(.028+band*.1+signal.w*.045)*space;
    }
  }else{
    for(int i=0;i<5;i++){
      float f=float(i), side=mod(f,2.0)*2.0-1.0;
      float center=side*(.13+uOpen*(.24+f*.09+uSpread*.16))*sqrt(max(0.0,1.0-p.y*p.y*.48));
      if(world>3.5) center=side*(.27+f*.1)+(abs(p.y+.1)-.2)*.5;
      center+=sin(p.y*2.4+t*.12+f*.8)*.025+uTurn*p.y;
      color+=mix(uPrimary,uColor,f/4.0)*exp(-abs(p.x-center)*60.0)*(.06+signal.x*.12);
    }
  }
  return color;
}
void main(){
  vec2 p=vUv-.5; p.x*=uAspect;
  vec3 color=vec3(.021,.030,.038);
  float pools=exp(-length(p-vec2(-uAspect*.32,.1))*3.8);
  color+=uPrimary*pools*.13+uColor*exp(-length(p-vec2(uAspect*.32,-.26))*4.0)*.085;
  color+=family(p,uBackTime,uBack,uBackWorld,false)*uEnvironment*(.4+.6*uBackVisible);
  color+=family(p,uFrontTime,uFront,uFrontWorld,true)*uFrontVisible;
  // Local edge accent only; no global exposure jump. Events are >=550ms apart.
  float localEdge=exp(-abs(abs(p.x)-uAspect*.28)*150.0)*exp(-p.y*p.y*12.0);
  color+=uColor*localEdge*uSharp*.12;
  color*=.68+.32*(1.0-smoothstep(.3,.85,length(vUv-.5)));
  gl_FragColor=vec4(color,1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

class CanvasBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
function MusicalRoom(props: Props & { visible: boolean }) {
  const material = useRef<ShaderMaterial>(null);
  const pose = useRef({ ...scenePose(0, false, false) });
  const { invalidate, gl, scene, camera } = useThree();
  const uniforms = useMemo(() => ({
    uAspect:{value:1},uOpen:{value:0},uSpread:{value:0},uTurn:{value:0},uBackTime:{value:0},uFrontTime:{value:0},
    uBackWorld:{value:0},uFrontWorld:{value:0},uEnvironment:{value:1},uFrontVisible:{value:0},uBackVisible:{value:0},uSharp:{value:0},
    uBack:{value:new Vector4()},uFront:{value:new Vector4()},uPrimary:{value:new Color()},uColor:{value:new Color()},
    uBackEvents:{value:Array.from({length:6},()=>new Vector3(-100,0,0))},uFrontEvents:{value:Array.from({length:6},()=>new Vector3(-100,0,0))},
    uBackSpectrum:{value:new Float32Array(16)},uFrontSpectrum:{value:new Float32Array(16)},
  }),[]);
  useEffect(() => {
    const target = scenePose(props.index,props.reading,props.opened);
    const tween = gsap.to(pose.current,{...target,duration:props.motion && props.visible ? .9 : 0,ease:"power3.out",onUpdate:invalidate});
    return () => { tween.kill(); };
  },[props.index,props.reading,props.opened,props.motion,props.visible,invalidate]);
  useEffect(() => { invalidate(); },[props.playing,invalidate]);
  useEffect(() => {
    if(process.env.NODE_ENV!=="development") return;
    const expose=()=>window.dispatchEvent(new CustomEvent("kenangin:three-context",{detail:{scene,renderer:gl,camera}}));
    window.addEventListener("kenangin:inspect-three",expose);
    return ()=>window.removeEventListener("kenangin:inspect-three",expose);
  },[scene,gl,camera]);
  useFrame(state => {
    if(!material.current)return;
    props.signals.current.sample?.(performance.now());
    const u=material.current.uniforms;
    u.uAspect.value=state.size.width/Math.max(1,state.size.height);
    u.uOpen.value=pose.current.opening;u.uSpread.value=pose.current.spread;u.uTurn.value=pose.current.turn;
    props.root.current?.style.setProperty("--aura-open",String(pose.current.opening));
    u.uPrimary.value.set(props.primary);u.uColor.value.set(props.accent);
    u.uBackWorld.value=worldId(props.backgroundWorld);u.uFrontWorld.value=worldId(props.world);u.uEnvironment.value=props.background?1:0;
    const {front,back}=props.signals.current;
    for(const [name,frame] of [["Front",front],["Back",back]] as const){
      if(!frame)continue;
      // The two transport clocks stop independently. No elapsedTime accumulator.
      u[`u${name}Time`].value=frame.time;
      const gain=props.reading ? .55 : 1;
      u[`u${name}`].value.set(frame.energy*gain,frame.low*gain,frame.high*gain,frame.impact*gain);
      // Pausing holds the same composition instead of erasing a layer.
      u[`u${name}Visible`].value=frame.active||frame.eventTime>=0||frame.energy>0?1:0;
      u[`u${name}Spectrum`].value.set(frame.spectrum);
      for(let i=0;i<6;i++){const e=frame.echoes[i];u[`u${name}Events`].value[i].set(e?.[0]??-100,(e?.[1]??0)*gain,e?.[2]??0);}
    }
    u.uSharp.value=props.sharpAccents&&props.motion&&front?.active ? front.accent : 0;
  });
  return <mesh name="Aura / Two musical depths" frustumCulled={false}><planeGeometry args={[2,2]}/><shaderMaterial ref={material} name="Aura / Rintik Resonansi v2" uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} depthTest={false} depthWrite={false}/></mesh>;
}
export default function AuraEnvironment(props:Props){
  const [visible,setVisible]=useState(true),[lost,setLost]=useState(false);
  const host=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const update=()=>setVisible(document.visibilityState==="visible");
    update();document.addEventListener("visibilitychange",update);
    const element=host.current;
    const contextLost=()=>{props.root.current?.style.setProperty("--aura-open","1");setLost(true);};
    element?.addEventListener("webglcontextlost",contextLost,true);
    return()=>{document.removeEventListener("visibilitychange",update);element?.removeEventListener("webglcontextlost",contextLost,true);};
  },[props.root]);
  return <div ref={host} className="aura-environment" aria-hidden="true" data-renderer={lost?"static":"webgl"}>
    <div className="aura-static-room"/>
    {!lost&&<CanvasBoundary onFailure={()=>{props.root.current?.style.setProperty("--aura-open","1");setLost(true);}}><Canvas dpr={[1,1.5]} frameloop={props.motion&&props.playing&&visible?"always":"demand"} gl={{antialias:false,alpha:false,powerPreference:"low-power"}}><MusicalRoom {...props} visible={visible}/></Canvas></CanvasBoundary>}
  </div>;
}

