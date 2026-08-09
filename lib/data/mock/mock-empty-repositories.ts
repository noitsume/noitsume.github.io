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
  async listByRoom(roomId: string): Promise<Media[]> {
    void roomId;
    return [];
  }

  async getById(id: string): Promise<Media | null> {
    void id;
    return null;
  }
}

export class MockSubmissionRepository implements SubmissionRepository {
  async listByRoom(roomId: string): Promise<Submission[]> {
    void roomId;
    return [];
  }

  async getById(id: string): Promise<Submission | null> {
    void id;
    return null;
  }
}

export class MockAnalyticsRepository implements AnalyticsRepository {
  async listByRoom(
    roomId: string,
    from?: string,
    to?: string,
  ): Promise<ReceiverAnalyticsEvent[]> {
    void roomId;
    void from;
    void to;
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
