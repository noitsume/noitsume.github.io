import { z } from "zod";

export const userProfileSchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  photoURL: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
