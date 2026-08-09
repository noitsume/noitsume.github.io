"use client";

import type { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json();

  if (!response.ok || !payload?.ok || !payload?.data?.csrfToken) {
    throw new Error(payload?.error?.message ?? "Gagal menyiapkan token keamanan.");
  }

  return payload.data.csrfToken as string;
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
}
