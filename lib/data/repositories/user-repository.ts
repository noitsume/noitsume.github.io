import type { UserProfile } from "@/lib/data/contracts";

export interface UserRepository {
  getUser(uid: string): Promise<UserProfile | null>;
}
