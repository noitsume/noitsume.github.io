import type { Room } from "@/lib/data/contracts";

export type DashboardRoomStatus = "waiting" | "working" | "ended";

export function getDashboardRoomStatus(
  room: Pick<Room, "firstBakedAt" | "expiresAt">,
  now: Date = new Date(),
): DashboardRoomStatus {
  if (room.expiresAt && new Date(room.expiresAt).getTime() <= now.getTime()) {
    return "ended";
  }

  return room.firstBakedAt ? "working" : "waiting";
}
