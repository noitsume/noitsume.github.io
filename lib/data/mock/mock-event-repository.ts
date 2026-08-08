import type { EventDefinition } from "@/lib/data/contracts";
import type { EventRepository } from "@/lib/data/repositories";
import { createMockEvents } from "./seed";

export class MockEventRepository implements EventRepository {
  constructor(private readonly events: EventDefinition[] = createMockEvents()) {}

  async listEvents(region?: string): Promise<EventDefinition[]> {
    const events = region
      ? this.events.filter((event) => event.region === region)
      : this.events;
    return structuredClone(events);
  }
}
