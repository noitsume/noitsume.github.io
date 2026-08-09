import { z } from "zod";

export const occasionIdSchema = z.enum([
  "birthday",
  "graduation",
  "anniversary",
]);

const roomDetailsSchema = z.object({
  title: z.string().trim().min(2).max(80),
  recipientName: z.string().trim().min(2).max(80),
  occasionId: occasionIdSchema,
  eventId: z.string().trim().min(1).max(120).nullable().default(null),
  themeId: z.string().trim().min(1).max(80),
  customThemeNameRaw: z.string().trim().min(1).max(80).nullable().default(null),
  collectionDeadline: z.string().datetime(),
  expiresAt: z.string().datetime().nullable().default(null),
});

export const createRoomRequestSchema = roomDetailsSchema.refine(
  (value) => Date.parse(value.collectionDeadline) > Date.now(),
  {
    path: ["collectionDeadline"],
    message: "Deadline collecting harus berada di masa depan.",
  },
);

export const updateRoomRequestSchema = roomDetailsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Tidak ada perubahan yang dikirim.",
  });

export const setPinnedRequestSchema = z.object({
  pinned: z.boolean(),
});
