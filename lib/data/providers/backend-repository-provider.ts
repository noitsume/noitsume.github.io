import {
  FirestoreAnalyticsRepository,
  FirestoreMediaRepository,
  FirestoreRoomRepository,
  FirestoreSubmissionRepository,
  FirestoreUserRepository,
} from "@/lib/data/firestore";
import { MockEventRepository, MockThemeRepository } from "@/lib/data/mock";

// Patch 2 prepares the real backend adapters without switching the Dashboard yet.
// Patch 3 will select these repositories after auth/session is in place.
export const backendRepositories = {
  rooms: new FirestoreRoomRepository(),
  media: new FirestoreMediaRepository(),
  submissions: new FirestoreSubmissionRepository(),
  themes: new MockThemeRepository(),
  analytics: new FirestoreAnalyticsRepository(),
  users: new FirestoreUserRepository(),
  events: new MockEventRepository(),
};
