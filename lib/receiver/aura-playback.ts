import { emptyAuraFrame, sampleAudioTimeline, type AudioTimeline, type AuraFrame } from "@/lib/audio/features";
import type { SceneAtmosphere } from "@/lib/studio/contracts";

type MediaClock = Pick<HTMLMediaElement, "currentTime" | "paused" | "muted" | "seeking" | "ended" | "readyState">;

/** Every animated value comes from its own audible media transport. */
export function sampleAuraTransport({ timeline, media, enabled, motion, gain, settings, previous }: {
  timeline?: AudioTimeline; media?: MediaClock | null; enabled: boolean; motion: boolean;
  gain: number; settings: SceneAtmosphere; previous?: AuraFrame;
}): AuraFrame {
  if (!motion || !enabled || !media || media.paused || media.muted || media.seeking || media.ended || media.readyState < 3 || gain <= .001 || !timeline || settings.response === "off") {
    return { ...(previous ?? emptyAuraFrame()), active: false };
  }
  const next = sampleAudioTimeline(timeline, media.currentTime);
  const strength = { calm: .38, balanced: .66, lively: 1 }[settings.intensity] * Math.min(1, gain);
  next.energy *= strength; next.low *= strength; next.mid *= strength; next.high *= strength;
  next.impact *= strength * (settings.response === "energy" ? .35 : 1);
  next.accent *= strength; next.eventStrength *= strength;
  next.echoes = next.echoes.map(([time, amount, seed]) => [time, amount * strength, seed]);
  next.spectrum = next.spectrum.map(value => value * strength);
  return next;
}
