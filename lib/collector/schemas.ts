import { z } from "zod";
import { mediaAnalysisInputSchema } from "@/lib/media-intelligence/contracts";
import {
  COLLECTOR_MAX_FILES,
  COLLECTOR_MAX_MESSAGE_LENGTH,
  COLLECTOR_MAX_NAME_LENGTH,
  COLLECTOR_MAX_TOTAL_BYTES,
} from "./constants";

const contentTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

function analysisPayloadChars(media: Array<{ analysis?: { visualProxies: Array<{ dataBase64: string }>; audioProxy?: { dataBase64: string } | null } }>) {
  return media.reduce((total, item) => total
    + (item.analysis?.visualProxies.reduce((sum, proxy) => sum + proxy.dataBase64.length, 0) ?? 0)
    + (item.analysis?.audioProxy?.dataBase64.length ?? 0), 0);
}

export const collectorUploadFileSchema = z.object({
  name: z.string().trim().min(1).max(180),
  contentType: contentTypeSchema,
  sizeBytes: z.number().int().positive(),
});

export const collectorUploadUrlsRequestSchema = z
  .object({
    files: z.array(collectorUploadFileSchema).min(1).max(COLLECTOR_MAX_FILES),
  })
  .refine(
    (value) => value.files.reduce((total, file) => total + file.sizeBytes, 0) <= COLLECTOR_MAX_TOTAL_BYTES,
    { message: "Total ukuran file terlalu besar untuk satu submission." },
  );

export const collectorSubmittedMediaSchema = z.object({
  id: z.string().regex(/^media_[a-f0-9]{32}$/),
  objectKey: z.string().min(1),
  originalFileName: z.string().trim().min(1).max(180),
  contentType: contentTypeSchema,
  sizeBytes: z.number().int().positive(),
  type: z.enum(["photo", "video"]),
  analysis: mediaAnalysisInputSchema.optional(),
});

export const collectorSubmitRequestSchema = z
  .object({
    submissionId: z.string().regex(/^submission_[a-f0-9]{32}$/).optional(),
    contributorName: z.string().trim().max(COLLECTOR_MAX_NAME_LENGTH).nullable().optional(),
    message: z.string().trim().max(COLLECTOR_MAX_MESSAGE_LENGTH).nullable().optional(),
    media: z.array(collectorSubmittedMediaSchema).max(COLLECTOR_MAX_FILES).default([]),
  })
  .superRefine((value, context) => {
    if (!value.message?.trim() && value.media.length === 0) {
      context.addIssue({ code: "custom", message: "Tulis pesan atau tambahkan minimal satu media." });
    }
    if (value.media.length > 0 && !value.submissionId) {
      context.addIssue({ code: "custom", path: ["submissionId"], message: "Submission upload tidak valid." });
    }
    if (analysisPayloadChars(value.media) > 4_000_000) {
      context.addIssue({ code: "custom", path: ["media"], message: "Total analysis proxy terlalu besar." });
    }
  });


export const ownerMediaCommitRequestSchema = z.object({
  media: z.array(collectorSubmittedMediaSchema).min(1).max(COLLECTOR_MAX_FILES),
}).superRefine((value, context) => {
  if (analysisPayloadChars(value.media) > 4_000_000) {
    context.addIssue({ code: "custom", path: ["media"], message: "Total analysis proxy terlalu besar." });
  }
});

export const ownerPreviewUrlsRequestSchema = z.object({
  media: z.array(z.object({
    id: z.string().min(1),
    objectKey: z.string().min(1),
  })).min(1).max(100),
});

export const ownerMediaAnalysisRequestSchema = z.object({
  mediaId: z.string().min(1),
  analysis: mediaAnalysisInputSchema,
});

export const ownerSubmissionActionSchema = z.object({
  submissionIds: z.array(z.string().min(1)).min(1).max(100),
  action: z.enum(["approve", "exclude", "delete"]),
});

export type CollectorUploadUrlsRequest = z.infer<typeof collectorUploadUrlsRequestSchema>;
export type CollectorSubmitRequest = z.infer<typeof collectorSubmitRequestSchema>;
export type OwnerMediaCommitRequest = z.infer<typeof ownerMediaCommitRequestSchema>;
export type OwnerPreviewUrlsRequest = z.infer<typeof ownerPreviewUrlsRequestSchema>;
export type OwnerMediaAnalysisRequest = z.infer<typeof ownerMediaAnalysisRequestSchema>;
