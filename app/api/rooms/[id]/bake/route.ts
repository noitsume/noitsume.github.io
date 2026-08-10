import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { bakeOwnedReceiver } from "@/lib/receiver";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const result = await bakeOwnedReceiver(session.uid, id);
    return apiOk({
      receiverId: result.manifest.receiverId,
      revision: result.manifest.revision,
      bakedAt: result.manifest.bakedAt,
      reused: result.reused,
    }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/bake");
  }
}
