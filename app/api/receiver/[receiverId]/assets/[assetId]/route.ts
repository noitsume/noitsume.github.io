import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse, createRequestId } from "@/lib/http";
import { resolvePublishedReceiverAsset } from "@/lib/receiver";

type RouteContext = { params: Promise<{ receiverId: string; assetId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const requestId = createRequestId();
  try {
    const { receiverId, assetId } = await context.params;
    const resolved = await resolvePublishedReceiverAsset(receiverId, assetId);
    const target = resolved.source === "public"
      ? new URL(resolved.path, request.url)
      : new URL(resolved.url);
    const response = NextResponse.redirect(target, 307);
    response.headers.set("cache-control", "public, max-age=60, stale-while-revalidate=120");
    response.headers.set("x-kenangin-asset", assetId);
    return response;
  } catch (error) {
    return apiErrorResponse(error, requestId, "GET /api/receiver/[receiverId]/assets/[assetId]");
  }
}
