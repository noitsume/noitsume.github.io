import "server-only";

import type { Room, UpdateRoomInput } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError } from "@/lib/http";

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
  await getOwnedRoom(ownerUid, roomId);
  return backendRepositories.rooms.updateRoom(roomId, patch);
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
  await getOwnedRoom(ownerUid, roomId);
  return backendRepositories.rooms.setPinned(roomId, pinned);
}

export async function touchOwnedRoom(ownerUid: string, roomId: string) {
  await getOwnedRoom(ownerUid, roomId);
  return backendRepositories.rooms.touchLastOpened(roomId);
}
