import type { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  collectorUploadUrlsRequestSchema,
  prepareCollectorUploads,
} from "@/lib/collector";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

type RouteContext = { params: Promise<{ collectorId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertSameOrigin(request);
    const { collectorId } = await context.params;
    const input = collectorUploadUrlsRequestSchema.parse(await request.json());
    const prepared = await prepareCollectorUploads(collectorId, input);
    return apiOk(prepared, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/collector/[collectorId]/upload-urls");
  }
}
