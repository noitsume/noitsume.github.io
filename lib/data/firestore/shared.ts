import "server-only";

import {
  Timestamp,
  type DocumentData,
  type Firestore,
} from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";

export function firestoreDb(): Firestore {
  return getFirebaseAdminFirestore();
}

export function toTimestamp(value: string | null | undefined) {
  if (value == null) return value;
  return Timestamp.fromDate(new Date(value));
}

export function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new Error("Expected Firestore timestamp/date/string value.");
}

export function nullableIsoString(value: unknown): string | null {
  return value == null ? null : toIsoString(value);
}

export function docDataWithId<T extends DocumentData>(id: string, data: T) {
  return { id, ...data };
}
