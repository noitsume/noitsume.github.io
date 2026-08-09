import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import { userProfileSchema, type UserProfile } from "@/lib/data/contracts";
import type {
  UpsertUserInput,
  UserRepository,
} from "@/lib/data/repositories/user-repository";
import { firestoreDb, toIsoString, toTimestamp } from "./shared";

function mapUser(uid: string, data: DocumentData): UserProfile {
  return userProfileSchema.parse({
    uid,
    displayName: data.displayName,
    email: data.email,
    photoURL: data.photoURL ?? null,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  });
}

export class FirestoreUserRepository implements UserRepository {
  async getUser(uid: string): Promise<UserProfile | null> {
    const snapshot = await firestoreDb().collection("users").doc(uid).get();
    if (!snapshot.exists) return null;
    return mapUser(snapshot.id, snapshot.data()!);
  }

  async upsertUser(input: UpsertUserInput): Promise<UserProfile> {
    const ref = firestoreDb().collection("users").doc(input.uid);
    const existing = await ref.get();
    const now = new Date().toISOString();

    await ref.set(
      {
        uid: input.uid,
        displayName: input.displayName,
        email: input.email,
        photoURL: input.photoURL,
        createdAt: existing.exists
          ? existing.data()!.createdAt
          : toTimestamp(now),
        updatedAt: toTimestamp(now),
      },
      { merge: true },
    );

    const updated = await ref.get();
    return mapUser(updated.id, updated.data()!);
  }
}
