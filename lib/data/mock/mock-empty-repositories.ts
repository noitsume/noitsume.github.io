import type {
  Media,
  ReceiverAnalyticsEvent,
  Submission,
  SubmissionModeration,
  Theme,
} from "@/lib/data/contracts";
import type {
  AnalyticsRepository,
  MediaCreateManyResult,
  MediaRepository,
  SubmissionCreateResult,
  SubmissionRepository,
  ThemeRepository,
} from "@/lib/data/repositories";
import { createMockThemes } from "./seed";

export class MockMediaRepository implements MediaRepository {
  async listByRoom(roomId: string): Promise<Media[]> {
    void roomId;
    return [];
  }

  async getById(roomId: string, id: string): Promise<Media | null> {
    void roomId;
    void id;
    return null;
  }

  async createMany(media: Media[]): Promise<MediaCreateManyResult> {
    void media;
    return "created";
  }

  async updateStorageObjectKeys(
    updates: Array<{ roomId: string; mediaId: string; storageObjectKey: string }>,
  ): Promise<void> {
    void updates;
  }

  async updateAnalysis(roomId: string, mediaId: string, media: Media): Promise<void> {
    void roomId;
    void mediaId;
    void media;
  }

  async deleteMany(roomId: string, mediaIds: string[]): Promise<void> {
    void roomId;
    void mediaIds;
  }

  async updateAudioBeatmap(roomId: string, mediaId: string, beatmap: NonNullable<Media["audioBeatmap"]>): Promise<void> {
    void roomId; void mediaId; void beatmap;
  }
}

export class MockSubmissionRepository implements SubmissionRepository {
  async listByRoom(roomId: string): Promise<Submission[]> {
    void roomId;
    return [];
  }

  async getById(roomId: string, id: string): Promise<Submission | null> {
    void roomId;
    void id;
    return null;
  }

  async createPending(submission: Submission): Promise<SubmissionCreateResult> {
    void submission;
    return "created";
  }

  async claimModeration(roomId: string, submissionId: string, decision: SubmissionModeration): Promise<Submission | null> {
    void roomId; void submissionId; void decision;
    return null;
  }

  async finishModeration(roomId: string, submissionId: string, decision: SubmissionModeration, media: Media[], reviewedAt: string): Promise<Submission | null> {
    void roomId; void submissionId; void decision; void media; void reviewedAt;
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
