import { z } from "zod";

export const THEME_IDS = [
  "theme_warm_memory",
  "theme_midnight_bloom",
  "theme_golden_celebration",
  "theme_paper_daydream",
  "theme_starlit_graduation",
] as const;

export const AURA_IDS = [
  "neutral",
  "memory-drift",
  "gentle-breath",
  "cinematic-tilt",
  "zoom-pulse",
  "celebration-particles",
  "soft-rays",
  "warm-flare",
  "gentle-bokeh",
] as const;

export const TRANSITION_IDS = [
  "soft-reveal",
  "memory-blur",
  "depth-push",
  "beat-cut",
] as const;

export const SONG_IDS = [
  "song_afterglow",
  "song_rise_together",
  "song_soft_horizon",
] as const;

export const themeIdSchema = z.enum(THEME_IDS);
export const auraIdSchema = z.enum(AURA_IDS);
export const transitionIdSchema = z.enum(TRANSITION_IDS);
export const songIdSchema = z.enum(SONG_IDS);
export const roomMusicIdSchema = z.string().regex(/^room_music_[A-Za-z0-9_-]{8,}$/);

export type ThemeId = z.infer<typeof themeIdSchema>;
export type AuraId = z.infer<typeof auraIdSchema>;
export type TransitionId = z.infer<typeof transitionIdSchema>;
export type SongId = z.infer<typeof songIdSchema>;
export type RoomMusicId = z.infer<typeof roomMusicIdSchema>;
