import type {
  EventDefinition,
  Room,
  Theme,
  UserProfile,
} from "@/lib/data/contracts";
import { curatedThemes } from "@/config/themes";

function addDays(base: Date, days: number): string {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result.toISOString();
}

export const MOCK_USER_UID = "dev_kevin";

export function createMockUser(now = new Date()): UserProfile {
  const timestamp = now.toISOString();
  return {
    uid: MOCK_USER_UID,
    username: "Kevin",
    displayName: "Kevin",
    email: "noitsume@gmail.com",
    photoURL: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createMockRooms(now = new Date()): Room[] {
  const createdA = addDays(now, -12);
  const createdB = addDays(now, -5);

  return [
    {
      id: "room_antonio_12",
      ownerUid: MOCK_USER_UID,
      title: "Antonio ke 12",
      recipientName: "Antonio",
      occasionId: "birthday",
      eventId: null,
      themeId: "theme_warm_memory",
      customThemeNameRaw: null,
      status: "configuring",
      collectorId: "collector_antonio_12",
      receiverId: "receiver_antonio_12",
      collectionDeadline: addDays(now, 4),
      config: null,
      firstBakedAt: addDays(now, -3),
      lastBakedAt: addDays(now, -3),
      expiresAt: addDays(now, 40),
      isPinned: true,
      lastOpenedAt: addDays(now, -1),
      schemaVersion: 1,
      createdAt: createdA,
      updatedAt: addDays(now, -1),
    },
    {
      id: "room_momen_rani",
      ownerUid: MOCK_USER_UID,
      title: "Momen Spesial Rani",
      recipientName: "Rani",
      occasionId: "graduation",
      eventId: null,
      themeId: "theme_warm_memory",
      customThemeNameRaw: null,
      status: "ready",
      collectorId: "collector_momen_rani",
      receiverId: "receiver_momen_rani",
      collectionDeadline: addDays(now, 7),
      config: null,
      firstBakedAt: addDays(now, -1),
      lastBakedAt: addDays(now, -1),
      expiresAt: addDays(now, 55),
      isPinned: true,
      lastOpenedAt: addDays(now, -2),
      schemaVersion: 1,
      createdAt: createdB,
      updatedAt: now.toISOString(),
    },
    {
      id: "room_kenangan_dila",
      ownerUid: MOCK_USER_UID,
      title: "Dila Graduation 2026",
      recipientName: "Dila",
      occasionId: "graduation",
      eventId: null,
      themeId: "theme_warm_memory",
      customThemeNameRaw: null,
      status: "collecting",
      collectorId: "collector_kenangan_dila",
      receiverId: null,
      collectionDeadline: addDays(now, 11),
      config: null,
      firstBakedAt: null,
      lastBakedAt: null,
      expiresAt: addDays(now, 33),
      isPinned: false,
      lastOpenedAt: addDays(now, -4),
      schemaVersion: 1,
      createdAt: addDays(now, -2),
      updatedAt: addDays(now, -1),
    },
  ];
}

export function createMockThemes(): Theme[] {
  return structuredClone(curatedThemes);
}

export function createMockEvents(now = new Date()): EventDefinition[] {
  return [
    {
      id: "event_indonesia_independence",
      title: "Hari Kemerdekaan Republik Indonesia",
      date: addDays(now, 9),
      category: "national",
      icon: "flag",
      accent: "coral",
      region: "ID",
    },
    {
      id: "event_maulid",
      title: "Maulid Nabi Muhammad SAW",
      date: addDays(now, 17),
      category: "religious",
      icon: "moon-star",
      accent: "green",
      region: "ID",
    },
    {
      id: "event_next",
      title: "Event Berikutnya",
      date: addDays(now, 28),
      category: "general",
      icon: "calendar",
      accent: "amber",
      region: "ID",
    },
  ];
}
