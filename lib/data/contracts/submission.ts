import { z } from "zod";

export const submissionStatusSchema = z.enum([
  "new",
  "reviewed",
  "approved",
  "rejected",
]);

export const submissionSchema = z.object({
  id: z.string().min(1),
  roomId: z.string().min(1),
  mediaIds: z.array(z.string().min(1)),
  message: z.string().nullable(),
  contributorName: z.string().nullable(),
  status: submissionStatusSchema,
  submittedAt: z.string().datetime(),
});

export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
export type Submission = z.infer<typeof submissionSchema>;
