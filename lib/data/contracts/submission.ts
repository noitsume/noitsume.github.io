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
});

export type StagedSubmissionMedia = z.infer<typeof stagedSubmissionMediaSchema>;
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
export type SubmissionSource = z.infer<typeof submissionSourceSchema>;
export type Submission = z.infer<typeof submissionSchema>;
