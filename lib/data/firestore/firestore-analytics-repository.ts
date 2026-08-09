import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import {
  receiverAnalyticsEventSchema,
  type ReceiverAnalyticsEvent,
} from "@/lib/data/contracts";
import type { AnalyticsRepository } from "@/lib/data/repositories";
import { firestoreDb, toIsoString } from "./shared";

function mapEvent(
  id: string,
  data: DocumentData,
): ReceiverAnalyticsEvent {
  return receiverAnalyticsEventSchema.parse({
    id,
    receiverId: data.receiverId,
    roomId: data.roomId,
    viewerKey: data.viewerKey,
    sessionId: data.sessionId,
    type: data.type,
    occurredAt: toIsoString(data.occurredAt),
    createdAt: toIsoString(data.createdAt),
  });
}

export class FirestoreAnalyticsRepository implements AnalyticsRepository {
  async listByRoom(
    roomId: string,
    from?: string,
    to?: string,
  ): Promise<ReceiverAnalyticsEvent[]> {
    const snapshot = await firestoreDb()
      .collection("rooms")
      .doc(roomId)
      .collection("analytics")
      .get();

    return snapshot.docs
      .map((doc) => mapEvent(doc.id, doc.data()))
      .filter((event) => !from || event.occurredAt >= from)
      .filter((event) => !to || event.occurredAt <= to)
      .sort(
        (a, b) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
      );
  }
}
