"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DeskBackground } from "@/components/theme";
import { CloseIcon, IconButton } from "@/components/ui";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import type { ShellUser } from "./profile-menu";

export function AppShell({
  user,
  children,
  rightRail,
  hideSidebar = false,
}: {
  user: ShellUser;
  children: ReactNode;
  rightRail?: ReactNode;
  hideSidebar?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    const firstButton = panelRef.current?.querySelector<HTMLElement>("button, a[href]");
    firstButton?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const shellClasses = [
    "app-shell",
    rightRail ? "" : "app-shell--no-rail",
    hideSidebar ? "app-shell--focus" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={shellClasses}>
      <DeskBackground />
      <TopNavbar user={user} onOpenMenu={() => setMobileOpen(true)} showMenuButton={!hideSidebar} />

      <div className="app-shell__body">
        {!hideSidebar ? <div className="app-shell__left"><Sidebar /></div> : null}
        <main className="app-shell__main">{children}</main>
        {rightRail ? <aside className="app-shell__right">{rightRail}</aside> : null}
      </div>

      {!hideSidebar ? <div
        className={`mobile-nav ${mobileOpen ? "mobile-nav--open" : ""}`}
        aria-hidden={!mobileOpen}
      >
        <button
          className="mobile-nav__scrim"
          aria-label="Tutup navigasi"
          onClick={() => setMobileOpen(false)}
          tabIndex={mobileOpen ? 0 : -1}
          type="button"
        />
        <div
          aria-label="Navigasi utama"
          aria-modal="true"
          className="mobile-nav__panel"
          ref={panelRef}
          role="dialog"
        >
          <div className="mobile-nav__header">
            <span>Menu</span>
            <IconButton aria-label="Tutup navigasi" onClick={() => setMobileOpen(false)} tabIndex={mobileOpen ? 0 : -1}>
              <CloseIcon size={19} />
            </IconButton>
          </div>
          <Sidebar mobile onNavigate={() => setMobileOpen(false)} />
        </div>
      </div> : null}
    </div>
  );
}
