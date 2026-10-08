"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, GridIcon, HomeIcon, InboxIcon } from "@/components/ui";
import { brand } from "@/config/brand";

const navigation = [
  { label: "Kenangan saya", href: "/dashboard", icon: HomeIcon, ready: true },
  { label: "Momen mendatang", href: "/events", icon: CalendarIcon, ready: true },
  { label: "Koleksi tema", href: "/templates", icon: GridIcon, ready: true },
  { label: "Panduan", href: "/guide", icon: InboxIcon, ready: true },
];

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className={mobile ? "sidebar sidebar--mobile" : "sidebar"}>
      <nav className="sidebar__nav" aria-label="Navigasi utama">
        {navigation.map((item) => {
          const Icon = item.icon;

          if (!item.ready) {
            return (
              <span className="sidebar__item sidebar__item--pending" key={item.label} aria-disabled="true">
                <Icon size={18} />
                <span>{item.label}</span>
                <small>soon</small>
              </span>
            );
          }

          const active = item.href === "/dashboard"
            ? pathname === "/dashboard" || pathname.startsWith("/rooms")
            : pathname.startsWith(item.href);

          return (
            <Link
              className={`sidebar__item ${active ? "sidebar__item--active" : ""}`.trim()}
              href={item.href}
              aria-current={active ? "page" : undefined}
              key={item.label}
              onClick={onNavigate}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <footer className="sidebar__footer">
        <span>{brand.copyright}</span>
        <span>All rights reserved.</span>
      </footer>
    </aside>
  );
}
