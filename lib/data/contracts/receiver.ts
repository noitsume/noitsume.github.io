import { z } from "zod";
import { themePaletteSchema, themeTypographySchema } from "./theme";
import type { ExperienceDNA } from "@/lib/studio/contracts";

export const RECEIVER_MANIFEST_VERSION = 1 as const;

// Keep the public data-contract layer independent from the Creative Catalog runtime.
// Bake performs the full experienceDnaSchema validation before publication; Receiver
// reads only server-authored snapshots and verifies the versioned envelope here.
const receiverExperienceSnapshotSchema = z.custom<ExperienceDNA>((value) => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { schemaVersion?: unknown; directorVersion?: unknown; sections?: unknown };
  return candidate.schemaVersion === 1
    && candidate.directorVersion === "director-v1"
    && Array.isArray(candidate.sections);
}, { message: "Receiver ExperienceDNA snapshot tidak valid." });

export const receiverAssetKindSchema = z.enum(["media", "music", "beatmap", "theme-background", "theme-decoration"]);

export const receiverAssetDescriptorSchema = z.object({
  id: z.string().min(1),
  kind: receiverAssetKindSchema,
  contentType: z.string().min(1),
  delivery: z.enum(["resolver", "public"]),
  publicPath: z.string().startsWith("/").nullable(),
  mediaId: z.string().min(1).nullable(),
});

export const receiverAssetRecordSchema = z.discriminatedUnion("source", [
  z.object({
    id: z.string().min(1),
    receiverId: z.string().min(1),
    kind: receiverAssetKindSchema,
    contentType: z.string().min(1),
    source: z.literal("b2"),
    storageObjectKey: z.string().min(1),
    mediaId: z.string().min(1).nullable(),
  }),
  z.object({
    id: z.string().min(1),
    receiverId: z.string().min(1),
    kind: receiverAssetKindSchema,
    contentType: z.string().min(1),
    source: z.literal("public"),
    publicPath: z.string().startsWith("/"),
    mediaId: z.string().min(1).nullable(),
  }),
]);

export const receiverMediaDescriptorSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  type: z.enum(["photo", "video"]),
  contentType: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSec: z.number().nonnegative().nullable(),
  contributorName: z.string().nullable(),
  originalFileName: z.string().min(1),
});

export const receiverWishSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1).max(2000),
  contributorName: z.string().nullable(),
});

export const receiverThemeSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  palette: themePaletteSchema,
  typography: themeTypographySchema,
  backgroundAssetId: z.string().min(1),
  decorations: z.array(z.object({
    id: z.string().min(1),
    assetId: z.string().min(1),
    anchorX: z.number().min(0).max(100),
    anchorY: z.number().min(0).max(100),
    scale: z.number().positive().max(4),
    opacity: z.number().min(0).max(1),
    placement: z.enum(["foreground", "midground", "background"]),
  })),
});

const receiverMusicBaseSchema = z.object({
  name: z.string().min(1),
  trackAssetId: z.string().min(1),
  bpm: z.number().positive().nullable(),
  durationSec: z.number().positive().nullable(),
  mood: z.array(z.string().min(1)).max(8),
});

export const receiverMusicSnapshotSchema = z.discriminatedUnion("beatmapSource", [
  receiverMusicBaseSchema.extend({
    beatmapSource: z.literal("asset"),
    beatmapAssetId: z.string().min(1),
    beats: z.array(z.number()).max(0).default([]),
    onsets: z.array(z.number()).max(0).default([]),
    energyCurve: z.array(z.number()).max(0).default([]),
  }),
  receiverMusicBaseSchema.extend({
    beatmapSource: z.literal("inline"),
    beatmapAssetId: z.null(),
    beats: z.array(z.number().nonnegative()).max(5000),
    onsets: z.array(z.number().nonnegative()).max(5000),
    energyCurve: z.array(z.number().min(0).max(1)).max(600),
  }),
]);

export const receiverManifestSchema = z.object({
  schemaVersion: z.literal(RECEIVER_MANIFEST_VERSION),
  receiverId: z.string().min(1),
  revision: z.number().int().positive(),
  bakedAt: z.string().datetime(),
  room: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    recipientName: z.string().min(1),
    occasionId: z.string().min(1),
  }),
  theme: receiverThemeSnapshotSchema,
  assets: z.array(receiverAssetDescriptorSchema).min(1),
  media: z.array(receiverMediaDescriptorSchema).min(1),
  wishes: z.array(receiverWishSchema),
  music: receiverMusicSnapshotSchema,
  experience: receiverExperienceSnapshotSchema,
});

export const scrollFocusStateSchema = z.object({
  activeIndex: z.number().int().nonnegative(),
  focusProgress: z.number().min(0).max(1),
  direction: z.enum(["up", "down", "idle"]),
  velocity: z.number(),
});

export type ReceiverAssetDescriptor = z.infer<typeof receiverAssetDescriptorSchema>;
export type ReceiverAssetRecord = z.infer<typeof receiverAssetRecordSchema>;
export type ReceiverMediaDescriptor = z.infer<typeof receiverMediaDescriptorSchema>;
export type ReceiverWish = z.infer<typeof receiverWishSchema>;
export type ReceiverManifest = z.infer<typeof receiverManifestSchema>;
export type ReceiverManifestDraft = Omit<ReceiverManifest, "revision" | "bakedAt">;
export type ScrollFocusState = z.infer<typeof scrollFocusStateSchema>;
