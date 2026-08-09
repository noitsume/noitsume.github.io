import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import { mediaSchema, type Media } from "@/lib/data/contracts";
import type { MediaRepository } from "@/lib/data/repositories";
import { firestoreDb, toIsoString } from "./shared";

function mapMedia(
  id: string,
  data: DocumentData,
): Media {
  return mediaSchema.parse({
    id,
    roomId: data.roomId,
    type: data.type,
    url: data.url,
    message: data.message ?? null,
    contributorName: data.contributorName ?? null,
    submittedAt: toIsoString(data.submittedAt),
    durationSec: data.durationSec,
    width: data.width,
    height: data.height,
  });
}

export class FirestoreMediaRepository implements MediaRepository {
  async listByRoom(roomId: string): Promise<Media[]> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("media")
      .get();

    return snapshot.docs
      .map((doc) => mapMedia(doc.id, doc.data()))
      .sort(
        (a, b) =>
          new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      );
  }

  async getById(id: string): Promise<Media | null> {
    const snapshot = await firestoreDb()
      .collectionGroup("media")
      .where("id", "==", id)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    return doc ? mapMedia(doc.id, doc.data()) : null;
  }
}
