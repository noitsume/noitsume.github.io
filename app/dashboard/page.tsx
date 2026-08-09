import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardRoomSections } from "@/components/dashboard/dashboard-room-sections";
import { AppShell } from "@/components/shell";
import {
  ArrowRightIcon,
  Badge,
  CalendarIcon,
  SectionHeader,
  Surface,
} from "@/components/ui";
import { getOwnerShellUser } from "@/lib/auth/owner-data";
import { getOwnerSession } from "@/lib/auth/session";
import type { EventDefinition } from "@/lib/data/contracts";
import { backendRepositories } from "@/lib/data/providers/backend-repository-provider";
import { getDashboardRoomStatus } from "@/lib/domain/room-status";
import { sortRooms, type RoomSortMode } from "@/lib/domain/room-sorting";

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function countdownLabel(value: string) {
  const ms = new Date(value).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  return days === 0 ? "Hari ini" : `${days} hari lagi`;
}

function openedLabel(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
  if (days === 0) return "Hari ini";
  if (days === 1) return "1 hari lalu";
  return `${days} hari lalu`;
}

function StatItem({ label, value, description, tone }: { label: string; value: number; description: string; tone: "coral" | "neutral" | "green" | "indigo" }) {
  return (
    <div className={`dashboard-stat dashboard-stat--${tone}`}>
      <div className={`dashboard-stat__orb dashboard-stat__orb--${tone}`} />
      <p className="ui-eyebrow">{label}</p>
      <strong>{value}</strong>
      <span>{description}</span>
    </div>
  );
}

function EventCard({ event }: { event: EventDefinition }) {
  return (
    <Surface className="event-card" tone="quiet">
      <div className={`event-card__icon event-card__icon--${event.accent}`} />
      <div className="event-card__body">
        <h3>{event.title}</h3>
        <p>{formatDateLabel(event.date)}</p>
      </div>
      <Badge className={event.accent === "green" ? "ui-badge--success" : "ui-badge--amber"}>{countdownLabel(event.date)}</Badge>
    </Surface>
  );
}

type DashboardPageProps = {
  searchParams: Promise<{ sort?: string; create?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await getOwnerSession();
  if (!session) redirect("/login?next=/dashboard");

  const [{ sort, create }, user, rooms, events, themes] = await Promise.all([
    searchParams,
    getOwnerShellUser(session),
    backendRepositories.rooms.listRooms(session.uid),
    backendRepositories.events.listEvents("ID"),
    backendRepositories.themes.listThemes(),
  ]);

  if (!user) redirect("/onboarding?next=/dashboard");

  const sortMode: RoomSortMode = sort === "oldest" || sort === "status" ? sort : "newest";
  const sortedRooms = sortRooms(rooms, sortMode);
  const recentRooms = [...rooms]
    .filter((room) => room.lastOpenedAt)
    .sort((a, b) => new Date(b.lastOpenedAt ?? 0).getTime() - new Date(a.lastOpenedAt ?? 0).getTime())
    .slice(0, 3);

  const stats = {
    total: rooms.length,
    waiting: rooms.filter((room) => getDashboardRoomStatus(room) === "waiting").length,
    working: rooms.filter((room) => getDashboardRoomStatus(room) === "working").length,
    ended: rooms.filter((room) => getDashboardRoomStatus(room) === "ended").length,
  };

  const rightRail = (
    <div className="dashboard-rail">
      <Surface className="dashboard-rail__panel" tone="elevated">
        <div className="rail-label-row">
          <span className="ui-eyebrow">RIWAYAT</span>
          <Badge>{Math.min(recentRooms.length, 3)} / 3</Badge>
        </div>
        <h3>Room Terakhir Dibuka</h3>
        {recentRooms.length > 0 ? (
          <ol className="history-list">
            {recentRooms.map((room, index) => (
              <li key={room.id}>
                <Link className="history-list__item" href={`/rooms/${room.id}`}>
                  <span className="history-list__index">{index + 1}</span>
                  <div>
                    <strong>{room.title}</strong>
                    <p>Terakhir dibuka {openedLabel(room.lastOpenedAt!)}</p>
                  </div>
                  <ArrowRightIcon size={16} />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="dashboard-empty-copy">Belum ada Room yang dibuka dari akun ini.</p>
        )}
      </Surface>

      <Surface className="dashboard-rail__panel" tone="quiet">
        <div className="rail-label-row">
          <span className="ui-eyebrow">7 HARI TERAKHIR</span>
          <Badge className="ui-badge--success">LIVE</Badge>
        </div>
        <h3>Penonton Final</h3>
        <div className="viewer-hero">
          <strong>0</strong>
          <span>orang menonton final</span>
        </div>
        <div className="viewer-chart" aria-label="Grafik 7 hari terakhir">
          {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((day) => (
            <div key={day} className="viewer-chart__day">
              <span className="viewer-chart__value">0</span>
              <span className="viewer-chart__dot" />
              <small>{day}</small>
            </div>
          ))}
        </div>
        <p className="viewer-chart__note">Belum ada pembanding</p>
        <div className="viewer-metrics">
          <div>
            <span>Link final dibuka</span>
            <strong>0 orang</strong>
          </div>
          <div>
            <span>Menonton final</span>
            <strong>0 orang</strong>
          </div>
        </div>
        <p className="viewer-footnote">Analytics Receiver baru akan diaktifkan setelah alur Receiver tersedia.</p>
      </Surface>
    </div>
  );

  return (
    <AppShell user={user} rightRail={rightRail}>
      <div className="dashboard-page">
        <Surface className="dashboard-hero" tone="elevated">
          <div className="dashboard-hero__copy">
            <p className="ui-eyebrow">KENANGIN.ID · OWNER DASHBOARD</p>
            <div className="dashboard-hero__title-row">
              <h1>Dashboard Owner</h1>
            </div>
            <p>
              Kelola room, pantau submission, dan siapkan kejutan personal dari satu workspace yang rapi dan terorganisir.
            </p>
          </div>

          <div className="dashboard-stats">
            <StatItem label="Total Room" value={stats.total} description="Seluruh workspace" tone="coral" />
            <StatItem label="Waiting" value={stats.waiting} description="Belum melakukan Bake pertama" tone="neutral" />
            <StatItem label="On Working" value={stats.working} description="Sudah melakukan Bake pertama" tone="green" />
            <StatItem label="Ended" value={stats.ended} description="Sudah melewati kadaluarsa" tone="indigo" />
          </div>
        </Surface>

        <section className="dashboard-section" aria-labelledby="upcoming-heading">
          <SectionHeader
            eyebrow="OTOMATIS"
            icon={<CalendarIcon size={16} />}
            title="Event Mendatang"
            headingId="upcoming-heading"
            action={<span className="section-note">Dihitung otomatis dari tanggal hari ini</span>}
          />
          {events.length > 0 ? (
            <div className="events-grid">
              {events.slice(0, 3).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <Surface className="dashboard-empty-state" tone="quiet">Belum ada event terkurasi berikutnya.</Surface>
          )}
        </section>

        <DashboardRoomSections
          initialRooms={sortedRooms}
          creatorName={user.displayName}
          sortMode={sortMode}
          themes={themes}
          initialCreateOpen={create === "1"}
        />
      </div>
    </AppShell>
  );
}
