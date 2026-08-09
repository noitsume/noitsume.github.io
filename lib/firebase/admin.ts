import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getServerEnv } from "@/lib/env/server";

function requireFirebaseAdminCredentials() {
  const env = getServerEnv();
  const missing = [
    ["FIREBASE_PROJECT_ID", env.FIREBASE_PROJECT_ID],
    ["FIREBASE_CLIENT_EMAIL", env.FIREBASE_CLIENT_EMAIL],
    ["FIREBASE_PRIVATE_KEY", env.FIREBASE_PRIVATE_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Firebase Admin belum dikonfigurasi. Isi: ${missing.join(", ")}`,
    );
  }

  return {
    projectId: env.FIREBASE_PROJECT_ID!,
    clientEmail: env.FIREBASE_CLIENT_EMAIL!,
    privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  };
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const credentials = requireFirebaseAdminCredentials();
  return initializeApp({
    credential: cert(credentials),
    projectId: credentials.projectId,
  });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
