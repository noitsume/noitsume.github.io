import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { setOwnedRoomPinned, setPinnedRequestSchema } from "@/lib/rooms";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const { pinned } = setPinnedRequestSchema.parse(await request.json());
    const room = await setOwnedRoomPinned(session.uid, id, pinned);
    return apiOk({ room }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/pin");
  }
}
