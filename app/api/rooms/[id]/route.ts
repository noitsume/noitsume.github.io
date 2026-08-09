import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError, apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import {
  deleteOwnedRoom,
  getOwnedRoom,
  updateOwnedRoom,
  updateRoomRequestSchema,
} from "@/lib/rooms";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  void _request;
  const requestId = createRequestId();
  try {
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const room = await getOwnedRoom(session.uid, id);
    return apiOk({ room }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "GET /api/rooms/[id]");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    const patch = updateRoomRequestSchema.parse(await request.json());
    if (patch.themeId) {
      const theme = await backendRepositories.themes.getTheme(patch.themeId);
      if (!theme) {
        throw new ApiError("THEME_NOT_FOUND", "Tema yang dipilih tidak tersedia.", 400);
      }
    }
    const room = await updateOwnedRoom(session.uid, id, patch);
    return apiOk({ room }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "PATCH /api/rooms/[id]");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const { id } = await context.params;
    await deleteOwnedRoom(session.uid, id);
    return apiOk({ deleted: true }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "DELETE /api/rooms/[id]");
  }
}
