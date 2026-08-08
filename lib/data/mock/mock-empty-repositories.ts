import type {
  Media,
  ReceiverAnalyticsEvent,
  Submission,
  Theme,
} from "@/lib/data/contracts";
import type {
  AnalyticsRepository,
  MediaRepository,
  SubmissionRepository,
  ThemeRepository,
} from "@/lib/data/repositories";
import { createMockThemes } from "./seed";

export class MockMediaRepository implements MediaRepository {
  async listByRoom(_roomId: string): Promise<Media[]> {
    return [];
  }

  async getById(_id: string): Promise<Media | null> {
    return null;
  }
}

export class MockSubmissionRepository implements SubmissionRepository {
  async listByRoom(_roomId: string): Promise<Submission[]> {
    return [];
  }

  async getById(_id: string): Promise<Submission | null> {
    return null;
  }
}

export class MockAnalyticsRepository implements AnalyticsRepository {
  async listByRoom(
    _roomId: string,
    _from?: string,
    _to?: string,
  ): Promise<ReceiverAnalyticsEvent[]> {
    return [];
  }
}

export class MockThemeRepository implements ThemeRepository {
  constructor(private readonly themes: Theme[] = createMockThemes()) {}

  async listThemes(): Promise<Theme[]> {
    return structuredClone(this.themes);
  }

  async getTheme(id: string): Promise<Theme | null> {
    const theme = this.themes.find((candidate) => candidate.id === id);
    return theme ? structuredClone(theme) : null;
  }
}
