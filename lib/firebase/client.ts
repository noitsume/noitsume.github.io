import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getClientEnv } from "@/lib/env";

function requireFirebaseClientConfig() {
  const env = getClientEnv();
  const missing = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", env.NEXT_PUBLIC_FIREBASE_API_KEY],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", env.NEXT_PUBLIC_FIREBASE_PROJECT_ID],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", env.NEXT_PUBLIC_FIREBASE_APP_ID],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Firebase client belum dikonfigurasi. Isi: ${missing.join(", ")}`,
    );
  }

  return {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };
}

export function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  return initializeApp(requireFirebaseClientConfig());
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientFirestore(): Firestore {
  return getFirestore(getFirebaseClientApp());
}
