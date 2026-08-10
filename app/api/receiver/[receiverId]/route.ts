import type { NextRequest } from "next/server";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";
import { getPublishedReceiver } from "@/lib/receiver";

type RouteContext = { params: Promise<{ receiverId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const { receiverId } = await context.params;
    const manifest = await getPublishedReceiver(receiverId);
    return apiOk({ manifest }, requestId, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return apiErrorResponse(error, requestId, "GET /api/receiver/[receiverId]");
  }
}
