import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";

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
  const ai = new GoogleGenAI({ apiKey: required("GEMINI_API_KEY") });
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash-lite";
  const response = await ai.models.generateContent({
    model,
    contents: "Reply with exactly OK",
  });
  if (!response.text?.toUpperCase().includes("OK")) {
    throw new Error("Gemini merespons, tetapi health response tidak sesuai.");
  }
  console.log(`✓ Gemini API (${model})`);
}

const checks = [checkFirebase, checkB2, checkGemini];
let failed = false;

for (const check of checks) {
  try {
    await check();
  } catch (error) {
    failed = true;
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) process.exitCode = 1;
else console.log("\nSemua fondasi Patch 2 terhubung (B2 direct, tanpa Cloudflare).");
