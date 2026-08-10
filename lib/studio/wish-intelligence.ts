import "server-only";

import { createHash } from "node:crypto";
import { Type } from "@google/genai";
import { getGeminiClient, getGeminiModelConfig } from "@/lib/ai";
import type { Submission } from "@/lib/data/contracts";
import { withTimeout } from "@/lib/utils/timeout";
import {
  wishIntelligenceRecordSchema,
  type WishIntelligenceLabel,
  type WishIntelligenceRecord,
} from "./contracts";

const WISH_LABELS = [
  "funny",
  "sentimental",
  "intimate",
  "celebratory",
  "reflective",
  "closing-worthy",
] as const;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          submissionId: { type: Type.STRING },
          labels: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...WISH_LABELS] } },
          emotionalWeight: { type: Type.NUMBER },
          closingWorthiness: { type: Type.NUMBER },
        },
        required: ["submissionId", "labels", "emotionalWeight", "closingWorthiness"],
      },
    },
  },
  required: ["items"],
} as const;

type RawWish = {
  submissionId: string;
  labels: WishIntelligenceLabel[];
  emotionalWeight: number;
  closingWorthiness: number;
};

function hashWish(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function fallbackWish(submissionId: string, text: string, sourceHash: string): WishIntelligenceRecord {
  const lower = text.toLowerCase();
  const labels = new Set<WishIntelligenceLabel>();
  if (/\b(haha|hehe|wkwk|lol|ngakak|lucu)\b/.test(lower)) labels.add("funny");
  if (/\b(selamat|congrats|congratulations|bangga|keren|mantap|wisuda|ulang tahun|birthday)\b/.test(lower)) labels.add("celebratory");
  if (/\b(sayang|cinta|love|sahabat|bestie|keluarga|kakak|adik)\b/.test(lower)) labels.add("intimate");
  if (/\b(ingat|dulu|kenangan|memory|masa|perjalanan|pernah)\b/.test(lower)) labels.add("reflective");
  if (/\b(terima kasih|makasih|thank|rindu|kangen|haru|banget)\b/.test(lower) || text.length >= 120) labels.add("sentimental");
  if (/\b(semoga|sukses|selalu|kedepan|ke depan|doa|wish|bahagia|sehat)\b/.test(lower)) labels.add("closing-worthy");
  if (labels.size === 0) labels.add(text.length >= 90 ? "sentimental" : "celebratory");

  const emotionalWeight = clamp01(0.3 + Math.min(text.length, 260) / 520 + (labels.has("sentimental") || labels.has("intimate") ? 0.18 : 0));
  const closingWorthiness = clamp01((labels.has("closing-worthy") ? 0.72 : 0.24) + (labels.has("sentimental") ? 0.12 : 0));
  return wishIntelligenceRecordSchema.parse({
    submissionId,
    sourceHash,
    version: "wish-v1",
    mode: "fallback",
    labels: Array.from(labels),
    emotionalWeight,
    closingWorthiness,
    analyzedAt: new Date().toISOString(),
  });
}

export async function ensureWishIntelligence(
  existing: Record<string, WishIntelligenceRecord>,
  submissions: Submission[],
): Promise<Record<string, WishIntelligenceRecord>> {
  const wishes = submissions
    .filter((item) => item.status === "approved" && item.message?.trim())
    .map((item) => ({ submissionId: item.id, text: item.message!.trim(), sourceHash: hashWish(item.message!.trim()) }));

  const result: Record<string, WishIntelligenceRecord> = {};
  const missing = wishes.filter((wish) => {
    const cached = existing[wish.submissionId];
    if (cached?.version === "wish-v1" && cached.sourceHash === wish.sourceHash) {
      result[wish.submissionId] = cached;
      return false;
    }
    return true;
  });
  if (missing.length === 0) return result;

  try {
    const ai = getGeminiClient();
    const { textModel, timeoutMs } = getGeminiModelConfig();
    const response = await withTimeout(
      ai.models.generateContent({
        model: textModel,
        contents: [
          "Classify contributor wishes for a private celebration experience. Do not rewrite the wishes.",
          "Use only these labels: funny, sentimental, intimate, celebratory, reflective, closing-worthy.",
          "emotionalWeight and closingWorthiness must be 0..1. Return every supplied submissionId exactly once.",
          JSON.stringify(missing.map(({ submissionId, text }) => ({ submissionId, text }))),
        ].join("\n"),
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.18,
        },
      }),
      Math.max(timeoutMs, 20_000),
      "Gemini Wish Intelligence timeout",
    );
    const parsed = JSON.parse(response.text?.trim() || "{}") as { items?: RawWish[] };
    const byId = new Map((parsed.items ?? []).map((item) => [item.submissionId, item]));
    for (const wish of missing) {
      const raw = byId.get(wish.submissionId);
      if (!raw) {
        result[wish.submissionId] = fallbackWish(wish.submissionId, wish.text, wish.sourceHash);
        continue;
      }
      result[wish.submissionId] = wishIntelligenceRecordSchema.parse({
        submissionId: wish.submissionId,
        sourceHash: wish.sourceHash,
        version: "wish-v1",
        mode: "gemini",
        labels: Array.from(new Set(raw.labels)).slice(0, 6),
        emotionalWeight: clamp01(raw.emotionalWeight),
        closingWorthiness: clamp01(raw.closingWorthiness),
        analyzedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Wish Intelligence fallback", error);
    for (const wish of missing) {
      result[wish.submissionId] = fallbackWish(wish.submissionId, wish.text, wish.sourceHash);
    }
  }

  return result;
}
