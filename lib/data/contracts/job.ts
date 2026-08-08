import { z } from "zod";

export const bakeJobSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  type: z.enum([
    "audio_analysis",
    "video_metadata",
    "thumbnail",
    "asset_validation",
  ]),
  status: z.enum(["queued", "processing", "completed", "failed"]),
  progress: z.number().min(0).max(100),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  error: z.string().nullable(),
});

export type BakeJob = z.infer<typeof bakeJobSchema>;
