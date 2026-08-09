import type { UserProfile } from "@/lib/data/contracts";
import type {
  UpsertUserInput,
  UserRepository,
} from "@/lib/data/repositories/user-repository";
import { createMockUser } from "./seed";

export class MockUserRepository implements UserRepository {
  private user: UserProfile;

  constructor(user: UserProfile = createMockUser()) {
    this.user = structuredClone(user);
  }

  async getUser(uid: string): Promise<UserProfile | null> {
    return uid === this.user.uid ? structuredClone(this.user) : null;
  }

  async upsertUser(input: UpsertUserInput): Promise<UserProfile> {
    const now = new Date().toISOString();
    this.user = {
      ...input,
      createdAt: this.user.uid === input.uid ? this.user.createdAt : now,
      updatedAt: now,
    };
    return structuredClone(this.user);
  }
}
