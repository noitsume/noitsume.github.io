import { requireOwnerSession } from "@/lib/auth/session";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { previewOwnedReceiver } from "@/lib/receiver/service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId();
  try {
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const response = apiOk(await previewOwnedReceiver(session.uid, id), requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return apiErrorResponse(error, requestId, "GET /api/rooms/[id]/studio/preview");
  }
}
