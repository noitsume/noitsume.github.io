import "server-only";

import type { ShellUser } from "@/components/shell/profile-menu";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import type { OwnerSession } from "./session";

export async function getOwnerShellUser(session: OwnerSession): Promise<ShellUser | null> {
  const profile = await backendRepositories.users.getUser(session.uid);
  if (!profile?.username) return null;

  return {
    displayName: profile.username,
    email: profile.email,
    photoURL: profile.photoURL,
  };
}
