import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { deleteOwnedRoomMusic } from "@/lib/studio/service";

type RouteContext = { params: Promise<{ id: string; musicId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id, musicId } = await context.params;
    const result = await deleteOwnedRoomMusic(session.uid, id, musicId);
    return apiOk(result, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "DELETE /api/rooms/[id]/music/[musicId]");
  }
}
