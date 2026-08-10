import type {
  Media,
  Submission,
  SubmissionStatus,
} from "@/lib/data/contracts";

export type SubmissionCreateResult = "created" | "exists" | "closed";
export type SubmissionApprovalResult = "updated" | "exists" | "not_found";

export interface SubmissionRepository {
  listByRoom(roomId: string): Promise<Submission[]>;
  getById(roomId: string, id: string): Promise<Submission | null>;
  createPending(submission: Submission): Promise<SubmissionCreateResult>;
  approveWithMedia(
    roomId: string,
    submissionId: string,
    media: Media[],
    reviewedAt: string,
  ): Promise<SubmissionApprovalResult>;
  updateStatuses(
    roomId: string,
    submissionIds: string[],
    status: SubmissionStatus,
    reviewedAt: string,
    options?: { clearStagedMedia?: boolean; clearMediaIds?: boolean },
  ): Promise<void>;
  deleteSubmission(roomId: string, submissionId: string): Promise<void>;
}
