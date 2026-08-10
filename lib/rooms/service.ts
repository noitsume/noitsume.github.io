import "server-only";

import { roomSchema, type Room, type UpdateRoomInput } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError } from "@/lib/http";
import { deletePrivatePrefixCompletely } from "@/lib/storage";

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

  if (room.status === "collecting" && Date.parse(room.collectionDeadline) <= Date.now()) {
    const updatedAt = new Date().toISOString();
    await backendRepositories.rooms.setStatus(room.id, "closed", updatedAt);
    return roomSchema.parse({ ...room, status: "closed", updatedAt });
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
  const [submissions, media] = await Promise.all([
    backendRepositories.submissions.listByRoom(roomId),
    backendRepositories.media.listByRoom(roomId),
  ]);

  // Storage cleanup is a hard precondition for deleting Room metadata.
  // Purge the whole Room prefix rather than trusting Firestore as the complete
  // object index: interrupted uploads/migrations can leave orphan objects, and
  // B2 keeps object versions unless a specific version is deleted.
  try {
    await deletePrivatePrefixCompletely(`rooms/${roomId}/`);
  } catch (error) {
    console.error(`[room-delete] B2 cleanup failed for ${roomId}`, error);
    throw new ApiError(
      "ROOM_STORAGE_CLEANUP_FAILED",
      "Media Room belum berhasil dibersihkan dari storage. Room tidak dihapus; coba lagi setelah koneksi/izin B2 normal.",
      503,
    );
  }

  await backendRepositories.media.deleteMany(roomId, media.map((item) => item.id));
  for (const submission of submissions) {
    await backendRepositories.submissions.deleteSubmission(roomId, submission.id);
  }
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
