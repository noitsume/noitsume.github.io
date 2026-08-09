import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import { submissionSchema, type Submission } from "@/lib/data/contracts";
import type { SubmissionRepository } from "@/lib/data/repositories";
import { firestoreDb, toIsoString } from "./shared";

function mapSubmission(
  id: string,
  data: DocumentData,
): Submission {
  return submissionSchema.parse({
    id,
    roomId: data.roomId,
    mediaIds: data.mediaIds ?? [],
    message: data.message ?? null,
    contributorName: data.contributorName ?? null,
    status: data.status,
    submittedAt: toIsoString(data.submittedAt),
  });
}

export class FirestoreSubmissionRepository implements SubmissionRepository {
  async listByRoom(roomId: string): Promise<Submission[]> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("submissions")
      .get();

    return snapshot.docs
      .map((doc) => mapSubmission(doc.id, doc.data()))
      .sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
  }

  async getById(id: string): Promise<Submission | null> {
    const snapshot = await firestoreDb()
      .collectionGroup("submissions")
      .where("id", "==", id)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    return doc ? mapSubmission(doc.id, doc.data()) : null;
  }
}
