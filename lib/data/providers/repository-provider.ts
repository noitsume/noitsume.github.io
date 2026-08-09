import {
  MockAnalyticsRepository,
  MockEventRepository,
  MockMediaRepository,
  MockRoomRepository,
  MockSubmissionRepository,
  MockThemeRepository,
  MockUserRepository,
} from "@/lib/data/mock";

// Mock provider is intentionally kept for isolated previews/tests.
// Owner-facing production pages use backendRepositories after Patch 3.
export const repositories = {
  rooms: new MockRoomRepository(),
  media: new MockMediaRepository(),
  submissions: new MockSubmissionRepository(),
  themes: new MockThemeRepository(),
  analytics: new MockAnalyticsRepository(),
  users: new MockUserRepository(),
  events: new MockEventRepository(),
};
