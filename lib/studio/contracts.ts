import { z } from "zod";
import {
  auraIdSchema,
  backgroundMusicMixPolicySchema,
  backgroundMusicSelectionSchema,
  sectionAudioMixInstructionSchema,
  themeIdSchema,
  transitionIdSchema,
} from "@/lib/creative";
import { mediaStoryRoleSchema } from "@/lib/media-intelligence/contracts";

export const STUDIO_CONFIG_VERSION = 1 as const;
export const EXPERIENCE_DNA_VERSION = 1 as const;
export const EXPERIENCE_DIRECTOR_VERSION = "director-v1" as const;

export const studioMediaSettingSchema = z.object({
  mediaId: z.string().min(1),
  order: z.number().int().nonnegative(),
  volume: z.number().min(0).max(1),
  trimInSec: z.number().finite().nonnegative().nullable(),
  trimOutSec: z.number().finite().nonnegative().nullable(),
  loop: z.boolean(),
  fit: z.enum(["cover", "contain"]),
});

export const studioSectionPlanSchema = z.object({
  id: z.string().regex(/^section_[A-Za-z0-9_-]+$/),
  type: z.enum(["video", "photo-slide"]),
  mediaIds: z.array(z.string().min(1)).min(1),
  order: z.number().int().nonnegative(),
});

export const storyAnchorsSchema = z.object({
  opening: z.array(z.string().min(1)).max(8),
  climax: z.array(z.string().min(1)).max(8),
  ending: z.array(z.string().min(1)).max(8),
});

export const experienceMediaTreatmentSchema = z.object({
  mediaId: z.string().min(1),
  volume: z.number().min(0).max(1),
  trimInSec: z.number().finite().nonnegative().nullable(),
  trimOutSec: z.number().finite().nonnegative().nullable(),
  loop: z.boolean(),
  fit: z.enum(["cover", "contain"]),
});

export const experienceSectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["hero", "video", "photo-slide"]),
  mediaIds: z.array(z.string().min(1)),
  role: mediaStoryRoleSchema.nullable(),
  auraIds: z.array(auraIdSchema).max(2),
  transitionInId: transitionIdSchema,
  transitionOutId: transitionIdSchema.nullable(),
  dwellSeconds: z.number().finite().min(2).max(20),
  intensity: z.number().finite().min(0).max(1),
  beatAlignment: z.enum(["none", "soft", "strong"]),
  audioMix: sectionAudioMixInstructionSchema,
  mediaTreatment: z.array(experienceMediaTreatmentSchema),
  microCopy: z.string().trim().max(180).nullable(),
  wishIds: z.array(z.string().min(1)).max(8),
});

export const experienceDnaSchema = z.object({
  schemaVersion: z.literal(EXPERIENCE_DNA_VERSION),
  id: z.string().regex(/^direction_[A-Za-z0-9_-]{8,}$/),
  directorVersion: z.literal(EXPERIENCE_DIRECTOR_VERSION),
  generationMode: z.enum(["gemini", "fallback"]),
  generatedAt: z.string().datetime(),
  name: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(420),
  direction: z.string().trim().min(1).max(120),
  themeId: themeIdSchema,
  backgroundMusic: backgroundMusicSelectionSchema,
  backgroundMusicMix: backgroundMusicMixPolicySchema,
  storyArc: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  energyCurve: z.array(z.number().min(0).max(1)).min(2).max(24),
  emotionCurve: z.array(z.number().min(0).max(1)).min(2).max(24),
  sections: z.array(experienceSectionSchema).min(2).max(80),
});


export const wishIntelligenceLabelSchema = z.enum([
  "funny",
  "sentimental",
  "intimate",
  "celebratory",
  "reflective",
  "closing-worthy",
]);

export const wishIntelligenceRecordSchema = z.object({
  submissionId: z.string().min(1),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  version: z.literal("wish-v1"),
  mode: z.enum(["gemini", "fallback"]),
  labels: z.array(wishIntelligenceLabelSchema).min(1).max(6),
  emotionalWeight: z.number().finite().min(0).max(1),
  closingWorthiness: z.number().finite().min(0).max(1),
  analyzedAt: z.string().datetime(),
});

export const roomStudioConfigSchema = z.object({
  schemaVersion: z.literal(STUDIO_CONFIG_VERSION),
  selectedMedia: z.array(studioMediaSettingSchema),
  sectionPlan: z.array(studioSectionPlanSchema),
  storyAnchors: storyAnchorsSchema,
  storyAnchorsConfirmed: z.boolean(),
  themeId: themeIdSchema,
  backgroundMusic: backgroundMusicSelectionSchema.nullable(),
  wishIntelligence: z.record(z.string(), wishIntelligenceRecordSchema).default({}),
  directionCandidates: z.array(experienceDnaSchema).max(3),
  selectedDirectionId: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export const studioSettingsRequestSchema = z.object({
  selectedMedia: z.array(studioMediaSettingSchema).min(1).max(100),
  storyAnchors: storyAnchorsSchema,
  storyAnchorsConfirmed: z.boolean(),
  themeId: themeIdSchema,
  backgroundMusic: backgroundMusicSelectionSchema.nullable(),
});

export const selectDirectionRequestSchema = z.object({
  directionId: z.string().min(1),
});

export const roomMusicUploadRequestSchema = z.object({
  name: z.string().trim().min(1).max(100),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.literal("audio/mpeg"),
  sizeBytes: z.number().int().positive().max(30 * 1024 * 1024),
});

export const roomMusicCommitRequestSchema = z.object({
  musicId: z.string().regex(/^room_music_[A-Za-z0-9_-]{8,}$/),
  name: z.string().trim().min(1).max(100),
  fileName: z.string().trim().min(1).max(180),
  contentType: z.literal("audio/mpeg"),
  sizeBytes: z.number().int().positive().max(30 * 1024 * 1024),
  objectKey: z.string().min(1),
});

export const roomMusicAnalysisInputSchema = z.object({
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  durationSec: z.number().finite().positive().max(20 * 60),
  bpm: z.number().finite().min(40).max(240),
  beats: z.array(z.number().finite().nonnegative()).max(5000),
  onsets: z.array(z.number().finite().nonnegative()).max(5000),
  energyCurve: z.array(z.number().finite().min(0).max(1)).min(2).max(600),
  mood: z.array(z.string().trim().min(1).max(40)).min(1).max(6),
  sections: z.object({
    intro: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    build: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    peak: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    outro: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
  }),
});

export const directorGenerateRequestSchema = z.object({
  variantCount: z.number().int().min(1).max(3).default(3),
});

export type StudioMediaSetting = z.infer<typeof studioMediaSettingSchema>;
export type StudioSectionPlan = z.infer<typeof studioSectionPlanSchema>;
export type StoryAnchors = z.infer<typeof storyAnchorsSchema>;
export type ExperienceMediaTreatment = z.infer<typeof experienceMediaTreatmentSchema>;
export type ExperienceSection = z.infer<typeof experienceSectionSchema>;
export type ExperienceDNA = z.infer<typeof experienceDnaSchema>;
export type WishIntelligenceLabel = z.infer<typeof wishIntelligenceLabelSchema>;
export type WishIntelligenceRecord = z.infer<typeof wishIntelligenceRecordSchema>;
export type RoomStudioConfig = z.infer<typeof roomStudioConfigSchema>;
export type StudioSettingsRequest = z.infer<typeof studioSettingsRequestSchema>;
export type RoomMusicAnalysisInput = z.infer<typeof roomMusicAnalysisInputSchema>;
