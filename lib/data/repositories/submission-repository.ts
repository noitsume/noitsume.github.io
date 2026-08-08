import type { Submission } from "@/lib/data/contracts";

export interface SubmissionRepository {
  listByRoom(roomId: string): Promise<Submission[]>;
  getById(id: string): Promise<Submission | null>;
}
