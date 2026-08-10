import {
  FirestoreAnalyticsRepository,
  FirestoreMediaRepository,
  FirestoreRoomRepository,
  FirestoreReceiverRepository,
  FirestoreRoomMusicRepository,
  FirestoreSubmissionRepository,
  FirestoreUserRepository,
} from "@/lib/data/firestore";
import { StaticEventRepository, StaticThemeRepository } from "@/lib/data/static";

// Production/server-facing provider. No mock repository is allowed here.
export const backendRepositories = {
  rooms: new FirestoreRoomRepository(),
  receivers: new FirestoreReceiverRepository(),
  roomMusic: new FirestoreRoomMusicRepository(),
  media: new FirestoreMediaRepository(),
  submissions: new FirestoreSubmissionRepository(),
  themes: new StaticThemeRepository(),
  analytics: new FirestoreAnalyticsRepository(),
  users: new FirestoreUserRepository(),
  events: new StaticEventRepository(),
};
