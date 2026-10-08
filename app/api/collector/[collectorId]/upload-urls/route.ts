import { consumeRateLimit, publicRequestKey, readBoundedJson } from "@/lib/http/rate-limit";
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
    await consumeRateLimit(publicRequestKey(request, "collector:upload-urls:" + collectorId), 15, 60 * 60 * 1000);
    const input = collectorUploadUrlsRequestSchema.parse(await readBoundedJson(request, 65536));
    const prepared = await prepareCollectorUploads(collectorId, input);
    return apiOk(prepared, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/collector/[collectorId]/upload-urls");
  }
}
