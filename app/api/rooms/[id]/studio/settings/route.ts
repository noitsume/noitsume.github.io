import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { saveOwnedStudioSettings, studioSettingsRequestSchema } from "@/lib/studio";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const input = studioSettingsRequestSchema.parse(await request.json());
    const result = await saveOwnedStudioSettings(session.uid, id, input);
    return apiOk(result, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "PATCH /api/rooms/[id]/studio/settings");
  }
}
