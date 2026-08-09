import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().min(1).optional(),
);
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email().optional(),
);
const optionalPositiveInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: optionalUrl,
  NEXT_PUBLIC_FIREBASE_API_KEY: optionalString,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalString,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalString,
  NEXT_PUBLIC_FIREBASE_APP_ID: optionalString,
});

export const serverEnvSchema = clientEnvSchema.extend({
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: optionalEmail,
  FIREBASE_PRIVATE_KEY: optionalString,

  B2_ENDPOINT: optionalUrl,
  B2_REGION: optionalString,
  B2_KEY_ID: optionalString,
  B2_APPLICATION_KEY: optionalString,
  B2_BUCKET: optionalString,

  GEMINI_API_KEY: optionalString,
  GEMINI_TEXT_MODEL: optionalString,
  GEMINI_IMAGE_MODEL: optionalString,
  GEMINI_TIMEOUT_MS: optionalPositiveInt.default(8_000),

  SESSION_COOKIE_NAME: z.string().min(1).default("kenangin_session"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;


export const firebaseAdminEnvSchema = serverEnvSchema.pick({
  FIREBASE_PROJECT_ID: true,
  FIREBASE_CLIENT_EMAIL: true,
  FIREBASE_PRIVATE_KEY: true,
});

export const b2EnvSchema = serverEnvSchema.pick({
  B2_ENDPOINT: true,
  B2_REGION: true,
  B2_KEY_ID: true,
  B2_APPLICATION_KEY: true,
  B2_BUCKET: true,
});

export const geminiEnvSchema = serverEnvSchema.pick({
  GEMINI_API_KEY: true,
  GEMINI_TEXT_MODEL: true,
  GEMINI_IMAGE_MODEL: true,
  GEMINI_TIMEOUT_MS: true,
});

export const sessionEnvSchema = serverEnvSchema.pick({
  SESSION_COOKIE_NAME: true,
});

export type FirebaseAdminEnv = z.infer<typeof firebaseAdminEnvSchema>;
export type B2Env = z.infer<typeof b2EnvSchema>;
export type GeminiEnv = z.infer<typeof geminiEnvSchema>;
