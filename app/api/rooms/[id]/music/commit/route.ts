import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { commitOwnedRoomMusic } from "@/lib/studio/service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const result = await commitOwnedRoomMusic(session.uid, id, await request.json());
    return apiOk(result, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/music/commit");
  }
}
