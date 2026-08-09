import { z } from "zod";
import type { NextRequest } from "next/server";
import { assertCsrf } from "@/lib/auth/csrf";
import { requireOwnerSession } from "@/lib/auth/session";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { apiErrorResponse, apiOk, createRequestId } from "@/lib/http";

const profileRequestSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Nama pengguna minimal 2 karakter.")
    .max(32, "Nama pengguna maksimal 32 karakter."),
});

function normalizeUsername(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    assertCsrf(request);
    const session = await requireOwnerSession();
    const input = profileRequestSchema.parse(await request.json());
    const username = normalizeUsername(input.username);

    const profile = await backendRepositories.users.upsertUser({
      uid: session.uid,
      username,
      displayName: username,
      email: session.email,
      photoURL: session.photoURL,
    });

    return apiOk({ user: profile }, requestId);
  } catch (error) {
    return apiErrorResponse(error, requestId, "POST /api/auth/profile");
  }
}
