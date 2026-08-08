import { z } from "zod";
import { mediaInstanceSchema, mediaSchema } from "./media";
import { themeSchema } from "./theme";

export const receiverManifestSchema = z.object({
  version: z.number().int().positive(),
  bakedAt: z.string().datetime(),
  room: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    recipientName: z.string().min(1),
    themeId: z.string().min(1),
  }),
  theme: themeSchema,
  mediaInstances: z.array(mediaInstanceSchema),
  mediaById: z.record(z.string(), mediaSchema),
  songUrl: z.string(),
  beatmap: z.array(z.number().nonnegative()),
  transitionStyle: z.string().min(1),
  effectIntensity: z.enum(["low", "medium", "high"]),
});

export const scrollFocusStateSchema = z.object({
  activeIndex: z.number().int().nonnegative(),
  focusProgress: z.number().min(0).max(1),
  direction: z.enum(["up", "down", "idle"]),
  velocity: z.number(),
});

export type ReceiverManifest = z.infer<typeof receiverManifestSchema>;
export type ScrollFocusState = z.infer<typeof scrollFocusStateSchema>;
