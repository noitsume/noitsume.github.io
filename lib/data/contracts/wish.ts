import { z } from "zod";

export const wishSchema = z.object({
  mediaId: z.string().min(1),
  text: z.string().min(1),
  contributorName: z.string().nullable(),
});

export type Wish = z.infer<typeof wishSchema>;
