import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { saveOwnedVideoBeatmap } from "@/lib/studio/service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; mediaId: string }> }) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession(), { id, mediaId } = await context.params;
    return apiOk(await saveOwnedVideoBeatmap(session.uid, id, mediaId, await request.json()), requestId);
  } catch (error) { return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/media/[mediaId]/audio-analysis"); }
}
