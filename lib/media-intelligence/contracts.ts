import { z } from "zod";

export const MEDIA_INTELLIGENCE_VERSION = "mi-v1";

const normalizedScoreSchema = z.number().finite().min(0).max(1);

export const mediaOrientationSchema = z.enum(["portrait", "landscape", "square", "unknown"]);
export const audioPresenceSchema = z.enum(["present", "absent", "unknown"]);
export const analysisModeSchema = z.enum(["quick_look", "deep"]);

const canonicalAnalysisStatusSchema = z.enum(["not_started", "processing", "ready", "fallback"]);
export const mediaAnalysisStatusSchema = z.preprocess((value) => {
  if (value === "pending") return "not_started";
  if (value === "complete") return "ready";
  return value;
}, canonicalAnalysisStatusSchema);

export const technicalSignalsSchema = z.object({
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSec: z.number().finite().nonnegative().nullable(),
  orientation: mediaOrientationSchema,
  aspectRatio: z.number().finite().positive().nullable(),
  brightness: normalizedScoreSchema.nullable(),
  motion: normalizedScoreSchema.nullable(),
  audioPresence: audioPresenceSchema,
  audioEnergy: normalizedScoreSchema.nullable(),
  sampleTimestampsSec: z.array(z.number().finite().nonnegative()).max(12),
  fileSizeBytes: z.number().int().nonnegative(),
  preprocess: z.object({
    durationMs: z.number().int().nonnegative(),
    visualProxyBytes: z.number().int().nonnegative(),
    audioProxyBytes: z.number().int().nonnegative(),
    audioProxyMethod: z.enum(["none", "web-audio"]),
    audioProxyStatus: z.enum(["not_requested", "ready", "unsupported", "failed", "skipped_budget"]),
  }),
});

export const emotionalFingerprintSchema = z.object({
  energy: normalizedScoreSchema,
  emotionalWeight: normalizedScoreSchema,
  warmth: normalizedScoreSchema,
  nostalgia: normalizedScoreSchema,
  humor: normalizedScoreSchema,
  intimacy: normalizedScoreSchema,
  celebration: normalizedScoreSchema,
  tenderness: normalizedScoreSchema,
});

export const mediaStoryRoleSchema = z.enum([
  "opening",
  "memory",
  "bridge",
  "comic_relief",
  "buildup",
  "emotional_peak",
  "celebration",
  "resolution",
  "closing",
  "ambient_only",
]);

export const mediaIntelligenceSchema = z.object({
  scene: z.string().trim().min(1).max(700),
  socialContext: z.string().trim().min(1).max(500),
  emotionalFingerprint: emotionalFingerprintSchema,
  audio: z.object({
    speechPresent: z.boolean().nullable(),
    transcript: z.string().trim().max(1600).nullable(),
    summary: z.string().trim().max(700).nullable(),
    events: z.array(z.enum(["speech", "laughter", "cheering", "applause", "music", "silence", "other"])).max(8),
    emotionalTone: z.array(z.enum(["joyful", "playful", "tender", "nostalgic", "emotional", "energetic", "calm", "neutral"])).max(5),
  }),
  interestingMoments: z.array(z.object({
    timestampSec: z.number().finite().nonnegative().nullable(),
    label: z.string().trim().min(1).max(160),
    confidence: normalizedScoreSchema,
  })).max(8),
  suggestedRoles: z.array(mediaStoryRoleSchema).min(1).max(5),
  confidence: normalizedScoreSchema,
  ambiguityReason: z.string().trim().max(500).nullable(),
});

export const mediaAnalysisRecordSchema = z.object({
  status: mediaAnalysisStatusSchema,
  version: z.string().min(1).nullable(),
  mode: analysisModeSchema.nullable(),
  updatedAt: z.string().datetime().nullable(),
  needsDeepAnalysis: z.boolean(),
  failureCode: z.enum(["gemini_unavailable", "gemini_timeout", "invalid_output", "proxy_missing", "preprocess_failed"]).nullable(),
});

export const visualProxySchema = z.object({
  mimeType: z.literal("image/jpeg"),
  dataBase64: z.string().min(16).max(750_000),
  timestampSec: z.number().finite().nonnegative().nullable(),
});

export const audioProxySchema = z.object({
  mimeType: z.literal("audio/wav"),
  dataBase64: z.string().min(16).max(1_200_000),
  durationSec: z.number().finite().positive().max(35),
});

export const mediaAnalysisInputSchema = z.object({
  mode: analysisModeSchema.default("quick_look"),
  technicalSignals: technicalSignalsSchema,
  visualProxies: z.array(visualProxySchema).min(1).max(8),
  audioProxy: audioProxySchema.nullable().default(null),
}).superRefine((value, context) => {
  const base64Chars = value.visualProxies.reduce((sum, item) => sum + item.dataBase64.length, 0)
    + (value.audioProxy?.dataBase64.length ?? 0);
  if (base64Chars > 2_600_000) {
    context.addIssue({ code: "custom", message: "Analysis proxy terlalu besar." });
  }
});

export const mediaAnalysisResultSchema = z.object({
  analysis: mediaAnalysisRecordSchema,
  technicalSignals: technicalSignalsSchema,
  mediaIntelligence: mediaIntelligenceSchema.nullable(),
});

export type AnalysisMode = z.infer<typeof analysisModeSchema>;
export type MediaAnalysisStatus = z.infer<typeof mediaAnalysisStatusSchema>;
export type TechnicalSignals = z.infer<typeof technicalSignalsSchema>;
export type MediaIntelligence = z.infer<typeof mediaIntelligenceSchema>;
export type MediaAnalysisRecord = z.infer<typeof mediaAnalysisRecordSchema>;
export type MediaAnalysisInput = z.infer<typeof mediaAnalysisInputSchema>;
export type MediaAnalysisResult = z.infer<typeof mediaAnalysisResultSchema>;
