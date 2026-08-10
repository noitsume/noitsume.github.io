import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { moderateOwnedSubmissions, ownerSubmissionActionSchema } from "@/lib/collector";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const input = ownerSubmissionActionSchema.parse(await request.json());
    const result = await moderateOwnedSubmissions(session.uid, id, input.submissionIds, input.action);
    return apiOk({ ...result, action: input.action }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/submissions/actions");
  }
}
