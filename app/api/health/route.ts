import { apiOk, createRequestId } from "@/lib/http";
import {
  b2EnvSchema,
  clientEnvSchema,
  firebaseAdminEnvSchema,
  geminiEnvSchema,
} from "@/lib/env/schema";

function configured(names: string[]) {
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

function validationIssues(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }) {
  if (result.success || !result.error) return [] as string[];
  return [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "unknown")))];
}

export async function GET() {
  const requestId = createRequestId();

  const firebaseClientResult = clientEnvSchema.safeParse(process.env);
  const firebaseAdminResult = firebaseAdminEnvSchema.safeParse(process.env);
  const b2Result = b2EnvSchema.safeParse(process.env);
  const geminiResult = geminiEnvSchema.safeParse(process.env);

  const invalidEnvironmentVariables = [
    ...validationIssues(firebaseClientResult),
    ...validationIssues(firebaseAdminResult),
    ...validationIssues(b2Result),
    ...validationIssues(geminiResult),
  ];

  return apiOk(
    {
      app: "kenangin",
      status: invalidEnvironmentVariables.length === 0 ? "ok" : "configuration-warning",
      services: {
        firebaseClient:
          firebaseClientResult.success &&
          configured([
            "NEXT_PUBLIC_FIREBASE_API_KEY",
            "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
            "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
            "NEXT_PUBLIC_FIREBASE_APP_ID",
          ]),
        firebaseAdmin:
          firebaseAdminResult.success &&
          configured([
            "FIREBASE_PROJECT_ID",
            "FIREBASE_CLIENT_EMAIL",
            "FIREBASE_PRIVATE_KEY",
          ]),
        backblazeB2:
          b2Result.success &&
          configured([
            "B2_ENDPOINT",
            "B2_REGION",
            "B2_KEY_ID",
            "B2_APPLICATION_KEY",
            "B2_BUCKET",
          ]),
        gemini: geminiResult.success && configured(["GEMINI_API_KEY"]),
      },
      invalidEnvironmentVariables: [...new Set(invalidEnvironmentVariables)],
      mediaDelivery: {
        origin: "backblaze-b2-private",
        authorization: "presigned-url",
        browserCacheFoundation: "cache-storage+indexeddb",
      },
    },
    requestId,
  );
}
