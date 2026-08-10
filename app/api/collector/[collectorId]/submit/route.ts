import type { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/auth/csrf";
import {
  collectorSubmitRequestSchema,
  commitCollectorSubmission,
} from "@/lib/collector";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ collectorId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertSameOrigin(request);
    const { collectorId } = await context.params;
    const input = collectorSubmitRequestSchema.parse(await request.json());
    const result = await commitCollectorSubmission(collectorId, input);
    return apiOk(
      { submissionId: result.submission.id, mediaCount: result.submission.stagedMedia.length },
      requestId,
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/collector/[collectorId]/submit");
  }
}
