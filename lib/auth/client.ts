"use client";

import type { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

const CSRF_CLIENT_CACHE_MS = 10 * 60 * 1000;
let csrfCache: { token: string; expiresAt: number } | null = null;
let csrfInFlight: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  const now = Date.now();
  if (csrfCache && csrfCache.expiresAt > now) return csrfCache.token;
  if (csrfInFlight) return csrfInFlight;

  csrfInFlight = (async () => {
    const response = await fetch("/api/auth/csrf", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const payload = await response.json();

    if (!response.ok || !payload?.ok || !payload?.data?.csrfToken) {
      throw new Error(payload?.error?.message ?? "Gagal menyiapkan token keamanan.");
    }

    const token = payload.data.csrfToken as string;
    csrfCache = { token, expiresAt: Date.now() + CSRF_CLIENT_CACHE_MS };
    return token;
  })();

  try {
    return await csrfInFlight;
  } finally {
    csrfInFlight = null;
  }
}

export async function createServerSession(user: User) {
  const csrfToken = await getCsrfToken();
  const idToken = await user.getIdToken(true);

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    },
    credentials: "same-origin",
    body: JSON.stringify({ idToken }),
  });

  const payload = await response.json();
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "Gagal membuat sesi login.");
  }

  await signOut(getFirebaseClientAuth());
  return payload.data;
}

export async function destroyServerSession() {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    headers: {
      "x-csrf-token": csrfToken,
    },
    credentials: "same-origin",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "Gagal keluar dari akun.");
  }

  csrfCache = null;
}

export async function saveOwnerUsername(username: string) {
  const csrfToken = await getCsrfToken();
  const response = await fetch("/api/auth/profile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrf-token": csrfToken,
    },
    credentials: "same-origin",
    body: JSON.stringify({ username }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error?.message ?? "Nama pengguna belum dapat disimpan.");
  }

  return payload.data;
}
