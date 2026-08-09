import { curatedEvents } from "@/config/events";
import type { EventDefinition } from "@/lib/data/contracts";
import type { EventRepository } from "@/lib/data/repositories";

export class StaticEventRepository implements EventRepository {
  async listEvents(region?: string): Promise<EventDefinition[]> {
    const now = Date.now();
    return curatedEvents
      .filter((event) => !region || event.region === region)
      .filter((event) => Date.parse(event.date) >= now)
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
      .map((event) => structuredClone(event));
  }
}
