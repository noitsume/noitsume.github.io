import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { saveOwnedRoomMusicAnalysis } from "@/lib/studio/service";

type RouteContext = { params: Promise<{ id: string; musicId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id, musicId } = await context.params;
    const result = await saveOwnedRoomMusicAnalysis(session.uid, id, musicId, await request.json());
    return apiOk(result, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/music/[musicId]/analyze");
  }
}
