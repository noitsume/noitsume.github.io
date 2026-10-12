"use client";

import { useEffect, useId, useRef, useState } from "react";
import { IconButton, MenuIcon } from "@/components/ui";
import { BrandLogo } from "@/components/brand/brand-logo";
import { brand } from "@/config/brand";
import { ThemeToggle } from "@/components/theme";
import { DateTimeWidget } from "./date-time-widget";
import { ProfileMenu, type ShellUser } from "./profile-menu";

export function TopNavbar({
  user,
  onOpenMenu,
  showMenuButton = true,
}: {
  user: ShellUser;
  onOpenMenu: () => void;
  showMenuButton?: boolean;
}) {
  const [minimized, setMinimized] = useState(false);
  const header = useRef<HTMLElement>(null);
  const contentId = useId();
  useEffect(() => {
    const element = header.current;
    const shell = element?.closest<HTMLElement>(".app-shell");
    if (!element || !shell) return;
    // Include the handle below the bar. ResizeObserver also follows the collapse
    // transition, font loading, and mobile layout without fixed pixel guesses.
    const handle = element.querySelector<HTMLButtonElement>(".top-navbar__minimize");
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const overhang = Math.max(0, (handle?.getBoundingClientRect().bottom ?? bounds.bottom) - bounds.bottom);
      shell.style.setProperty("--app-header-clearance", `${bounds.height + overhang}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (handle) observer.observe(handle);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <header ref={header} className="top-navbar" data-minimized={minimized}>
      <div className="top-navbar__content" id={contentId} inert={minimized}>
      <div className="top-navbar__brand-group">
        {showMenuButton ? (
          <IconButton aria-label="Buka navigasi" className="top-navbar__menu-button" onClick={onOpenMenu}>
            <MenuIcon size={19} />
          </IconButton>
        ) : null}
        <a className="brand-lockup" href="/dashboard" aria-label={`${brand.name} Dashboard`}>
          <BrandLogo />
        </a>
      </div>

      <div className="top-navbar__actions">
        <DateTimeWidget />
        <ThemeToggle />
        <ProfileMenu user={user} />
      </div>
      </div>
      <button type="button" className="top-navbar__minimize" aria-controls={contentId} aria-expanded={!minimized}
        aria-label={minimized ? "Tampilkan header" : "Minimalkan header"} title={minimized ? "Tampilkan header" : "Minimalkan header"}
        onClick={() => setMinimized(value => !value)}>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={minimized ? "m2 2 4 4 4-4" : "m2 6 4-4 4 4"} /></svg>
      </button>
    </header>
  );
}
