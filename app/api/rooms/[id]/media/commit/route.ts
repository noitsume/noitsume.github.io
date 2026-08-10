import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { commitOwnerMedia, ownerMediaCommitRequestSchema } from "@/lib/collector";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
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
    const input = ownerMediaCommitRequestSchema.parse(await request.json());
    const profile = await backendRepositories.users.getUser(session.uid);
    const ownerName = profile?.username?.trim() || "Owner";
    const result = await commitOwnerMedia(session.uid, id, ownerName, input);
    return apiOk(result, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms/[id]/media/commit");
  }
}
