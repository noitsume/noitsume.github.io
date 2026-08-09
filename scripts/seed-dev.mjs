import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diisi di .env.local`);
  return value;
}

const projectId = required("FIREBASE_PROJECT_ID");
const clientEmail = required("FIREBASE_CLIENT_EMAIL");
const privateKey = required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

const rl = readline.createInterface({ input, output });
console.log(`Target Firebase project: ${projectId}`);
console.log("Script ini akan menambah/mengganti data DEV dengan ID yang tetap.");
const confirmation = await rl.question('Ketik "SEED" untuk lanjut: ');
rl.close();

if (confirmation !== "SEED") {
  console.log("Dibatalkan. Tidak ada data yang diubah.");
  process.exit(0);
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
const db = getFirestore(app);
const now = new Date();
const addDays = (days) => {
  const value = new Date(now);
  value.setDate(value.getDate() + days);
  return Timestamp.fromDate(value);
};

const userId = "dev_kevin";
await db.collection("users").doc(userId).set(
  {
    uid: userId,
    displayName: "Kevin",
    email: "noitsume@gmail.com",
    photoURL: null,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  },
  { merge: true },
);

const rooms = [
  {
    id: "room_dev_antonio",
    title: "Antonio ke 12",
    recipientName: "Antonio",
    occasionId: "birthday",
    status: "configuring",
    collectorId: "collector_dev_antonio",
    receiverId: null,
    collectionDeadline: addDays(4),
    firstBakedAt: addDays(-3),
    expiresAt: addDays(40),
    isPinned: true,
    lastOpenedAt: addDays(-1),
  },
  {
    id: "room_dev_dila",
    title: "Dila Graduation 2026",
    recipientName: "Dila",
    occasionId: "graduation",
    status: "collecting",
    collectorId: "collector_dev_dila",
    receiverId: null,
    collectionDeadline: addDays(11),
    firstBakedAt: null,
    expiresAt: addDays(33),
    isPinned: false,
    lastOpenedAt: addDays(-4),
  },
];

const batch = db.batch();
for (const room of rooms) {
  const ref = db.collection("rooms").doc(room.id);
  batch.set(
    ref,
    {
      ownerUid: userId,
      title: room.title,
      recipientName: room.recipientName,
      occasionId: room.occasionId,
      eventId: null,
      themeId: "theme_warm_memory",
      customThemeNameRaw: null,
      status: room.status,
      collectorId: room.collectorId,
      receiverId: room.receiverId,
      collectionDeadline: room.collectionDeadline,
      firstBakedAt: room.firstBakedAt,
      expiresAt: room.expiresAt,
      isPinned: room.isPinned,
      lastOpenedAt: room.lastOpenedAt,
      createdAt: addDays(-10),
      updatedAt: Timestamp.fromDate(now),
    },
    { merge: true },
  );
}
await batch.commit();

console.log(`✓ Seed selesai: 1 user + ${rooms.length} room DEV.`);
