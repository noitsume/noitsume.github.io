import {
  MockAnalyticsRepository,
  MockEventRepository,
  MockMediaRepository,
  MockRoomRepository,
  MockSubmissionRepository,
  MockThemeRepository,
  MockUserRepository,
} from "@/lib/data/mock";

// Patch 0 intentionally points every domain to mock repositories.
// Later patches swap these providers to Firestore/API implementations
// without changing React components that consume the interfaces.
export const repositories = {
  rooms: new MockRoomRepository(),
  media: new MockMediaRepository(),
  submissions: new MockSubmissionRepository(),
  themes: new MockThemeRepository(),
  analytics: new MockAnalyticsRepository(),
  users: new MockUserRepository(),
  events: new MockEventRepository(),
};
