import type { UserProfile } from "@/lib/data/contracts";

export type UpsertUserInput = Pick<
  UserProfile,
  "uid" | "username" | "displayName" | "email" | "photoURL"
>;

export interface UserRepository {
  getUser(uid: string): Promise<UserProfile | null>;
  upsertUser(input: UpsertUserInput): Promise<UserProfile>;
}
