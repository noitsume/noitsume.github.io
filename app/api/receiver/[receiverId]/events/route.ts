import { z } from "zod";
import type { NextRequest } from "next/server";
import { assertSameOrigin } from "@/lib/auth/csrf";
import { apiOk, apiErrorResponse, createRequestId } from "@/lib/http";
import { consumeRateLimit, publicRequestKey, readBoundedJson } from "@/lib/http/rate-limit";
import { recordReceiverEvent } from "@/lib/receiver/analytics";
const eventSchema = z.object({ viewer: z.string().uuid(), type: z.enum(["open", "watch_threshold"]) });
export async function POST(request: NextRequest, { params }: { params: Promise<{ receiverId: string }> }) {
  const requestId = createRequestId();
  try {
    assertSameOrigin(request);
    const { receiverId } = await params;
    const input = eventSchema.parse(await readBoundedJson(request, 2048));
    await consumeRateLimit(publicRequestKey(request, "analytics:" + receiverId), 120, 3600000);
    await recordReceiverEvent(receiverId, input.viewer, input.type);
    return apiOk({ recorded: true }, requestId);
  } catch (error) { return apiErrorResponse(error, requestId, "receiver analytics"); }
}
