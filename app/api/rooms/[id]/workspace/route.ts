import { requireOwnerSession } from "@/lib/auth/session";
import { getOwnedWorkspaceMedia } from "@/lib/collector";
import { getOwnedRoom } from "@/lib/rooms";
import { apiOk, apiErrorResponse, createRequestId } from "@/lib/http";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = createRequestId();
  try { const session = await requireOwnerSession(); const { id } = await params; const [room, workspace] = await Promise.all([getOwnedRoom(session.uid, id), getOwnedWorkspaceMedia(session.uid, id)]); const response = apiOk({ room, workspace }, requestId); response.headers.set("cache-control", "private, no-store"); return response; }
  catch (error) { return apiErrorResponse(error, requestId, "workspace refresh"); }
}
