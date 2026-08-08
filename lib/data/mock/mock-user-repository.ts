import type { UserProfile } from "@/lib/data/contracts";
import type { UserRepository } from "@/lib/data/repositories";
import { createMockUser } from "./seed";

export class MockUserRepository implements UserRepository {
  constructor(private readonly user: UserProfile = createMockUser()) {}

  async getUser(uid: string): Promise<UserProfile | null> {
    return uid === this.user.uid ? structuredClone(this.user) : null;
  }
}
