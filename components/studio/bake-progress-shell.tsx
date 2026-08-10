"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCsrfToken } from "@/lib/auth/client";
import { Surface } from "@/components/ui";

type BakeStage = "preflight" | "manifest" | "publish" | "complete";

const STAGES: Array<{ id: BakeStage; label: string; at: number }> = [
  { id: "preflight", label: "Preflight", at: 12 },
  { id: "manifest", label: "Build manifest", at: 44 },
  { id: "publish", label: "Publish token", at: 76 },
  { id: "complete", label: "Selesai", at: 100 },
];

export function BakeProgressShell({ roomId }: { roomId: string }) {
  const router = useRouter();
  const startedRef = useRef(false);
  const mountedRef = useRef(false);
  const pulseRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    mountedRef.current = true;

    const stopPulse = () => {
      if (pulseRef.current !== null) {
        window.clearInterval(pulseRef.current);
        pulseRef.current = null;
      }
    };

    stopPulse();
    pulseRef.current = window.setInterval(() => {
      setProgress((current) => Math.min(91, current + (current < 40 ? 4 : current < 72 ? 2 : 0.6)));
    }, 420);

    if (!startedRef.current) {
      startedRef.current = true;
      void (async () => {
        try {
          const csrfToken = await getCsrfToken();
          const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/bake`, {
            method: "POST",
            headers: { "x-csrf-token": csrfToken },
            credentials: "same-origin",
          });
          const payload = await response.json();
          if (!response.ok || !payload?.ok) {
            throw new Error(payload?.error?.message ?? "Bake Receiver gagal.");
          }
          if (!mountedRef.current) return;
          stopPulse();
          setProgress(100);
          window.setTimeout(() => {
            if (mountedRef.current) router.replace(`/rooms/${encodeURIComponent(roomId)}/finish`);
          }, 320);
        } catch (caught) {
          if (!mountedRef.current) return;
          stopPulse();
          setError(caught instanceof Error ? caught.message : "Bake Receiver gagal.");
        }
      })();
    }

    return () => {
      mountedRef.current = false;
      stopPulse();
    };
  }, [attempt, roomId, router]);

  function retry() {
    startedRef.current = false;
    setProgress(8);
    setError(null);
    setAttempt((value) => value + 1);
  }

  const stage: BakeStage = progress >= 100 ? "complete" : progress >= 72 ? "publish" : progress >= 40 ? "manifest" : "preflight";
  const activeIndex = STAGES.findIndex((item) => item.id === stage);

  return (
    <Surface className={`bake-progress-shell ${error ? "is-error" : ""}`} tone="elevated">
      <div className="bake-progress-shell__orb" aria-hidden="true" />
      <p className="ui-eyebrow">BUILDING RECEIVER</p>
      <h1>{error ? "Bake berhenti sebelum publish." : stage === "complete" ? "Receiver siap." : "Kenangin sedang membangun page."}</h1>
      <p>{error ?? "ExperienceDNA divalidasi ulang, asset private diperiksa, snapshot dibangun, lalu revision dipublish secara deterministic."}</p>
      <div className="bake-progress-shell__bar" aria-label={`Bake ${Math.round(progress)}%`}><span style={{ width: `${progress}%` }} /></div>
      <strong className="bake-progress-shell__percent">{Math.round(progress)}%</strong>
      <div className="bake-progress-shell__steps">
        {STAGES.slice(0, 3).map((item, index) => (
          <span className={index <= activeIndex ? "is-active" : ""} key={item.id}><i>{index < activeIndex ? "✓" : index + 1}</i>{item.label}</span>
        ))}
      </div>
      {error ? <button className="ui-button ui-button--primary" onClick={retry} type="button">Coba Bake lagi</button> : null}
      <small>Room: {roomId} · tidak ada MP4 render, queue, atau panggilan Gemini pada tahap ini.</small>
    </Surface>
  );
}
