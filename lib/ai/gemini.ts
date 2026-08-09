import "server-only";

import { GoogleGenAI } from "@google/genai";
import { getServerEnv } from "@/lib/env/server";
import { withTimeout } from "@/lib/utils/timeout";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  const env = getServerEnv();
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY belum diisi.");
  }

  client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  return client;
}

export function getGeminiModelConfig() {
  const env = getServerEnv();
  return {
    textModel: env.GEMINI_TEXT_MODEL ?? "gemini-3.5-flash-lite",
    imageModel: env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image",
    timeoutMs: env.GEMINI_TIMEOUT_MS,
  };
}

export async function runGeminiHealthCheck(): Promise<string> {
  const ai = getGeminiClient();
  const { textModel, timeoutMs } = getGeminiModelConfig();
  const response = await withTimeout(
    ai.models.generateContent({
      model: textModel,
      contents: "Balas tepat dengan kata: OK",
    }),
    timeoutMs,
    "Gemini health check timeout",
  );

  return response.text?.trim() ?? "";
}
