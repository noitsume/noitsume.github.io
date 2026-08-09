import "server-only";

import { roomSchema, type Room, type UpdateRoomInput } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError } from "@/lib/http";

// Recent-room tracking is informational, not critical business data.
// Keep at most one Firestore write per room per owner per hour.
export const ROOM_OPEN_WRITE_THROTTLE_MS = 60 * 60 * 1000;

export async function getOwnedRoom(ownerUid: string, roomId: string) {
  const room = await backendRepositories.rooms.getRoom(roomId);
  if (!room) {
    throw new ApiError("ROOM_NOT_FOUND", "Room tidak ditemukan.", 404);
  }
  if (room.ownerUid !== ownerUid) {
    throw new ApiError("ROOM_FORBIDDEN", "Kamu tidak memiliki akses ke Room ini.", 403);
  }
  return room;
}

export async function updateOwnedRoom(
  ownerUid: string,
  roomId: string,
  patch: UpdateRoomInput,
): Promise<Room> {
  const current = await getOwnedRoom(ownerUid, roomId);
  const updatedAt = new Date().toISOString();
  await backendRepositories.rooms.updateRoom(roomId, patch, updatedAt);

  return roomSchema.parse({
    ...current,
    ...patch,
    updatedAt,
  });
}

export async function deleteOwnedRoom(ownerUid: string, roomId: string) {
  await getOwnedRoom(ownerUid, roomId);
  await backendRepositories.rooms.deleteRoom(roomId);
}

export async function setOwnedRoomPinned(
  ownerUid: string,
  roomId: string,
  pinned: boolean,
) {
  const current = await getOwnedRoom(ownerUid, roomId);
  if (current.isPinned === pinned) return current;

  const updatedAt = new Date().toISOString();
  await backendRepositories.rooms.setPinned(roomId, pinned, updatedAt);
  return roomSchema.parse({
    ...current,
    isPinned: pinned,
    updatedAt,
  });
}

export async function touchOwnedRoom(ownerUid: string, roomId: string) {
  const current = await getOwnedRoom(ownerUid, roomId);
  const now = Date.now();
  const lastOpenedAt = current.lastOpenedAt
    ? Date.parse(current.lastOpenedAt)
    : Number.NEGATIVE_INFINITY;

  if (
    Number.isFinite(lastOpenedAt) &&
    now - lastOpenedAt < ROOM_OPEN_WRITE_THROTTLE_MS
  ) {
    return { room: current, wrote: false };
  }

  const openedAt = new Date(now).toISOString();
  await backendRepositories.rooms.touchLastOpened(roomId, openedAt);
  return {
    room: roomSchema.parse({ ...current, lastOpenedAt: openedAt }),
    wrote: true,
  };
}
