"use client";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { audioFeaturesSchema, emptyAuraFrame, selectAccentTimes, type AudioTimeline, type AuraFrame } from "@/lib/audio/features";
import { sampleAuraTransport } from "@/lib/receiver/aura-playback";
import { newAuraSignals } from "@/lib/receiver/aura-state";
import type { ReceiverManifest, ReceiverMusicSnapshot } from "@/lib/data/contracts";
import type { SceneAtmosphere } from "@/lib/studio/contracts";
import { fetchAndCacheResource } from "@/lib/browser-cache/cache";

export type ActiveVideoAudio = { id: string; volume: number; mediaId?: string; video?: HTMLVideoElement };
type Source = { id: string; key: string; asset?: string; duration: number; inline?: ReceiverMusicSnapshot };
function trackSource(track?: ReceiverMusicSnapshot | null): Source | undefined {
  return track ? { id: track.trackAssetId, key: track.beatmapAssetId ?? track.trackAssetId, asset: track.beatmapAssetId ?? undefined, duration: track.durationSec ?? 1, inline: track.beatmapSource === "inline" ? track : undefined } : undefined;
}
function parseTimeline(raw: unknown, duration: number): AudioTimeline {
  const data = raw as { beats?: unknown; onsets?: unknown; energyCurve?: unknown; features?: unknown };
  const times = (v: unknown) => Array.isArray(v) ? v.filter((t): t is number => typeof t === "number" && Number.isFinite(t) && t >= 0 && t <= duration + .05).sort((a, b) => a - b).slice(0, 5000) : [];
  const parsed = audioFeaturesSchema.safeParse(data.features);
  const accentTimes = parsed.success ? selectAccentTimes(parsed.data.events, duration) : [];
  return { beats: times(data.beats), onsets: times(data.onsets), energy: Array.isArray(data.energyCurve) ? data.energyCurve.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1).slice(0, 600) : [], duration, accentTimes, ...(parsed.success ? { features: parsed.data } : {}) };
}

export function useAuraPlayback({ manifest, previewUrls, activeIndex, started, settled, motion, background, section, sharedTrack, video, backgroundPlaying, sectionPlaying, gains, roomAtmosphere, atmosphere, root, renderedByCanvas }: {
  manifest: ReceiverManifest; previewUrls?: Record<string, string>; activeIndex: number; started: boolean; settled: boolean; motion: boolean;
  background: RefObject<HTMLAudioElement | null>; section: RefObject<HTMLAudioElement | null>; sharedTrack: boolean; video: ActiveVideoAudio | null;
  backgroundPlaying: boolean; sectionPlaying: boolean; gains: { background: number; section: number };
  roomAtmosphere: SceneAtmosphere; atmosphere: SceneAtmosphere; root: RefObject<HTMLElement | null>;
  renderedByCanvas: boolean;
}) {
  const signals = useRef(newAuraSignals()), maps = useRef(new Map<string, AudioTimeline>());
  const previousSources = useRef({ front: "", back: "" });
  const current = manifest.experience.sections[activeIndex];
  const back = useMemo(() => trackSource(manifest.music), [manifest.music]);
  const front = useMemo(() => trackSource(current?.music ? manifest.sectionMusic?.[current.music.musicId] : undefined), [current, manifest.sectionMusic]);
  const currentVideo = video?.id === current?.id ? manifest.media.find(m => m.id === video.mediaId) : undefined;
  const videoSource = useMemo<Source | undefined>(() => currentVideo?.audioBeatmapAssetId ? { id: currentVideo.id, key: currentVideo.audioBeatmapAssetId, asset: currentVideo.audioBeatmapAssetId, duration: currentVideo.audioDurationSec ?? currentVideo.durationSec ?? 1 } : undefined, [currentVideo]);
  // The fetch effect is keyed by semantic navigation, never by animation frames.
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const relevant = manifest.experience.sections.slice(activeIndex, activeIndex + 2);
    const sources = [trackSource(manifest.music), ...relevant.map(s => trackSource(s.music ? manifest.sectionMusic?.[s.music.musicId] : undefined)), ...manifest.media.filter(m => relevant.some(s => s.mediaIds.includes(m.id)) && m.audioBeatmapAssetId).map(m => ({ id: m.id, key: m.audioBeatmapAssetId!, asset: m.audioBeatmapAssetId!, duration: m.audioDurationSec ?? m.durationSec ?? 1 }))].filter((s): s is Source => Boolean(s));
    for (const source of sources) {
      if (maps.current.has(source.key)) continue;
      const save = (raw: unknown) => { if (!cancelled && raw && typeof raw === "object") maps.current.set(source.key, parseTimeline(raw, source.duration)); };
      if (source.inline) { save(source.inline); continue; }
      if (!source.asset) continue;
      const descriptor = manifest.assets.find(a => a.id === source.asset);
      const url = previewUrls?.[source.asset] ?? (descriptor?.publicPath || `/api/receiver/${encodeURIComponent(manifest.receiverId)}/assets/${encodeURIComponent(source.asset)}?v=${manifest.revision}`);
      // Private previews must not write media-derived data to persistent browser cache.
      const load = previewUrls ? fetch(url).then(response => ({ response })) : fetchAndCacheResource({ cacheKey: `${manifest.receiverId}/${source.key}`, sourceUrl: url, resourceId: source.key, kind: "beatmap", version: manifest.revision });
      void load.then(async result => { if (!result.response.ok) throw new Error("beatmap"); save(await result.response.json()); }).catch(() => undefined);
    }
    const keep = new Set(sources.map(s => s.key));
    for (const key of maps.current.keys()) if (!keep.has(key)) maps.current.delete(key);
    return () => { cancelled = true; };
  }, [manifest, previewUrls, activeIndex, started]);

  useEffect(() => {
    let raf = 0, lastTick = 0;
    function sample(source: Source | undefined, element: HTMLMediaElement | null | undefined, enabled: boolean, gain: number, settings: SceneAtmosphere, previous: AuraFrame | undefined): AuraFrame {
      return sampleAuraTransport({ timeline: source && maps.current.get(source.key), media: element, enabled, motion, gain, settings, previous });
    }
    const tick = (now: number) => {
      if (document.visibilityState === "visible") {
        const state = signals.current;
        // Video takes precedence even if its analysis is missing; never borrow unrelated section beats.
        // A paused video holds its composition unless audible section music takes over.
        const videoSelected = Boolean(video && settled && video.id === current?.id && (video.volume > 0 || !front));
        const frontKey = `${current?.id}/${videoSelected ? videoSource?.key ?? "video-unavailable" : front?.key ?? "none"}`;
        if (frontKey !== previousSources.current.front) { state.front = emptyAuraFrame(); previousSources.current.front = frontKey; }
        if ((back?.key ?? "") !== previousSources.current.back) { state.back = emptyAuraFrame(); previousSources.current.back = back?.key ?? ""; }
        state.back = sample(back, background.current, started && roomAtmosphere.backgroundAura && backgroundPlaying, gains.background, roomAtmosphere, state.back);
        state.front = videoSelected ? sample(videoSource, video?.video, true, video!.volume, atmosphere, state.front) : sample(front, sharedTrack ? background.current : section.current, started && settled && (sharedTrack ? backgroundPlaying : sectionPlaying), sharedTrack ? gains.background : gains.section, atmosphere, state.front);
        state.foreground = state.front.active ? state.front.impact : 0;
        state.background = state.back.active ? state.back.energy : 0;
        root.current?.style.setProperty("--beat", String(state.foreground));
        root.current?.style.setProperty("--background-signal", String(state.background));
        if (root.current && now - lastTick > 100) {
          lastTick = now;
          root.current.dataset.auraFrontSource = videoSelected ? `video:${video?.mediaId ?? ""}` : front?.id ?? "none";
          root.current.dataset.auraBackSource = back?.id ?? "none";
          root.current.dataset.auraFrontTime = state.front.time.toFixed(3);
          root.current.dataset.auraBackTime = state.back.time.toFixed(3);
          root.current.dataset.auraFrontActive = String(state.front.active);
          root.current.dataset.auraBackActive = String(state.back.active);
        }
      }
      if (!renderedByCanvas && motion && started && (backgroundPlaying || sectionPlaying || settled && video?.volume)) raf = requestAnimationFrame(tick);
    };
    const state = signals.current;
    // WebGL samples immediately before drawing; avoid two independently ordered RAF loops.
    if (renderedByCanvas) state.sample = tick;
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (state.sample === tick) delete state.sample; };
  }, [current?.id, started, settled, motion, background, section, sharedTrack, video, backgroundPlaying, sectionPlaying, gains.background, gains.section, roomAtmosphere, atmosphere, root, back, front, videoSource, renderedByCanvas]);
  return signals;
}
