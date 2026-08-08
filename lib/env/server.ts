import { serverEnvSchema, type ServerEnv } from "./schema";

export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must only run on the server.");
  }

  return serverEnvSchema.parse(process.env);
}
