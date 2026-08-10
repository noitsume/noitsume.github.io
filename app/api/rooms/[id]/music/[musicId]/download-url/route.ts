import type { NextRequest } from "next/server";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { getOwnedRoomMusicDownloadUrl } from "@/lib/studio/service";

type RouteContext = { params: Promise<{ id: string; musicId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const session = await requireOwnerSession();
    const { id, musicId } = await context.params;
    const result = await getOwnedRoomMusicDownloadUrl(session.uid, id, musicId);
    return apiOk(result, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "GET /api/rooms/[id]/music/[musicId]/download-url");
  }
}
