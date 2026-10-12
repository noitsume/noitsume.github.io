import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    model: { type: "string" },
    "only-gemini": { type: "boolean", default: false },
    "timeout-ms": { type: "string", default: "30000" },
  },
});
const timeoutMs = Number(values["timeout-ms"]);
if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
  throw new Error("--timeout-ms harus berupa angka antara 1000 dan 120000.");
}

function describeFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  // SDK errors sometimes wrap the HTTP status in a JSON string.
  let status = error?.status ?? error?.code;
  try { status ??= JSON.parse(message).error?.code; } catch { /* Plain-text error. */ }
  const hint = {
    400: "Periksa nama model dan parameter; baca pesan API untuk memastikan apakah key ditolak.",
    401: "Autentikasi ditolak; periksa API key.",
    403: "Akses ditolak; periksa izin key, project, dan akses model.",
    404: "Model atau endpoint tidak ditemukan untuk request ini.",
    429: "Kuota/rate limit tercapai. Periksa tier dan kuota model; mengganti key pada project yang sama tidak menambah kuota.",
    503: "Model sedang sibuk/tidak tersedia. Ini bukan pesan API key tidak valid.",
  }[status];
  const safeMessage = process.env.GEMINI_API_KEY
    ? message.replaceAll(process.env.GEMINI_API_KEY, "[redacted]")
    : message;
  return `${safeMessage}${hint ? `\n  ${hint}` : ""}`;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diisi di .env.local`);
  return value;
}

async function checkFirebase() {
  const projectId = required("FIREBASE_PROJECT_ID");
  const clientEmail = required("FIREBASE_CLIENT_EMAIL");
  const privateKey = required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  await getFirestore(app).listCollections();
  console.log("✓ Firebase Admin / Firestore");
}

async function checkB2() {
  const client = new S3Client({
    endpoint: required("B2_ENDPOINT"),
    region: required("B2_REGION"),
    credentials: {
      accessKeyId: required("B2_KEY_ID"),
      secretAccessKey: required("B2_APPLICATION_KEY"),
    },
  });

  const bucket = required("B2_BUCKET");
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`✓ Backblaze B2 private bucket: ${bucket}`);
}

async function checkGemini() {
  const ai = new GoogleGenAI({
    apiKey: required("GEMINI_API_KEY"),
    httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
  });
  const model = values.model?.trim() || process.env.GEMINI_TEXT_MODEL?.trim() || "gemini-3.6-flash";
  console.log(`… Gemini API (${model}), satu percobaan, timeout ${timeoutMs / 1_000}s`);
  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model,
    contents: "Reply with exactly OK",
    config: { maxOutputTokens: 1_024 },
  });
  if (!response.text?.toUpperCase().includes("OK")) {
    throw new Error("Gemini merespons, tetapi health response tidak sesuai.");
  }
  console.log(`✓ Gemini API (${model}) — ${((Date.now() - startedAt) / 1_000).toFixed(1)}s`);
}

const checks = values["only-gemini"] ? [checkGemini] : [checkFirebase, checkB2, checkGemini];
let failed = false;

for (const check of checks) {
  try {
    await check();
  } catch (error) {
    failed = true;
    console.error(`✗ ${describeFailure(error)}`);
  }
}

if (failed) process.exitCode = 1;
else console.log(values["only-gemini"] ? "\nGemini berhasil merespons." : "\nFirebase, B2, dan Gemini berhasil diakses.");
