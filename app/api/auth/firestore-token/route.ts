import { requireOwnerSession } from "@/lib/auth/session";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

export async function GET() {
  const requestId = createRequestId();
  try {
    const session = await requireOwnerSession();
    const token = await getFirebaseAdminAuth().createCustomToken(session.uid, {
      kenanginOwner: true,
    });
    const response = apiOk({ token }, requestId);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return apiErrorResponse(error, requestId, "GET /api/auth/firestore-token");
  }
}
