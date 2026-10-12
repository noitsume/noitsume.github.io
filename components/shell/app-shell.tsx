"use client";
import { useState, type ReactNode } from "react";
import { DeskBackground } from "@/components/theme";
import { Dialog } from "@/components/ui/dialog";
import { Sidebar } from "./sidebar";
import { TopNavbar } from "./top-navbar";
import type { ShellUser } from "./profile-menu";

export function AppShell({ user, children, rightRail, hideSidebar = false, background, className = "" }: {
  user: ShellUser; children: ReactNode; rightRail?: ReactNode; hideSidebar?: boolean; background?: ReactNode; className?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <div className={["app-shell", rightRail ? "" : "app-shell--no-rail", hideSidebar ? "app-shell--focus" : "", className].filter(Boolean).join(" ")}>
    <a className="skip-link" href="#main-content">Lewati ke isi halaman</a>
    {background ?? <DeskBackground />}
    <TopNavbar user={user} onOpenMenu={() => setMobileOpen(true)} showMenuButton={!hideSidebar} />
    <div className="app-shell__body">
      {!hideSidebar ? <div className="app-shell__left"><Sidebar /></div> : null}
      <main id="main-content" tabIndex={-1} className="app-shell__main">{children}</main>
      {rightRail ? <aside className="app-shell__right">{rightRail}</aside> : null}
    </div>
    {!hideSidebar ? <Dialog open={mobileOpen} onClose={() => setMobileOpen(false)} title="Kenangin" className="navigation-dialog"><Sidebar mobile onNavigate={() => setMobileOpen(false)} /></Dialog> : null}
  </div>;
}
