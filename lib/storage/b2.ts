import "server-only";

import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getB2Env } from "@/lib/env/server";

let client: S3Client | null = null;

function requireB2Config() {
  const env = getB2Env();
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

export async function headPrivateObject(objectKey: string) {
  return getB2Client().send(
    new HeadObjectCommand({ Bucket: getB2BucketName(), Key: objectKey }),
  );
}

export async function deletePrivateObjects(objectKeys: string[]) {
  const uniqueKeys = Array.from(new Set(objectKeys.filter(Boolean)));
  if (uniqueKeys.length === 0) return;

  // Backblaze B2 keeps object versions. A plain DeleteObjects call without a
  // VersionId only creates a delete marker, so the bytes can remain visible in
  // the B2 console. For temporary submission objects and explicit deletes we
  // purge every version of the exact key instead.
  for (const objectKey of uniqueKeys) {
    const versions = (await listPrivateObjectVersions(objectKey)).filter(
      (item) => item.Key === objectKey,
    );
    await deleteVersionedPrivateObjects(versions);

    const remaining = (await listPrivateObjectVersions(objectKey)).filter(
      (item) => item.Key === objectKey,
    );
    if (remaining.length > 0) {
      throw new Error(`Object B2 ${objectKey} belum terhapus permanen.`);
    }
  }
}


type VersionedObjectRef = {
  Key: string;
  VersionId?: string;
};

async function listPrivateObjectVersions(prefix: string): Promise<VersionedObjectRef[]> {
  const bucket = getB2BucketName();
  const objects: VersionedObjectRef[] = [];
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;

  do {
    const result = await getB2Client().send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        Prefix: prefix,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
        MaxKeys: 1000,
      }),
    );

    for (const item of [...(result.Versions ?? []), ...(result.DeleteMarkers ?? [])]) {
      if (!item.Key || !item.Key.startsWith(prefix)) continue;
      objects.push({ Key: item.Key, VersionId: item.VersionId });
    }

    if (!result.IsTruncated) break;
    keyMarker = result.NextKeyMarker;
    versionIdMarker = result.NextVersionIdMarker;

    if (!keyMarker) {
      throw new Error(`Pagination B2 untuk prefix ${prefix} tidak valid.`);
    }
  } while (true);

  return objects;
}

async function deleteVersionedPrivateObjects(objects: VersionedObjectRef[]) {
  if (objects.length === 0) return;
  const bucket = getB2BucketName();

  for (let offset = 0; offset < objects.length; offset += 1000) {
    const chunk = objects.slice(offset, offset + 1000);
    const result = await getB2Client().send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk, Quiet: true },
      }),
    );

    if (result.Errors && result.Errors.length > 0) {
      const failed = result.Errors
        .map((item) => [item.Key, item.VersionId].filter(Boolean).join("@"))
        .filter(Boolean)
        .join(", ");
      throw new Error(`Gagal menghapus versi object B2: ${failed || "unknown object"}`);
    }
  }
}

/**
 * Permanently purge every B2 object/version below a virtual-folder prefix.
 * Backblaze B2 buckets are versioned, so deleting only by object name is not
 * sufficient for a Room teardown: older versions/delete markers may survive.
 */
export async function deletePrivatePrefixCompletely(prefix: string) {
  const normalizedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

  // Repeat after deletion as a verification pass. This also catches objects that
  // appeared while the first listing/deletion pass was running.
  for (let pass = 0; pass < 3; pass += 1) {
    const objects = await listPrivateObjectVersions(normalizedPrefix);
    if (objects.length === 0) return;
    await deleteVersionedPrivateObjects(objects);
  }

  const remaining = await listPrivateObjectVersions(normalizedPrefix);
  if (remaining.length > 0) {
    throw new Error(
      `Cleanup B2 belum tuntas untuk ${normalizedPrefix}; masih ada ${remaining.length} object/version.`,
    );
  }
}


/**
 * Permanently purge selected direct child prefixes with one B2 listing pass per
 * retry. Used for compatibility cleanup of already-reviewed submission staging
 * without LIST-ing once per submission.
 */
export async function deletePrivateChildPrefixesCompletely(
  parentPrefix: string,
  childIds: string[],
) {
  const normalizedParent = parentPrefix.endsWith("/") ? parentPrefix : `${parentPrefix}/`;
  const targets = new Set(childIds.filter(Boolean));
  if (targets.size === 0) return;

  const isTarget = (item: VersionedObjectRef) => {
    if (!item.Key.startsWith(normalizedParent)) return false;
    const suffix = item.Key.slice(normalizedParent.length);
    const childId = suffix.split("/", 1)[0];
    return targets.has(childId);
  };

  for (let pass = 0; pass < 3; pass += 1) {
    const objects = (await listPrivateObjectVersions(normalizedParent)).filter(isTarget);
    if (objects.length === 0) return;
    await deleteVersionedPrivateObjects(objects);
  }

  const remaining = (await listPrivateObjectVersions(normalizedParent)).filter(isTarget);
  if (remaining.length > 0) {
    throw new Error(
      `Cleanup B2 staging belum tuntas; masih ada ${remaining.length} object/version.`,
    );
  }
}


function encodedCopySource(bucket: string, objectKey: string) {
  return `${encodeURIComponent(bucket)}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}

async function tryHeadPrivateObject(objectKey: string) {
  try {
    return await headPrivateObject(objectKey);
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    if (status === 404 || name === "NotFound" || name === "NoSuchKey") return null;
    throw error;
  }
}

function assertStoredObjectMatches(
  head: { ContentLength?: number; ContentType?: string },
  input: { expectedSizeBytes: number; expectedContentType: string; label: string },
) {
  const storedSize = Number(head.ContentLength ?? -1);
  if (storedSize !== input.expectedSizeBytes) {
    throw new Error(`${input.label}: ukuran object B2 tidak sesuai.`);
  }
  if (head.ContentType && head.ContentType !== input.expectedContentType) {
    throw new Error(`${input.label}: content-type object B2 tidak sesuai.`);
  }
}

/**
 * Promote a temporary private object into its permanent media key.
 * B2/S3 has no atomic rename, so this is deliberately idempotent:
 * destination verified -> source removed -> caller may safely commit Firestore.
 */
export async function promotePrivateObject(input: {
  sourceKey: string;
  destinationKey: string;
  expectedSizeBytes: number;
  expectedContentType: string;
  cleanupSource?: boolean;
}) {
  if (input.sourceKey === input.destinationKey) {
    const head = await headPrivateObject(input.destinationKey);
    assertStoredObjectMatches(head, {
      expectedSizeBytes: input.expectedSizeBytes,
      expectedContentType: input.expectedContentType,
      label: input.destinationKey,
    });
    return;
  }

  const destinationHead = await tryHeadPrivateObject(input.destinationKey);
  if (destinationHead) {
    assertStoredObjectMatches(destinationHead, {
      expectedSizeBytes: input.expectedSizeBytes,
      expectedContentType: input.expectedContentType,
      label: input.destinationKey,
    });
    // A previous attempt may have copied successfully but failed before cleanup.
    // Batch approval can defer cleanup to one verified prefix purge.
    if (input.cleanupSource !== false) await deletePrivateObjects([input.sourceKey]);
    return;
  }

  const sourceHead = await headPrivateObject(input.sourceKey);
  assertStoredObjectMatches(sourceHead, {
    expectedSizeBytes: input.expectedSizeBytes,
    expectedContentType: input.expectedContentType,
    label: input.sourceKey,
  });

  const bucket = getB2BucketName();
  await getB2Client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: input.destinationKey,
      CopySource: encodedCopySource(bucket, input.sourceKey),
      MetadataDirective: "COPY",
    }),
  );

  const promotedHead = await headPrivateObject(input.destinationKey);
  assertStoredObjectMatches(promotedHead, {
    expectedSizeBytes: input.expectedSizeBytes,
    expectedContentType: input.expectedContentType,
    label: input.destinationKey,
  });

  if (input.cleanupSource !== false) await deletePrivateObjects([input.sourceKey]);
}
