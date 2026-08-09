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
}: {
  user: ShellUser;
  children: ReactNode;
  rightRail?: ReactNode;
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

  return (
    <div className={`app-shell ${rightRail ? "" : "app-shell--no-rail"}`.trim()}>
      <DeskBackground />
      <TopNavbar user={user} onOpenMenu={() => setMobileOpen(true)} />

      <div className="app-shell__body">
        <div className="app-shell__left"><Sidebar /></div>
        <main className="app-shell__main">{children}</main>
        {rightRail ? <aside className="app-shell__right">{rightRail}</aside> : null}
      </div>

      <div
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
      </div>
    </div>
  );
}
