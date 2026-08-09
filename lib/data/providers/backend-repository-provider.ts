import {
  FirestoreAnalyticsRepository,
  FirestoreMediaRepository,
  FirestoreRoomRepository,
  FirestoreSubmissionRepository,
  FirestoreUserRepository,
} from "@/lib/data/firestore";
import { MockThemeRepository } from "@/lib/data/mock";
import { StaticEventRepository } from "@/lib/data/static";

export const backendRepositories = {
  rooms: new FirestoreRoomRepository(),
  media: new FirestoreMediaRepository(),
  submissions: new FirestoreSubmissionRepository(),
  themes: new MockThemeRepository(),
  analytics: new FirestoreAnalyticsRepository(),
  users: new FirestoreUserRepository(),
  events: new StaticEventRepository(),
};
