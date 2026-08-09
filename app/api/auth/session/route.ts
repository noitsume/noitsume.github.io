import { z } from "zod";
import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import {
  expiredSessionCookieOptions,
  getSessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  SESSION_DURATION_MS,
  SESSION_RECENT_SIGN_IN_SECONDS,
} from "@/lib/auth/constants";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { ApiError, apiFail, apiOk, createRequestId } from "@/lib/http";

const sessionRequestSchema = z.object({
  idToken: z.string().min(1),
});

function handleError(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return apiFail(error.code, error.message, error.status, requestId);
  }
  if (error instanceof z.ZodError) {
    return apiFail("INVALID_REQUEST", "Data login tidak valid.", 400, requestId);
  }
  console.error(`[${requestId}] auth/session`, error);
  return apiFail("AUTH_FAILED", "Sesi login tidak dapat dibuat.", 401, requestId);
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    assertCsrf(request);
    const input = sessionRequestSchema.parse(await request.json());
    const adminAuth = getFirebaseAdminAuth();
    const decoded = await adminAuth.verifyIdToken(input.idToken);

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      typeof decoded.auth_time !== "number" ||
      nowSeconds - decoded.auth_time > SESSION_RECENT_SIGN_IN_SECONDS
    ) {
      throw new ApiError(
        "STALE_SIGN_IN",
        "Login sudah terlalu lama. Silakan login ulang.",
        401,
      );
    }

    const authUser = await adminAuth.getUser(decoded.uid);
    const email = authUser.email ?? decoded.email ?? "";
    if (!email) {
      throw new ApiError("EMAIL_REQUIRED", "Akun harus memiliki email.", 400);
    }

    const displayName =
      authUser.displayName?.trim() || email.split("@")[0] || "Owner";
    const photoURL = authUser.photoURL ?? null;

    const profile = await backendRepositories.users.upsertUser({
      uid: decoded.uid,
      displayName,
      email,
      photoURL,
    });

    const sessionCookie = await adminAuth.createSessionCookie(input.idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = apiOk({ user: profile }, requestId);
    response.cookies.set(
      getSessionCookieName(),
      sessionCookie,
      sessionCookieOptions(),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleError(error, requestId);
  }
}

export async function DELETE(request: NextRequest) {
  const requestId = createRequestId();

  try {
    assertCsrf(request);
    const response = apiOk({ signedOut: true }, requestId);
    response.cookies.set(
      getSessionCookieName(),
      "",
      expiredSessionCookieOptions(),
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return handleError(error, requestId);
  }
}
