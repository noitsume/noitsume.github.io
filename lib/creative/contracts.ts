import { z } from "zod";
import {
  auraIdSchema,
  roomMusicIdSchema,
  songIdSchema,
  themeIdSchema,
  transitionIdSchema,
} from "./ids";

export const creativeAssetReferenceSchema = z.discriminatedUnion("source", [
  z.object({
    id: z.string().min(1),
    source: z.literal("public"),
    publicPath: z.string().startsWith("/"),
    contentType: z.string().min(1),
  }),
  z.object({
    id: z.string().min(1),
    source: z.literal("b2"),
    storageObjectKey: z.string().min(1),
    contentType: z.string().min(1),
  }),
]);

export const motionPersonalitySchema = z.enum([
  "gentle",
  "floating",
  "cinematic",
  "playful",
  "energetic",
]);

export const themePersonalitySchema = z.enum([
  "warm",
  "nostalgic",
  "intimate",
  "elegant",
  "cinematic",
  "celebratory",
  "joyful",
  "playful",
  "handmade",
  "soft",
  "hopeful",
  "proud",
]);

export const auraFamilySchema = z.enum(["neutral", "transform", "overlay"]);
export const auraDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: auraIdSchema,
  name: z.string().min(1),
  family: auraFamilySchema,
  description: z.string().min(1),
  intensityRange: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  motionCharacter: z.enum(["none", "subtle", "expressive", "energetic"]),
  compatibleThemes: z.array(themeIdSchema).min(1),
  reducedMotionBehavior: z.enum(["disable", "reduce", "static-overlay", "fade-only"]),
  rendererKey: z.enum([
    "neutral",
    "floating",
    "breath",
    "tilt",
    "zoom-pulse",
    "particles",
    "soft-ray",
    "flare",
    "bokeh",
  ]),
});

export const transitionDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: transitionIdSchema,
  name: z.string().min(1),
  character: z.enum(["soft", "nostalgic", "cinematic", "rhythmic"]),
  intensity: z.enum(["low", "medium", "high"]),
  durationRangeMs: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  compatibleThemes: z.array(themeIdSchema).min(1),
  compatibleMotionPersonalities: z.array(motionPersonalitySchema).min(1),
  reducedMotionFallbackId: transitionIdSchema.nullable(),
  rendererKey: transitionIdSchema,
});

export const songSectionRangeSchema = z.tuple([
  z.number().nonnegative(),
  z.number().nonnegative(),
]);

export const songBeatmapSchema = z.object({
  schemaVersion: z.literal(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  durationSec: z.number().positive(),
  bpm: z.number().positive(),
  beats: z.array(z.number().nonnegative()),
  onsets: z.array(z.number().nonnegative()),
  energyCurve: z.array(z.number().min(0).max(1)).min(2),
  sections: z.object({
    intro: songSectionRangeSchema,
    build: songSectionRangeSchema,
    peak: songSectionRangeSchema,
    outro: songSectionRangeSchema,
  }),
});

export const songDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: songIdSchema,
  name: z.string().min(1),
  artist: z.string().min(1),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  track: creativeAssetReferenceSchema,
  beatmap: creativeAssetReferenceSchema,
  durationSec: z.number().positive(),
  bpm: z.number().positive(),
  mood: z.array(z.string().min(1)).min(1),
  compatibleThemes: z.array(themeIdSchema).min(1),
  sections: z.object({
    intro: songSectionRangeSchema,
    build: songSectionRangeSchema,
    peak: songSectionRangeSchema,
    outro: songSectionRangeSchema,
  }),
});


export const roomMusicAnalysisSchema = z.object({
  status: z.enum(["pending", "ready", "fallback"]),
  version: z.literal("music-v1").nullable(),
  failureCode: z.enum(["decode_failed", "analysis_failed"]).nullable(),
  hash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  durationSec: z.number().positive().nullable(),
  bpm: z.number().positive().nullable(),
  beats: z.array(z.number().nonnegative()),
  onsets: z.array(z.number().nonnegative()),
  energyCurve: z.array(z.number().min(0).max(1)),
  mood: z.array(z.string().min(1)),
  sections: z.object({
    intro: songSectionRangeSchema.nullable(),
    build: songSectionRangeSchema.nullable(),
    peak: songSectionRangeSchema.nullable(),
    outro: songSectionRangeSchema.nullable(),
  }),
});

export const roomMusicSchema = z.object({
  schemaVersion: z.literal(1),
  id: roomMusicIdSchema,
  roomId: z.string().min(1),
  name: z.string().min(1),
  originalFileName: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  track: creativeAssetReferenceSchema.refine(
    (asset) => asset.source === "b2" && asset.contentType.startsWith("audio/"),
    "Room-uploaded music must reference a B2 audio asset.",
  ),
  beatmap: creativeAssetReferenceSchema.nullable(),
  analysis: roomMusicAnalysisSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const backgroundMusicSelectionSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("catalog"),
    songId: songIdSchema,
  }),
  z.object({
    source: z.literal("room-upload"),
    musicId: roomMusicIdSchema,
  }),
]);

export const backgroundMusicMixPolicySchema = z.object({
  playbackMode: z.literal("continuous"),
  normalGain: z.number().min(0).max(1),
  duckedGain: z.number().min(0).max(1),
  duckAttackMs: z.number().int().nonnegative(),
  duckReleaseMs: z.number().int().nonnegative(),
  maxBackgroundRelativeDb: z.number().max(0),
  preservePlaybackPosition: z.literal(true),
  preserveBeatTimeline: z.literal(true),
});

export const defaultBackgroundMusicMixPolicy = backgroundMusicMixPolicySchema.parse({
  playbackMode: "continuous",
  normalGain: 0.72,
  duckedGain: 0.22,
  duckAttackMs: 320,
  duckReleaseMs: 720,
  maxBackgroundRelativeDb: -8,
  preservePlaybackPosition: true,
  preserveBeatTimeline: true,
});

export const sectionAudioMixInstructionSchema = z.object({
  mode: z.enum(["music-full", "auto-duck", "music-muted"]),
});

export const creativeSelectionSchema = z.object({
  themeId: themeIdSchema,
  backgroundMusic: backgroundMusicSelectionSchema,
  auraIds: z.array(auraIdSchema),
  transitionIds: z.array(transitionIdSchema),
});

export type CreativeAssetReference = z.infer<typeof creativeAssetReferenceSchema>;
export type MotionPersonality = z.infer<typeof motionPersonalitySchema>;
export type ThemePersonality = z.infer<typeof themePersonalitySchema>;
export type AuraDefinition = z.infer<typeof auraDefinitionSchema>;
export type TransitionDefinition = z.infer<typeof transitionDefinitionSchema>;
export type SongBeatmap = z.infer<typeof songBeatmapSchema>;
export type SongDefinition = z.infer<typeof songDefinitionSchema>;
export type RoomMusic = z.infer<typeof roomMusicSchema>;
export type BackgroundMusicSelection = z.infer<typeof backgroundMusicSelectionSchema>;
export type BackgroundMusicMixPolicy = z.infer<typeof backgroundMusicMixPolicySchema>;
export type SectionAudioMixInstruction = z.infer<typeof sectionAudioMixInstructionSchema>;
export type CreativeSelection = z.infer<typeof creativeSelectionSchema>;
