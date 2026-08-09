import Link from "next/link";
import { CalendarIcon, GridIcon, HomeIcon, InboxIcon } from "@/components/ui";
import { brand } from "@/config/brand";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon, ready: true },
  { label: "Event Mendatang", href: "/events", icon: CalendarIcon, ready: false },
  { label: "Room Template", href: "/templates", icon: GridIcon, ready: false },
  { label: "Submission", href: "/submissions", icon: InboxIcon, ready: false },
] as const;

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
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

          return (
            <Link className="sidebar__item sidebar__item--active" href={item.href} key={item.label} onClick={onNavigate}>
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
