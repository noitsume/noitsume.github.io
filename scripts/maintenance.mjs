/** Dry-run by default. No scheduler is installed by this script. */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { S3Client, ListObjectVersionsCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const apply = process.argv.includes("--apply");
const requestedRoom = process.argv.find(arg => arg.startsWith("--room="))?.slice(7);
const purgeExpired = process.argv.includes("--purge-expired-room");
if (purgeExpired && (!requestedRoom || !apply)) throw new Error("Expired Room purge requires --apply --room=<id> --purge-expired-room.");
const required = name => { const value = process.env[name]; if (!value) throw new Error(`Missing ${name}`); return value; };
initializeApp({ credential: cert({ projectId: required("FIREBASE_PROJECT_ID"), clientEmail: required("FIREBASE_CLIENT_EMAIL"), privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n") }) });
const db = getFirestore();
const s3 = new S3Client({ endpoint: required("B2_ENDPOINT"), region: required("B2_REGION"), credentials: { accessKeyId: required("B2_KEY_ID"), secretAccessKey: required("B2_APPLICATION_KEY") } });
const Bucket = required("B2_BUCKET");
const now = Date.now();
const cutoff = now - 72 * 3600000;
console.log(apply ? "APPLY: deleting only eligible data below" : "DRY RUN: no data will be changed");
async function versions(Prefix) {
  const result = []; let KeyMarker, VersionIdMarker;
  do {
    const page = await s3.send(new ListObjectVersionsCommand({ Bucket, Prefix, KeyMarker, VersionIdMarker }));
    result.push(...(page.Versions ?? []), ...(page.DeleteMarkers ?? []));
    if (!page.IsTruncated) break;
    KeyMarker = page.NextKeyMarker; VersionIdMarker = page.NextVersionIdMarker;
  } while (KeyMarker);
  return result;
}
async function removeObjects(objects) {
  for (let i=0;i<objects.length;i+=500) {
    const result = await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: objects.slice(i,i+500).map(item => ({ Key:item.Key, VersionId:item.VersionId })), Quiet:true } }));
    if (result.Errors?.length) throw new Error("Storage deletion partially failed. Retry maintenance; metadata has been retained.");
  }
}
const rooms = requestedRoom ? [await db.collection("rooms").doc(requestedRoom).get()] : (await db.collection("rooms").limit(200).get()).docs;
if (!requestedRoom && rooms.length === 200) console.log("Scan bounded to 200 rooms; use --room=<id> for other rooms.");
for (const snapshot of rooms) {
  if (!snapshot.exists) continue;
  const room = snapshot.data();
  const roomId = snapshot.id;
  const expiresMs = room.expiresAt?.toMillis?.() ?? Date.parse(room.expiresAt ?? "");
  const expiredBeyondGrace = Number.isFinite(expiresMs) && expiresMs < now - 7 * 86400000;
  if (expiredBeyondGrace) console.log(JSON.stringify({ roomId, eligibleForPurge: true, graceDays: 7 }));
  if (purgeExpired) {
    if (!expiredBeyondGrace) throw new Error("Room is not expired beyond the seven-day grace period.");
    await db.runTransaction(async tx => {
      const fresh = (await tx.get(snapshot.ref)).data();
      const expires = fresh?.expiresAt?.toMillis?.() ?? Date.parse(fresh?.expiresAt ?? "");
      if (!fresh || !Number.isFinite(expires) || expires >= now - 7 * 86400000) throw new Error("Room expiry changed. Nothing deleted.");
      tx.update(snapshot.ref, { config: { ...(fresh.config ?? {}), _deleting: true } });
    });
    await removeObjects(await versions(`rooms/${roomId}/`));
    if (room.receiverId) await db.recursiveDelete(db.collection("receivers").doc(room.receiverId));
    await db.recursiveDelete(snapshot.ref);
    console.log(JSON.stringify({ roomId, purged: true }));
    continue;
  }
  const pending = await snapshot.ref.collection("submissions").get();
  const protectedKeys = new Set(pending.docs.flatMap(doc => doc.data().status === "new" ? (doc.data().stagedMedia ?? []).map(item => item.storageObjectKey) : []));
  // Also preserve the legacy storage layout until its normal migration completes.
  const media = await snapshot.ref.collection("media").get();
  media.docs.forEach(doc => protectedKeys.add(doc.data().storageObjectKey));
  const oldStaging = (await versions(`rooms/${roomId}/submissions/`)).filter(item => item.Key && item.LastModified && item.LastModified.getTime() < cutoff && !protectedKeys.has(item.Key));
  console.log(JSON.stringify({ roomId, abandonedStagingVersions: oldStaging.length }));
  if (apply && oldStaging.length) {
    // Recheck metadata immediately before deleting old unreferenced objects.
    const freshPending = await snapshot.ref.collection("submissions").get();
    const freshKeys = new Set(freshPending.docs.flatMap(doc => (doc.data().stagedMedia ?? []).map(item => item.storageObjectKey)));
    await removeObjects(oldStaging.filter(item => !freshKeys.has(item.Key)));
  }
  const visitors = await snapshot.ref.collection("analyticsVisitors").where("expiresAt","<=",Timestamp.fromMillis(now)).limit(500).get();
  console.log(JSON.stringify({ roomId, expiredAnalyticsKeys: visitors.size }));
  if (apply) { const batch = db.batch(); visitors.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); }
}
const limits = await db.collection("requestLimits").where("expiresAt","<=",Timestamp.fromMillis(now)).limit(500).get();
console.log(JSON.stringify({ expiredRequestBuckets: limits.size }));
if (apply) { const batch = db.batch(); limits.docs.forEach(doc => batch.delete(doc.ref)); await batch.commit(); }
console.log("Maintenance finished.");
