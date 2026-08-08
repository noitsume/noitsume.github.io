import type { EventDefinition } from "@/lib/data/contracts";

export interface EventRepository {
  listEvents(region?: string): Promise<EventDefinition[]>;
}
