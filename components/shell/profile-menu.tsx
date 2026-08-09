"use client";

import { useEffect, useRef } from "react";
import { Avatar, ChevronDownIcon } from "@/components/ui";

export type ShellUser = {
  displayName: string;
  email: string;
  photoURL?: string | null;
};

export function ProfileMenu({ user }: { user: ShellUser }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

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

  return (
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
        <button type="button">Pengaturan profil</button>
        <button type="button">Keluar</button>
      </div>
    </details>
  );
}
