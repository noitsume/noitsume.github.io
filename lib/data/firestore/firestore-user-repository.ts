import "server-only";

import type { DocumentData } from "firebase-admin/firestore";
import { userProfileSchema, type UserProfile } from "@/lib/data/contracts";
import type { UserRepository } from "@/lib/data/repositories";
import { firestoreDb, toIsoString } from "./shared";

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
}
