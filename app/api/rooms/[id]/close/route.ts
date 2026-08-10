import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { roomSchema } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError, apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { getOwnedRoom } from "@/lib/rooms";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const room = await getOwnedRoom(session.uid, id);

    if (room.status !== "collecting") {
      throw new ApiError("COLLECTION_ALREADY_CLOSED", "Pengumpulan Room ini sudah ditutup.", 409);
    }

    const updatedAt = new Date().toISOString();
    await backendRepositories.rooms.setStatus(room.id, "closed", updatedAt);
    const updatedRoom = roomSchema.parse({ ...room, status: "closed", updatedAt });
    return apiOk({ room: updatedRoom }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/close");
  }
}
