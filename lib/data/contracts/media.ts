import { z } from "zod";
import { auraIdSchema, type AuraId as CreativeAuraId } from "@/lib/creative/ids";
import {
  analysisModeSchema,
  mediaAnalysisStatusSchema,
  mediaIntelligenceSchema,
  technicalSignalsSchema,
} from "@/lib/media-intelligence/contracts";

export { auraIdSchema };

export const mediaSourceSchema = z.enum(["contributor", "owner"]);

export const mediaSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  submissionId: z.string().min(1).nullable().default(null),
  type: z.enum(["photo", "video"]),
  storageObjectKey: z.string().min(1),
  originalFileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  message: z.string().nullable(),
  contributorName: z.string().nullable(),
  source: mediaSourceSchema.default("contributor"),
  uploaderUid: z.string().min(1).nullable().default(null),
  submittedAt: z.string().datetime(),
  durationSec: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  analysisStatus: mediaAnalysisStatusSchema.default("not_started"),
  analysisVersion: z.string().min(1).nullable().default(null),
  analysisMode: analysisModeSchema.nullable().default(null),
  analysisUpdatedAt: z.string().datetime().nullable().default(null),
  needsDeepAnalysis: z.boolean().default(false),
  analysisFailureCode: z.string().min(1).nullable().default(null),
  technicalSignals: technicalSignalsSchema.nullable().default(null),
  mediaIntelligence: mediaIntelligenceSchema.nullable().default(null),
});

export const normalizedCropSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().positive().max(100),
  height: z.number().positive().max(100),
});

export const mediaInstanceSchema = z.object({
  mediaId: z.string().min(1),
  order: z.number().int().nonnegative(),
  isSpotlight: z.boolean(),
  crop: normalizedCropSchema.optional(),
  trimIn: z.number().nonnegative().optional(),
  trimOut: z.number().nonnegative().optional(),
  loop: z.boolean(),
  auraId: auraIdSchema.nullable(),
});

export type AuraId = CreativeAuraId;
export type MediaSource = z.infer<typeof mediaSourceSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type MediaInstance = z.infer<typeof mediaInstanceSchema>;
