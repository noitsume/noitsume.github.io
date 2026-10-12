import type {
  Media,
  Submission,
  SubmissionModeration,
} from "@/lib/data/contracts";

export type SubmissionCreateResult = "created" | "exists" | "closed";

export interface SubmissionRepository {
  listByRoom(roomId: string): Promise<Submission[]>;
  getById(roomId: string, id: string): Promise<Submission | null>;
  createPending(submission: Submission): Promise<SubmissionCreateResult>;
  claimModeration(roomId: string, submissionId: string, decision: SubmissionModeration): Promise<Submission | null>;
  finishModeration(
    roomId: string,
    submissionId: string,
    decision: SubmissionModeration,
    media: Media[],
    reviewedAt: string,
  ): Promise<Submission | null>;
}
