import type { Media, Submission } from "@/lib/data/contracts";

export type ModerationResult = {
  promotedMedia: Media[];
  reviewedSubmissions: Submission[];
  deletedSubmissionIds: string[];
  removedMediaIds: string[];
  previewUrlByMediaId: Record<string, string>;
};
