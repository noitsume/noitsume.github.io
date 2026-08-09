"use client";

import { IconButton, MenuIcon } from "@/components/ui";
import { brand } from "@/config/brand";
import { ThemeToggle } from "@/components/theme";
import { DateTimeWidget } from "./date-time-widget";
import { ProfileMenu, type ShellUser } from "./profile-menu";

export function TopNavbar({ user, onOpenMenu }: { user: ShellUser; onOpenMenu: () => void }) {
  return (
    <header className="top-navbar">
      <div className="top-navbar__brand-group">
        <IconButton aria-label="Buka navigasi" className="top-navbar__menu-button" onClick={onOpenMenu}>
          <MenuIcon size={19} />
        </IconButton>
        <a className="brand-lockup" href="/dashboard" aria-label={`${brand.name} Dashboard`}>
          <span className="brand-mark" aria-hidden="true"><span>{brand.shortName}</span></span>
          <strong>{brand.name}</strong>
        </a>
      </div>

      <div className="top-navbar__actions">
        <DateTimeWidget />
        <ThemeToggle />
        <ProfileMenu user={user} />
      </div>
    </header>
  );
}
