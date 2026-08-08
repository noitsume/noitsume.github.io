import { z } from "zod";

export const auraIdSchema = z.enum([
  "neutral",
  "soft",
  "pulse",
  "lightning",
  "particles",
  "cinematic",
]);

export const mediaSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  type: z.enum(["photo", "video"]),
  url: z.string().min(1),
  message: z.string().nullable(),
  contributorName: z.string().nullable(),
  submittedAt: z.string().datetime(),
  durationSec: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
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

export type AuraId = z.infer<typeof auraIdSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type MediaInstance = z.infer<typeof mediaInstanceSchema>;
