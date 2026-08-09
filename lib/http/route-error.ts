import { z } from "zod";
import { ApiError } from "./api-error";
import { apiFail } from "./api-response";

export function apiErrorResponse(
  error: unknown,
  requestId: string,
  context: string,
) {
  if (error instanceof ApiError) {
    return apiFail(error.code, error.message, error.status, requestId);
  }

  if (error instanceof z.ZodError) {
    return apiFail(
      "INVALID_REQUEST",
      error.issues[0]?.message ?? "Data request tidak valid.",
      400,
      requestId,
    );
  }

  console.error(`[${requestId}] ${context}`, error);
  return apiFail(
    "INTERNAL_ERROR",
    "Terjadi kesalahan di server. Coba lagi sebentar.",
    500,
    requestId,
  );
}
