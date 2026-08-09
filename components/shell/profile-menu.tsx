"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, ChevronDownIcon } from "@/components/ui";
import { destroyServerSession } from "@/lib/auth/client";
import {
  LOGOUT_TO_AUTH_DURATION_MS,
  LogoutToAuthTransition,
} from "./logout-to-auth-transition";

export type ShellUser = {
  displayName: string;
  email: string;
  photoURL?: string | null;
};

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function ProfileMenu({ user }: { user: ShellUser }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutAnimating, setLogoutAnimating] = useState(false);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (!details.contains(event.target as Node)) details.open = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
        detailsRef.current.querySelector<HTMLElement>("summary")?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function logout() {
    if (signingOut || logoutAnimating) return;

    setSigningOut(true);
    if (detailsRef.current) detailsRef.current.open = false;

    try {
      /* Do not start a 4.7 second exit only to discover that the server session
         could not be destroyed. Once the DELETE succeeds, the cinematic can
         safely own the screen until the /login hand-off. */
      await destroyServerSession();
      setLogoutAnimating(true);
      await wait(LOGOUT_TO_AUTH_DURATION_MS);
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout gagal", error);
      setLogoutAnimating(false);
      setSigningOut(false);
    }
  }

  return (
    <>
      <details className="profile-menu" ref={detailsRef}>
        <summary className="profile-menu__trigger">
          <Avatar name={user.displayName} imageUrl={user.photoURL} />
          <span className="profile-menu__identity">
            <strong>{user.displayName}</strong>
            <small>{user.email}</small>
          </span>
          <span className="profile-menu__chevron"><ChevronDownIcon size={16} /></span>
        </summary>
        <div className="profile-menu__popover">
          <p className="ui-eyebrow">OWNER PANEL</p>
          <strong>{user.displayName}</strong>
          <span>{user.email}</span>
          <div className="profile-menu__separator" />
          <button type="button" disabled>Pengaturan profil</button>
          <button type="button" onClick={logout} disabled={signingOut || logoutAnimating}>
            {signingOut ? "Menutup ruang kerja..." : "Logout"}
          </button>
        </div>
      </details>

      <LogoutToAuthTransition active={logoutAnimating} />
    </>
  );
}
