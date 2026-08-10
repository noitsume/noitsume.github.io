import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { getOwnedPreviewUrls, ownerPreviewUrlsRequestSchema } from "@/lib/collector";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const input = ownerPreviewUrlsRequestSchema.parse(await request.json());
    const previewUrlByMediaId = await getOwnedPreviewUrls(session.uid, id, input);
    return apiOk({ previewUrlByMediaId }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/media/preview-urls");
  }
}
