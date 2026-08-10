import { z } from "zod";

export const roomStatusSchema = z.enum([
  "collecting",
  "closed",
  "configuring",
  "baking",
  "ready",
]);

export const roomConfigSchema = z.record(z.string(), z.unknown()).nullable();

export const roomSchema = z.object({
  id: z.string().min(1),
  ownerUid: z.string().min(1),
  title: z.string().min(1),
  recipientName: z.string().min(1),
  occasionId: z.string().min(1),
  eventId: z.string().min(1).nullable(),
  themeId: z.string().min(1),
  customThemeNameRaw: z.string().min(1).nullable(),
  status: roomStatusSchema,
  collectorId: z.string().min(1),
  receiverId: z.string().min(1).nullable(),
  collectionDeadline: z.string().datetime(),
  config: roomConfigSchema,
  firstBakedAt: z.string().datetime().nullable(),
  lastBakedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  isPinned: z.boolean(),
  lastOpenedAt: z.string().datetime().nullable(),
  schemaVersion: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type Room = z.infer<typeof roomSchema>;

export type CreateRoomInput = Pick<
  Room,
  | "title"
  | "recipientName"
  | "occasionId"
  | "eventId"
  | "themeId"
  | "customThemeNameRaw"
  | "collectionDeadline"
  | "expiresAt"
>;

export type UpdateRoomInput = Partial<
  Pick<
    Room,
    | "title"
    | "recipientName"
    | "occasionId"
    | "eventId"
    | "themeId"
    | "customThemeNameRaw"
    | "collectionDeadline"
    | "expiresAt"
  >
>;
