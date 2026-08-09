import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getServerEnv } from "@/lib/env/server";
import { ApiError } from "@/lib/http";
import { SESSION_DURATION_SECONDS } from "./constants";

export type OwnerSession = {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
};

function sessionCookieName() {
  return getServerEnv().SESSION_COOKIE_NAME;
}

function claimsToOwnerSession(claims: DecodedIdToken): OwnerSession {
  const email = typeof claims.email === "string" ? claims.email : "";
  const displayName =
    typeof claims.name === "string" && claims.name.trim()
      ? claims.name.trim()
      : email.split("@")[0] || "Owner";

  return {
    uid: claims.uid,
    email,
    displayName,
    photoURL: typeof claims.picture === "string" ? claims.picture : null,
  };
}

export async function getOwnerSession(): Promise<OwnerSession | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(sessionCookieName())?.value;
  if (!value) return null;

  try {
    const claims = await getFirebaseAdminAuth().verifySessionCookie(value, false);
    return claimsToOwnerSession(claims);
  } catch {
    return null;
  }
}

export async function requireOwnerSession(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session) {
    throw new ApiError("UNAUTHENTICATED", "Silakan login terlebih dahulu.", 401);
  }
  return session;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
    priority: "high" as const,
  };
}

export function expiredSessionCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
  };
}

export function getSessionCookieName() {
  return sessionCookieName();
}
