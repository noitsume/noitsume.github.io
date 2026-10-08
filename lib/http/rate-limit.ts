import "server-only";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "@/lib/data/firestore/shared";
import { ApiError } from "./api-error";

// Shared by all server instances. Expired buckets can be removed with the maintenance script.
export async function consumeRateLimit(scope: string, limit: number, windowMs: number, cost = 1) {
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const key = createHash("sha256").update(scope + ":" + window).digest("hex");
  const db = firestoreDb();
  const ref = db.collection("requestLimits").doc(key);
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    const count = Number(snapshot.data()?.count ?? 0);
    if (count + cost > limit) throw new ApiError("RATE_LIMITED", "Batas permintaan sementara tercapai. Coba lagi setelah beberapa saat.", 429);
    tx.set(ref, { count: count + cost, expiresAt: Timestamp.fromMillis((window + 1) * windowMs) });
  });
}

export function publicRequestKey(request: Request, scope: string) {
  // Store only a digest in Firestore, never the raw address.
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return scope + ":" + address;
}

export async function readBoundedJson(request: Request, maxBytes = 6 * 1024 * 1024) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("BODY_REQUIRED", "Data kiriman kosong.", 400);
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new ApiError("BODY_TOO_LARGE", "Data kiriman terlalu besar.", 413); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError("INVALID_JSON", "Data kiriman tidak valid.", 400); }
}
