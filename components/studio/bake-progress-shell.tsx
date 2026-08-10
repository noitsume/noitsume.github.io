"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Surface } from "@/components/ui";

export function BakeProgressShell({ roomId }: { roomId: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <Surface className="bake-progress-shell" tone="elevated">
      <div className="bake-progress-shell__orb" aria-hidden="true" />
      <p className="ui-eyebrow">BUILDING RECEIVER</p>
      <h1>Kenangin sedang membangun page.</h1>
      <p>Direction sudah final. Bake akan memvalidasi ExperienceDNA, media, theme, music, Aura, dan transition sebelum snapshot dipublish.</p>
      <div className="bake-progress-shell__bar" aria-label="Bake sedang berjalan"><span /></div>
      <div className="bake-progress-shell__steps">
        <span className="is-active"><i>1</i>Preflight</span>
        <span><i>2</i>Build manifest</span>
        <span><i>3</i>Publish token</span>
      </div>
      <small>Room: {roomId} · halaman ini refresh otomatis selama status Bake aktif.</small>
    </Surface>
  );
}
