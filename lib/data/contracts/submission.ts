import { z } from "zod";
import {
  analysisModeSchema,
  mediaAnalysisStatusSchema,
  mediaIntelligenceSchema,
  technicalSignalsSchema,
} from "@/lib/media-intelligence/contracts";

export const submissionStatusSchema = z.enum([
  "new",
  "approved",
  "excluded",
]);

export const submissionSourceSchema = z.enum(["contributor", "owner"]);

// Freeze a decision before touching B2. Retries may resume the same decision,
// but another tab cannot start deleting files selected by the first request.
export const submissionModerationSchema = z.object({
  action: z.enum(["approve", "exclude", "delete"]),
  acceptedMediaIds: z.array(z.string().min(1)).max(100),
});
export type SubmissionModeration = z.infer<typeof submissionModerationSchema>;

export const stagedSubmissionMediaSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["photo", "video"]),
  storageObjectKey: z.string().min(1),
  originalFileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  analysisStatus: mediaAnalysisStatusSchema.default("not_started"),
  analysisVersion: z.string().min(1).nullable().default(null),
  analysisMode: analysisModeSchema.nullable().default(null),
  analysisUpdatedAt: z.string().datetime().nullable().default(null),
  needsDeepAnalysis: z.boolean().default(false),
  analysisFailureCode: z.string().min(1).nullable().default(null),
  technicalSignals: technicalSignalsSchema.nullable().default(null),
  mediaIntelligence: mediaIntelligenceSchema.nullable().default(null),
});

export const submissionSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  mediaIds: z.array(z.string().min(1)).default([]),
  stagedMedia: z.array(stagedSubmissionMediaSchema).default([]),
  message: z.string().nullable(),
  contributorName: z.string().nullable(),
  source: submissionSourceSchema.default("contributor"),
  status: submissionStatusSchema,
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
  moderation: submissionModerationSchema.nullable().optional(),
});

export type StagedSubmissionMedia = z.infer<typeof stagedSubmissionMediaSchema>;
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
export type SubmissionSource = z.infer<typeof submissionSourceSchema>;
export type Submission = z.infer<typeof submissionSchema>;
