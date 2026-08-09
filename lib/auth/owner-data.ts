import "server-only";

import type { ShellUser } from "@/components/shell/profile-menu";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import type { OwnerSession } from "./session";

export async function getOwnerShellUser(session: OwnerSession): Promise<ShellUser> {
  const profile = await backendRepositories.users.getUser(session.uid);
  if (profile) {
    return {
      displayName: profile.displayName,
      email: profile.email,
      photoURL: profile.photoURL,
    };
  }

  return {
    displayName: session.displayName,
    email: session.email,
    photoURL: session.photoURL,
  };
}
