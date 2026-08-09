import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { CSRF_COOKIE_NAME } from "@/lib/auth/constants";
import { apiOk, createRequestId } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();
  const csrfToken = randomBytes(32).toString("hex");
  const response = apiOk({ csrfToken }, requestId);

  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60,
  });

  response.headers.set("Cache-Control", "no-store");
  return response;
}
