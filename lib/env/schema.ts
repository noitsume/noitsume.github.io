import { z } from "zod";

const optionalString = z.string().min(1).optional();
const optionalUrl = z.string().url().optional();

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalString,
});

export const serverEnvSchema = clientEnvSchema.extend({
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: optionalString,

  B2_ENDPOINT: optionalUrl,
  B2_REGION: optionalString,
  B2_KEY_ID: optionalString,
  B2_APPLICATION_KEY: optionalString,
  B2_INGEST_BUCKET: optionalString,
  B2_PUBLIC_BUCKET: optionalString,

  GEMINI_API_KEY: optionalString,
  GEMINI_TEXT_MODEL: optionalString,
  GEMINI_IMAGE_MODEL: optionalString,

  WORKER_DISPATCH_TOKEN: optionalString,
  WORKER_REPOSITORY: optionalString,
  WORKER_WORKFLOW: optionalString,

  SESSION_COOKIE_NAME: z.string().min(1).default("kenangin_session"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
