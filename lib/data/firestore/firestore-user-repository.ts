import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import { userProfileSchema, type UserProfile } from "@/lib/data/contracts";
import type {
  UpsertUserInput,
  UserRepository,
} from "@/lib/data/repositories/user-repository";
import { firestoreDb, toIsoString, toTimestamp } from "./shared";

function mapUser(uid: string, data: DocumentData): UserProfile {
  const legacyDisplayName =
    typeof data.displayName === "string" && data.displayName.trim()
      ? data.displayName.trim()
      : "Owner";
  const username =
    typeof data.username === "string" && data.username.trim()
      ? data.username.trim()
      : null;

  return userProfileSchema.parse({
    uid,
    username,
    displayName: username ?? legacyDisplayName,
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

    if (existing.exists) {
      const current = mapUser(existing.id, existing.data()!);
      const unchanged =
        current.username === input.username &&
        current.displayName === input.displayName &&
        current.email === input.email &&
        current.photoURL === input.photoURL;

      // Normal repeat login: one read and no Firestore write when nothing changed.
      if (unchanged) return current;

      await ref.update({
        username: input.username,
        displayName: input.displayName,
        email: input.email,
        photoURL: input.photoURL,
        updatedAt: toTimestamp(now),
      });

      return userProfileSchema.parse({
        ...current,
        username: input.username,
        displayName: input.displayName,
        email: input.email,
        photoURL: input.photoURL,
        updatedAt: now,
      });
    }

    const profile = userProfileSchema.parse({
      uid: input.uid,
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      photoURL: input.photoURL,
      createdAt: now,
      updatedAt: now,
    });

    await ref.set({
      ...profile,
      createdAt: toTimestamp(profile.createdAt),
      updatedAt: toTimestamp(profile.updatedAt),
    });

    return profile;
  }
}
