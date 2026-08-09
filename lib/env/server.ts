import {
  b2EnvSchema,
  firebaseAdminEnvSchema,
  geminiEnvSchema,
  serverEnvSchema,
  sessionEnvSchema,
  type B2Env,
  type FirebaseAdminEnv,
  type GeminiEnv,
  type ServerEnv,
} from "./schema";

function serverOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Server environment helper must only run on the server.");
  }
}

export function getServerEnv(): ServerEnv {
  serverOnly();
  return serverEnvSchema.parse(process.env);
}

export function getFirebaseAdminEnv(): FirebaseAdminEnv {
  serverOnly();
  return firebaseAdminEnvSchema.parse(process.env);
}

export function getB2Env(): B2Env {
  serverOnly();
  return b2EnvSchema.parse(process.env);
}

export function getGeminiEnv(): GeminiEnv {
  serverOnly();
  return geminiEnvSchema.parse(process.env);
}

export function getSessionCookieNameFromEnv() {
  serverOnly();
  return sessionEnvSchema.parse(process.env).SESSION_COOKIE_NAME;
}
