import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/http";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./constants";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new ApiError("INVALID_ORIGIN", "Origin request tidak tersedia.", 403);
  }

  const requestOrigin = new URL(request.url).origin;
  if (origin !== requestOrigin) {
    throw new ApiError("INVALID_ORIGIN", "Origin request tidak diizinkan.", 403);
  }
}

export function assertCsrf(request: NextRequest) {
  assertSameOrigin(request);

  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new ApiError("INVALID_CSRF", "Token keamanan tidak valid.", 403);
  }
}
