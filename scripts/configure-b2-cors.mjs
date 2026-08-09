import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diisi di .env.local`);
  return value;
}

const appUrl = required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
const endpoint = required("B2_ENDPOINT");
const region = required("B2_REGION");
const keyId = required("B2_SETUP_KEY_ID");
const applicationKey = required("B2_SETUP_APPLICATION_KEY");
const bucket = required("B2_BUCKET");

const origins = new Set([
  appUrl,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
for (const origin of (process.env.B2_CORS_EXTRA_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)) {
  origins.add(origin.replace(/\/$/, ""));
}

const client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId: keyId,
    secretAccessKey: applicationKey,
  },
});

await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: {
      CORSRules: [
        {
          ID: "kenangin-browser-presigned-access",
          AllowedOrigins: [...origins],
          AllowedMethods: ["GET", "HEAD", "PUT"],
          AllowedHeaders: ["*"],
          ExposeHeaders: [
            "ETag",
            "Content-Length",
            "Content-Type",
            "Content-Range",
          ],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  }),
);

console.log(`✓ B2 CORS configured: ${bucket}`);
console.log("  Allowed methods: GET, HEAD, PUT");
console.log("  Origins:");
for (const origin of origins) console.log(`    - ${origin}`);
