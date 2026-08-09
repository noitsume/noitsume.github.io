import { apiOk, createRequestId } from "@/lib/http";
import { getServerEnv } from "@/lib/env/server";

function configured(...values: Array<string | undefined>) {
  return values.every(Boolean);
}

export async function GET() {
  const env = getServerEnv();
  const requestId = createRequestId();

  return apiOk(
    {
      app: "kenangin",
      status: "ok",
      services: {
        firebaseClient: configured(
          env.NEXT_PUBLIC_FIREBASE_API_KEY,
          env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          env.NEXT_PUBLIC_FIREBASE_APP_ID,
        ),
        firebaseAdmin: configured(
          env.FIREBASE_PROJECT_ID,
          env.FIREBASE_CLIENT_EMAIL,
          env.FIREBASE_PRIVATE_KEY,
        ),
        backblazeB2: configured(
          env.B2_ENDPOINT,
          env.B2_REGION,
          env.B2_KEY_ID,
          env.B2_APPLICATION_KEY,
          env.B2_BUCKET,
        ),
        gemini: Boolean(env.GEMINI_API_KEY),
      },
      mediaDelivery: {
        origin: "backblaze-b2-private",
        authorization: "presigned-url",
        browserCacheFoundation: "cache-storage+indexeddb",
      },
    },
    requestId,
  );
}
