import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { collectorUploadUrlsRequestSchema, prepareOwnerUploads } from "@/lib/collector";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const input = collectorUploadUrlsRequestSchema.parse(await request.json());
    const result = await prepareOwnerUploads(session.uid, id, input);
    return apiOk(result, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/media/upload-urls");
  }
}
