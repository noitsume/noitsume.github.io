import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { ApiError, apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { createRoomRequestSchema } from "@/lib/rooms";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  try {
    const session = await requireOwnerSession();
    const rooms = await backendRepositories.rooms.listRooms(session.uid);
    return apiOk({ rooms }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "GET /api/rooms");
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const input = createRoomRequestSchema.parse(await request.json());
    const theme = await backendRepositories.themes.getTheme(input.themeId);
    if (!theme) {
      throw new ApiError("THEME_NOT_FOUND", "Tema yang dipilih tidak tersedia.", 400);
    }
    const room = await backendRepositories.rooms.createRoom(session.uid, input);
    return apiOk({ room }, requestId, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/rooms");
  }
}
