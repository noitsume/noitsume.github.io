import "server-only";

import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "@/lib/env/server";

let client: S3Client | null = null;

function requireB2Config() {
  const env = getServerEnv();
  const missing = [
    ["B2_ENDPOINT", env.B2_ENDPOINT],
    ["B2_REGION", env.B2_REGION],
    ["B2_KEY_ID", env.B2_KEY_ID],
    ["B2_APPLICATION_KEY", env.B2_APPLICATION_KEY],
    ["B2_BUCKET", env.B2_BUCKET],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Backblaze B2 belum dikonfigurasi. Isi: ${missing.join(", ")}`);
  }

  return env;
}

export function getB2Client(): S3Client {
  if (client) return client;

  const env = requireB2Config();
  client = new S3Client({
    endpoint: env.B2_ENDPOINT,
    region: env.B2_REGION,
    credentials: {
      accessKeyId: env.B2_KEY_ID!,
      secretAccessKey: env.B2_APPLICATION_KEY!,
    },
    forcePathStyle: false,
  });

  return client;
}

export function getB2BucketName() {
  return requireB2Config().B2_BUCKET!;
}

export async function assertB2BucketReachable() {
  await getB2Client().send(
    new HeadBucketCommand({ Bucket: getB2BucketName() }),
  );
}

export async function createIngestUploadUrl(input: {
  objectKey: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const expiresIn = clampPresignExpiry(input.expiresInSeconds ?? 900);
  const command = new PutObjectCommand({
    Bucket: getB2BucketName(),
    Key: input.objectKey,
    ContentType: input.contentType,
    CacheControl: "private, max-age=0",
  });

  return getSignedUrl(getB2Client(), command, {
    expiresIn,
    signableHeaders: new Set(["content-type"]),
  });
}

export async function createPrivateDownloadUrl(input: {
  objectKey: string;
  expiresInSeconds?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: getB2BucketName(),
    Key: input.objectKey,
  });

  return getSignedUrl(getB2Client(), command, {
    expiresIn: clampPresignExpiry(input.expiresInSeconds ?? 900),
  });
}

function clampPresignExpiry(value: number) {
  return Math.min(Math.max(Math.floor(value), 60), 900);
}
