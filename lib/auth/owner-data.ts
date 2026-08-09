import "server-only";

import type { ShellUser } from "@/components/shell/profile-menu";
import type { OwnerSession } from "./session";

// The session already contains the Firebase-authenticated owner identity.
// Avoid an extra Firestore read on every protected page just to render Navbar.
export async function getOwnerShellUser(session: OwnerSession): Promise<ShellUser> {
  return {
    displayName: session.displayName,
    email: session.email,
    photoURL: session.photoURL,
  };
}
