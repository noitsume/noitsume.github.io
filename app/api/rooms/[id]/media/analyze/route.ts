import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { analyzeOwnedMedia, ownerMediaAnalysisRequestSchema } from "@/lib/collector";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const input = ownerMediaAnalysisRequestSchema.parse(await request.json());
    const result = await analyzeOwnedMedia(session.uid, id, input);
    return apiOk(result, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/media/analyze");
  }
}
