import type { ReceiverAnalyticsEvent } from "@/lib/data/contracts";

export interface AnalyticsRepository {
  listByRoom(roomId: string, from?: string, to?: string): Promise<ReceiverAnalyticsEvent[]>;
}
