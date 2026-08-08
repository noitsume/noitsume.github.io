import type { Room } from "@/lib/data/contracts";
import { getDashboardRoomStatus } from "./room-status";

export type RoomSortMode = "newest" | "oldest" | "status";

const statusOrder = {
  working: 0,
  waiting: 1,
  ended: 2,
} as const;

export function sortRooms(
  rooms: readonly Room[],
  mode: RoomSortMode,
  now: Date = new Date(),
): Room[] {
  return [...rooms].sort((a, b) => {
    if (mode === "newest") {
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    }

    if (mode === "oldest") {
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    }

    const statusDiff =
      statusOrder[getDashboardRoomStatus(a, now)] -
      statusOrder[getDashboardRoomStatus(b, now)];

    return statusDiff || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
}
