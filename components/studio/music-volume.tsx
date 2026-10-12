"use client";

import { useId } from "react";

export function MusicVolume({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  const id = useId();
  const percent = Math.round(value * 100);
  return <div className="story-music-volume">
    <label htmlFor={id}>{label}</label><output htmlFor={id}>{percent === 0 ? "Senyap" : `${percent}%`}</output>
    <input id={id} type="range" min={0} max={100} step={1} value={percent} aria-valuetext={percent === 0 ? "Senyap" : `${percent} persen`}
      onChange={event => onChange(Number(event.target.value) / 100)} />
  </div>;
}
