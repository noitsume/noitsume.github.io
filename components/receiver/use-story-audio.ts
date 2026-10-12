"use client";

import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from "react";
import type { BackgroundMusicMixPolicy } from "@/lib/creative";
import { soundtrackGains } from "@/lib/receiver/playback";

function playbackEvents(setPlaying: (playing: boolean) => void, reportError: () => void) {
  const sync = (event: SyntheticEvent<HTMLAudioElement>) => {
    const audio = event.currentTarget;
    setPlaying(!audio.paused && !audio.ended && !audio.seeking && !audio.muted && audio.volume > .001 && audio.readyState >= 3);
  };
  const stop = () => setPlaying(false);
  return {
    onPlaying: sync, onPause: stop, onWaiting: stop, onSeeking: stop,
    onSeeked: sync, onEnded: stop, onVolumeChange: sync,
    onError: () => { stop(); reportError(); },
  };
}

export function useStoryAudio({ backgroundUrl, sectionUrl, sectionId, mix, videoVolume, muteMusic, backgroundVolume = 1, sectionVolume = 1 }: {
  backgroundUrl?: string; sectionUrl?: string; sectionId?: string; mix: BackgroundMusicMixPolicy; videoVolume: number; muteMusic: boolean; backgroundVolume?: number; sectionVolume?: number;
}) {
  const backgroundRef = useRef<HTMLAudioElement>(null);
  const sectionRef = useRef<HTMLAudioElement>(null);
  const graph = useRef<{ context: AudioContext; background: GainNode; section: GainNode } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [sectionPlaying, setSectionPlaying] = useState(false);
  const [backgroundPlaying, setBackgroundPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const gains = soundtrackGains(mix.normalGain, mix.duckedGain, mix.maxBackgroundRelativeDb, videoVolume, sectionPlaying, muteMusic, backgroundVolume, sectionVolume);
  const audible = enabled && (
    Boolean(backgroundUrl && backgroundPlaying && gains.background > .001)
    || Boolean(sectionUrl && sectionPlaying && gains.section > .001)
  );
  const setGain = useCallback((layer: "background" | "section", target: number, seconds = .3) => {
    const audio = layer === "background" ? backgroundRef.current : sectionRef.current;
    const node = graph.current;
    if (node && audio) {
      const gain = node[layer].gain;
      gain.cancelScheduledValues(node.context.currentTime);
      gain.setTargetAtTime(target, node.context.currentTime, Math.max(.01, seconds / 3));
      audio.volume = 1;
    } else if (audio) audio.volume = target;
  }, []);
  const play = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio?.getAttribute("src")) return;
    void audio.play().catch(error => { if (error?.name !== "AbortError") setError(true); });
  }, []);
  function enable() {
    setError(false);
    const background = backgroundRef.current, section = sectionRef.current;
    if (!graph.current && background && section && typeof AudioContext !== "undefined") {
      try {
        const context = new AudioContext();
        const backgroundGain = context.createGain(), sectionGain = context.createGain();
        backgroundGain.gain.value = .0; sectionGain.gain.value = .0;
        context.createMediaElementSource(background).connect(backgroundGain).connect(context.destination);
        context.createMediaElementSource(section).connect(sectionGain).connect(context.destination);
        graph.current = { context, background: backgroundGain, section: sectionGain };
      } catch { /* Native volume remains usable if Web Audio is unavailable. */ }
    }
    void graph.current?.context.resume();
    setEnabled(true); setRetry(value => value + 1);
    // Play the first sources inside the gesture for mobile autoplay policies.
    if (background && backgroundUrl) { if (background.getAttribute("src") !== backgroundUrl) background.src = backgroundUrl; play(background); }
    if (section && sectionUrl) { if (section.getAttribute("src") !== sectionUrl) section.src = sectionUrl; play(section); }
  }
  function pause() { setEnabled(false); backgroundRef.current?.pause(); sectionRef.current?.pause(); }
  useEffect(() => {
    const audio = backgroundRef.current;
    if (!audio) return;
    if (!enabled || !backgroundUrl) { audio.pause(); return; }
    if (audio.getAttribute("src") !== backgroundUrl) audio.src = backgroundUrl;
    play(audio);
  }, [enabled, backgroundUrl, play, retry]);
  useEffect(() => {
    const audio = sectionRef.current;
    if (!audio) return;
    if (!enabled) { audio.pause(); return; }
    let cancelled = false;
    // A short delay avoids starting a track during rapid navigation. Cleanup stops
    // the previous foreground immediately; cancelled sections cannot start later.
    setGain("section", 0, .12);
    const timer = window.setTimeout(() => {
      audio.pause();
      if (cancelled || !sectionUrl) return;
      audio.src = sectionUrl; audio.currentTime = 0; play(audio);
    }, 120);
    return () => { cancelled = true; clearTimeout(timer); audio.pause(); };
  }, [sectionId, sectionUrl, enabled, play, setGain, retry]);
  useEffect(() => {
    const seconds = (videoVolume > 0 || sectionPlaying ? mix.duckAttackMs : mix.duckReleaseMs) / 1000;
    setGain("background", enabled ? gains.background : 0, seconds);
    setGain("section", enabled ? gains.section : 0, seconds);
  }, [mix, videoVolume, sectionPlaying, enabled, setGain, gains.background, gains.section]);
  useEffect(() => {
    const background = backgroundRef.current, section = sectionRef.current;
    const visibility = () => { if (document.visibilityState === "hidden") { backgroundRef.current?.pause(); sectionRef.current?.pause(); setEnabled(false); } };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); background?.pause(); section?.pause(); void graph.current?.context.close(); graph.current = null; };
  }, []);
  return {
    backgroundRef, sectionRef, enabled, audible, sectionPlaying, backgroundPlaying, error, enable, pause, gains,
    backgroundEvents: playbackEvents(setBackgroundPlaying, () => setError(true)),
    sectionEvents: playbackEvents(setSectionPlaying, () => setError(true)),
  };
}
