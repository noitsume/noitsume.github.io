import { z } from "zod";

export const userProfileSchema = z.object({
  uid: z.string().min(1),
  username: z.string().min(2).max(32).nullable(),
  displayName: z.string().min(1),
  email: z.string().email(),
  photoURL: z.string().url().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UserProfile = z.infer<typeof userProfileSchema>;
