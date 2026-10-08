import "server-only";
import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestoreDb } from "@/lib/data/firestore/shared";
import { getPublishedReceiver } from "./service";
export type AnalyticsDay = { date: string; opens: number; engaged: number };
export function analyticsDay(date = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export async function recordReceiverEvent(receiverId: string, viewer: string, type: "open" | "watch_threshold") {
  const manifest = await getPublishedReceiver(receiverId);
  const db = firestoreDb();
  const room = db.collection("rooms").doc(manifest.room.id);
  const date = analyticsDay();
  const key = createHash("sha256").update(receiverId + date + viewer).digest("hex");
  const visitor = room.collection("analyticsVisitors").doc(key);
  const day = room.collection("analyticsDaily").doc(date);
  await db.runTransaction(async tx => {
    const [parent, seen, daily] = await Promise.all([tx.get(room), tx.get(visitor), tx.get(day)]);
    if (!parent.exists || parent.data()?.receiverId !== receiverId) return;
    const previous = seen.data();
    const newOpen = !previous?.open;
    const newEngaged = type === "watch_threshold" && !previous?.engaged;
    if (!newOpen && !newEngaged) return;
    tx.set(visitor, { open: true, engaged: previous?.engaged || newEngaged, expiresAt: Timestamp.fromMillis(Date.now() + 8 * 86400000) });
    tx.set(day, { opens: Number(daily.data()?.opens ?? 0) + Number(newOpen), engaged: Number(daily.data()?.engaged ?? 0) + Number(newEngaged) });
  });
}
export async function getRoomAnalytics(roomIds: string[]): Promise<AnalyticsDay[]> {
  const days: AnalyticsDay[] = Array.from({ length: 7 }, (_, i) => ({ date: analyticsDay(new Date(Date.now() - (6 - i) * 86400000)), opens: 0, engaged: 0 }));
  if (!roomIds.length) return days;
  const db = firestoreDb();
  // Only seven aggregate documents per Room, no event collection scan.
  for (let offset = 0; offset < roomIds.length; offset += 20) {
    const refs = roomIds.slice(offset, offset + 20).flatMap(id => days.map(day => db.collection("rooms").doc(id).collection("analyticsDaily").doc(day.date)));
    const snapshots = await db.getAll(...refs);
    for (const snapshot of snapshots) {
      const day = days.find(item => item.date === snapshot.id)!;
      day.opens += Number(snapshot.data()?.opens ?? 0);
      day.engaged += Number(snapshot.data()?.engaged ?? 0);
    }
  }
  return days;
}
